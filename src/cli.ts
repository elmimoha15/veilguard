#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { getTemplatesDir } from './utils/paths.js';
import { scanSecrets } from './scanners/secret-scanner.js';
import { checkEnv } from './scanners/env-checker.js';
import { scanInjection } from './scanners/injection-scanner.js';
import { scanWebhooks } from './scanners/webhook-scanner.js';

const templatesDir = getTemplatesDir();

function getCommand(): string {
  return process.argv[2] || 'start';
}

/** Read the MCP config template */
function getMcpConfig(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(templatesDir, 'mcp-config.json'), 'utf-8'));
}

/** Copy a template file to the project */
function copyTemplate(templateName: string, destPath: string, append = false): void {
  try {
    const content = readFileSync(join(templatesDir, templateName), 'utf-8');
    if (append && existsSync(destPath)) {
      const existing = readFileSync(destPath, 'utf-8');
      if (!existing.includes('Veilguard Security Rules')) {
        appendFileSync(destPath, '\n\n' + content);
      }
    } else {
      writeFileSync(destPath, content);
    }
  } catch (error) {
    process.stderr.write(`Warning: Could not copy ${templateName}: ${(error as Error).message}\n`);
  }
}

/** Add MCP config to an IDE's config file */
function addMcpConfig(configPath: string): void {
  try {
    const mcpConfig = readFileSync(join(templatesDir, 'mcp-config.json'), 'utf-8');
    const config = JSON.parse(mcpConfig);

    if (existsSync(configPath)) {
      const existing = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (!existing.mcpServers?.veilguard) {
        existing.mcpServers = { ...existing.mcpServers, ...config.mcpServers };
        writeFileSync(configPath, JSON.stringify(existing, null, 2));
      }
    } else {
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  } catch (error) {
    process.stderr.write(`Warning: Could not add MCP config to ${configPath}: ${(error as Error).message}\n`);
  }
}

/** Add .veilguard/ to .gitignore */
function updateGitignore(dir: string): void {
  const gitignorePath = join(dir, '.gitignore');
  try {
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf-8');
      if (!content.includes('.veilguard')) {
        appendFileSync(gitignorePath, '\n# Veilguard scan results\n.veilguard/\n');
      }
    }
  } catch {
    // Non-critical
  }
}

/** Initialize Veilguard for the current project */
function init(): void {
  const dir = process.cwd();
  const mcpConfig = getMcpConfig();
  const mcpJson = JSON.stringify(mcpConfig, null, 2);

  process.stdout.write('\n  🛡️  Veilguard — Silent security for vibe coders\n\n');

  // ── 1. Rules files (all IDEs — they don't conflict) ────────────────
  copyTemplate('cursorrules.txt', join(dir, '.cursorrules'), true);
  copyTemplate('windsurfrules.txt', join(dir, '.windsurfrules'), true);
  copyTemplate('claude-md.txt', join(dir, 'CLAUDE.md'), true);
  copyTemplate('antigravityrules.txt', join(dir, '.antigravityrules'), true);

  const claudeDir = join(dir, '.claude');
  if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
  copyTemplate('claude-hooks.json', join(claudeDir, 'hooks.json'));

  process.stdout.write('  ✓ Security rules installed\n');
  process.stdout.write('    .cursorrules          (Cursor + VS Code)\n');
  process.stdout.write('    .windsurfrules        (Windsurf)\n');
  process.stdout.write('    CLAUDE.md             (Claude Code)\n');
  process.stdout.write('    .antigravityrules     (Antigravity)\n');
  process.stdout.write('    .claude/hooks.json    (Claude Code post-save hooks)\n');

  // ── 2. Project-level MCP configs ───────────────────────────────────
  addMcpConfig(join(dir, '.cursor', 'mcp.json'));
  addMcpConfig(join(dir, '.vscode', 'mcp.json'));
  addMcpConfig(join(dir, '.claude', 'mcp.json'));
  addMcpConfig(join(dir, '.gemini', 'mcp.json'));

  process.stdout.write('\n  ✓ MCP config added for:\n');
  process.stdout.write('    .cursor/mcp.json      (Cursor)\n');
  process.stdout.write('    .vscode/mcp.json      (VS Code)\n');
  process.stdout.write('    .claude/mcp.json      (Claude Code)\n');
  process.stdout.write('    .gemini/mcp.json      (Antigravity)\n');

  // ── 3. Windsurf uses a global config — print instructions ──────────
  const windsurfGlobal = join(homedir(), '.windsurf', 'mcp.json');
  if (existsSync(windsurfGlobal)) {
    // Try to add to existing config
    try {
      const existing = JSON.parse(readFileSync(windsurfGlobal, 'utf-8'));
      if (!existing.mcpServers?.veilguard) {
        existing.mcpServers = { ...existing.mcpServers, ...(mcpConfig as Record<string, unknown>).mcpServers as Record<string, unknown> };
        writeFileSync(windsurfGlobal, JSON.stringify(existing, null, 2));
        process.stdout.write('    ~/.windsurf/mcp.json  (Windsurf — updated)\n');
      } else {
        process.stdout.write('    ~/.windsurf/mcp.json  (Windsurf — already configured)\n');
      }
    } catch {
      process.stdout.write(`\n  ⚠ Windsurf: could not update ~/.windsurf/mcp.json\n`);
      process.stdout.write(`    Add this to ~/.windsurf/mcp.json manually:\n\n`);
      process.stdout.write(`    ${mcpJson.replace(/\n/g, '\n    ')}\n`);
    }
  } else if (existsSync(join(homedir(), '.windsurf'))) {
    // ~/.windsurf exists but no mcp.json yet
    try {
      writeFileSync(windsurfGlobal, mcpJson);
      process.stdout.write('    ~/.windsurf/mcp.json  (Windsurf — created)\n');
    } catch {
      process.stdout.write(`\n  ⚠ Windsurf: add this to ~/.windsurf/mcp.json:\n\n`);
      process.stdout.write(`    ${mcpJson.replace(/\n/g, '\n    ')}\n`);
    }
  } else {
    process.stdout.write('\n  ℹ Windsurf users: add the MCP config to ~/.windsurf/mcp.json\n');
    process.stdout.write('    See: https://veilguard.dev/docs/installation/windsurf\n');
  }

  // ── 4. Gitignore ──────────────────────────────────────────────────
  updateGitignore(dir);

  // ── 5. Done ────────────────────────────────────────────────────────
  process.stdout.write('\n  ✅ Veilguard is ready. Restart your IDE to activate.\n');
  process.stdout.write('  Free: all 13 scanners active.\n');
  process.stdout.write('  Pro: add VEILGUARD_KEY to your MCP config → veilguard.dev/pro\n\n');
}

/** Quick scan for Claude Code hooks (fast, single file or directory) */
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

// ─── Main CLI Router ────────────────────────────────────────

const command = getCommand();

switch (command) {
  case 'init':
    init();
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
