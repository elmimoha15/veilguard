import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { mkdir, writeFile, readFile, appendFile } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { getTemplatesDir } from './utils/paths.js';
import { scanSecrets } from './scanners/secret-scanner.js';
import { checkEnv } from './scanners/env-checker.js';
import { scanInjection } from './scanners/injection-scanner.js';
import { scanWebhooks } from './scanners/webhook-scanner.js';

function getCommand(): string {
  return process.argv[2] || 'start';
}

async function quickScan(): Promise<void> {
  const fileArg = process.argv.indexOf('--file');
  const dirArg = process.argv.indexOf('--dir');
  const target = fileArg !== -1 ? process.argv[fileArg + 1] : dirArg !== -1 ? process.argv[dirArg + 1] : process.cwd();

  if (!target) {
    process.stderr.write('Usage: veilguard quick-scan --file <path> or --dir <path>\n');
    process.exit(1);
  }

  const tier = process.env.VEILGUARD_KEY ? 'pro' : 'free' as const;

  const [secrets, env, injection, webhooks] = await Promise.all([
    scanSecrets(target, tier),
    checkEnv(target, tier),
    scanInjection(target, tier),
    scanWebhooks(target, tier),
  ]);

  const allFindings = [
    ...secrets.findings,
    ...env.findings,
    ...injection.findings,
    ...webhooks.findings,
  ].filter((f) => f.severity === 'critical' || f.severity === 'warning');

  if (allFindings.length > 0) {
    for (const f of allFindings) {
      process.stdout.write(`${f.severity.toUpperCase()}: ${f.title} — ${f.message}\n`);
    }
  }
  // If clean: total silence (no output)
}

// ── init command ────────────────────────────────────────────────────────────

// The veilguard MCP server, as one entry inside an "mcpServers"/"servers" map.
// The `veilguard` package ships two binaries (veilguard-cli, veilguard-mcp),
// so npx must be told which package to fetch and which binary to run.
const STDIO_SERVER = {
  command: 'npx',
  args: ['-y', '--package=veilguard', 'veilguard-mcp'],
  env: { VEILGUARD_KEY: '' },
};
// VS Code requires an explicit transport type on the server entry.
const VSCODE_SERVER = { type: 'stdio', ...STDIO_SERVER };

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

async function readTemplate(name: string): Promise<string> {
  return readFile(join(getTemplatesDir(), name), 'utf-8');
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(value, null, 2) + '\n');
}

// Show an absolute path with the home dir collapsed to "~" for friendlier output.
function tildify(p: string): string {
  const home = homedir();
  return p.startsWith(home) ? '~' + p.slice(home.length) : p;
}

// Add (or replace) the "veilguard" server inside a global MCP config file,
// preserving any other servers the user already has. Creates the file/dir if
// missing. `key` is "mcpServers" for most IDEs, "servers" for VS Code.
async function mergeServer(
  configPath: string,
  key: 'mcpServers' | 'servers',
  server: object,
): Promise<void> {
  await ensureDir(dirname(configPath));

  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(await readFile(configPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    config = {}; // No file yet, or invalid JSON — start fresh.
  }

  const existing = config[key];
  const servers =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  servers.veilguard = server;
  config[key] = servers;

  await writeJson(configPath, config);
}

// VS Code stores its user-level (global) MCP config here, per platform.
function vscodeUserMcpPath(): string {
  const home = homedir();
  if (process.platform === 'win32') {
    return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Code', 'User', 'mcp.json');
  }
  if (process.platform === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
  }
  return join(home, '.config', 'Code', 'User', 'mcp.json');
}

interface IdeResult {
  message: string;
  // Project-relative paths this setup wrote that should be kept out of the repo.
  // (Files written to HOME — e.g. ~/.windsurf — never enter the repo, so they're omitted.)
  gitignore: string[];
}

async function setupCursor(cwd: string): Promise<IdeResult> {
  const configPath = join(homedir(), '.cursor', 'mcp.json'); // global, all projects
  await mergeServer(configPath, 'mcpServers', STDIO_SERVER);
  await writeFile(join(cwd, '.cursorrules'), await readTemplate('cursorrules.txt'));
  return {
    message: `Cursor: ${tildify(configPath)} (global) + .cursorrules created`,
    gitignore: ['.cursorrules'],
  };
}

async function setupVscode(_cwd: string): Promise<IdeResult> {
  const configPath = vscodeUserMcpPath(); // global, all workspaces
  await mergeServer(configPath, 'servers', VSCODE_SERVER);
  return { message: `VS Code: ${tildify(configPath)} (global) created`, gitignore: [] };
}

async function setupWindsurf(cwd: string): Promise<IdeResult> {
  const configPath = join(homedir(), '.windsurf', 'mcp.json'); // global, all projects
  await mergeServer(configPath, 'mcpServers', STDIO_SERVER);
  await writeFile(join(cwd, '.windsurfrules'), await readTemplate('windsurfrules.txt'));
  return {
    message: `Windsurf: ${tildify(configPath)} (global) + .windsurfrules created`,
    gitignore: ['.windsurfrules'],
  };
}

async function setupClaude(cwd: string): Promise<IdeResult> {
  await ensureDir(join(cwd, '.claude'));
  await writeFile(join(cwd, 'CLAUDE.md'), await readTemplate('claude-md.txt'));
  await writeFile(join(cwd, '.claude', 'hooks.json'), await readTemplate('claude-hooks.json'));
  try {
    // -s user → register globally (all projects), written to ~/.claude.json.
    execSync('claude mcp add veilguard -s user -- npx -y --package=veilguard veilguard-mcp', {
      cwd,
      stdio: 'ignore',
    });
  } catch {
    // Claude Code CLI not installed — skip silently.
  }
  return {
    message: 'Claude Code: global MCP (user scope) + CLAUDE.md + .claude/hooks.json created',
    gitignore: ['CLAUDE.md', '.claude/hooks.json'],
  };
}

async function setupAntigravity(_cwd: string): Promise<IdeResult> {
  const configPath = join(homedir(), '.gemini', 'antigravity', 'mcp_config.json'); // global
  await mergeServer(configPath, 'mcpServers', STDIO_SERVER);
  // Lives in HOME, never in the repo — nothing to gitignore.
  return { message: `Antigravity: ${tildify(configPath)} (global) created`, gitignore: [] };
}

interface IdeOption {
  num: string;
  name: string;
  setup: (cwd: string) => Promise<IdeResult>;
}

const IDES: IdeOption[] = [
  { num: '1', name: 'Cursor', setup: setupCursor },
  { num: '2', name: 'VS Code', setup: setupVscode },
  { num: '3', name: 'Windsurf', setup: setupWindsurf },
  { num: '4', name: 'Claude Code', setup: setupClaude },
  { num: '5', name: 'Antigravity', setup: setupAntigravity },
];

const GITIGNORE_HEADER = '# Veilguard — local IDE setup (generated by `veilguard init`, not committed)';

// Add the files init created to .gitignore so they never get pushed to the repo.
// Creates .gitignore if the project doesn't have one. Returns how many entries
// were added (0 if everything was already listed).
async function ensureGitignored(cwd: string, entries: string[]): Promise<number> {
  const gitignorePath = join(cwd, '.gitignore');

  let content = '';
  let existed = true;
  try {
    content = await readFile(gitignorePath, 'utf-8');
  } catch {
    existed = false;
  }

  // Normalize existing lines (ignore trailing slashes) so we don't add duplicates.
  const present = new Set(
    content
      .split('\n')
      .map((line) => line.trim().replace(/\/+$/, ''))
      .filter(Boolean),
  );
  const missing = entries.filter((e) => !present.has(e.replace(/\/+$/, '')));
  if (missing.length === 0) return 0;

  let block = '';
  if (!content.includes(GITIGNORE_HEADER)) block += `${GITIGNORE_HEADER}\n`;
  block += missing.join('\n') + '\n';

  if (!existed || content.length === 0) {
    await writeFile(gitignorePath, block);
  } else {
    const sep = content.endsWith('\n') ? '\n' : '\n\n';
    await appendFile(gitignorePath, sep + block);
  }
  return missing.length;
}

function parseSelection(answer: string): Set<string> {
  const selected = new Set<string>();
  for (const token of answer.split(',').map((t) => t.trim()).filter(Boolean)) {
    if (token === '6') {
      for (const ide of IDES) selected.add(ide.num);
    } else if (IDES.some((ide) => ide.num === token)) {
      selected.add(token);
    }
  }
  return selected;
}

async function runInit(): Promise<void> {
  const cwd = process.cwd();

  process.stdout.write('🛡️  Veilguard — Silent security for vibe coders\n\n');
  process.stdout.write('Which IDE do you use? (enter number, or multiple separated by commas)\n\n');
  process.stdout.write('  1. Cursor\n');
  process.stdout.write('  2. VS Code\n');
  process.stdout.write('  3. Windsurf\n');
  process.stdout.write('  4. Claude Code\n');
  process.stdout.write('  5. Antigravity\n');
  process.stdout.write('  6. All of the above\n\n');

  const rl = createInterface({ input, output });
  const answer = await rl.question('> ');
  rl.close();

  const selected = parseSelection(answer);
  if (selected.size === 0) {
    process.stdout.write('\nNo valid selection. Run `veilguard init` again and pick 1–6.\n');
    return;
  }

  process.stdout.write('\n');
  const toIgnore = new Set<string>(['.veilguard/']);
  for (const ide of IDES) {
    if (!selected.has(ide.num)) continue;
    try {
      const result = await ide.setup(cwd);
      process.stdout.write(`  ✓ ${result.message}\n`);
      for (const path of result.gitignore) toIgnore.add(path);
    } catch (e) {
      process.stdout.write(`  ✗ ${ide.name}: ${(e as Error).message}\n`);
    }
  }

  const added = await ensureGitignored(cwd, [...toIgnore]);
  if (added > 0) {
    process.stdout.write(
      `  ✓ .gitignore: ${added} entr${added === 1 ? 'y' : 'ies'} added — these stay out of your repo\n`,
    );
  }

  process.stdout.write('\n');
  process.stdout.write('  Veilguard is ready. Restart your IDE to activate.\n');
  process.stdout.write('  Free: all 13 scanners active (depth-limited).\n');
  process.stdout.write('  Pro: add VEILGUARD_KEY → veilguard.dev/pro\n');
}

// ── command dispatch ──────────────────────────────────────────────────────────

const command = getCommand();

switch (command) {
  case 'init':
    runInit().catch((e) => {
      process.stderr.write(`Error: ${(e as Error).message}\n`);
      process.exit(1);
    });
    break;
  case 'quick-scan':
    quickScan().catch((e) => {
      process.stderr.write(`Error: ${(e as Error).message}\n`);
      process.exit(1);
    });
    break;
  case 'start':
  default:
    // Default: start MCP server (imported dynamically to avoid loading everything for CLI commands)
    import('./index.js');
    break;
}
