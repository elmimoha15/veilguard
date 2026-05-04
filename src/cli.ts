#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { getTemplatesDir } from './utils/paths.js';
import { scanSecrets } from './scanners/secret-scanner.js';
import { checkEnv } from './scanners/env-checker.js';
import { scanInjection } from './scanners/injection-scanner.js';
import { scanWebhooks } from './scanners/webhook-scanner.js';

const templatesDir = getTemplatesDir();

function getCommand(): string {
  return process.argv[2] || 'start';
}

/** Detect which IDEs are present in the current directory */
function detectIDEs(dir: string): string[] {
  const ides: string[] = [];
  if (existsSync(join(dir, '.cursor'))) ides.push('cursor');
  if (existsSync(join(dir, '.vscode'))) ides.push('vscode');
  if (existsSync(join(dir, '.windsurf'))) ides.push('windsurf');
  if (existsSync(join(dir, '.claude')) || existsSync(join(dir, 'CLAUDE.md'))) ides.push('claude');
  if (existsSync(join(dir, '.idea'))) ides.push('jetbrains');
  if (existsSync(join(dir, '.gemini'))) ides.push('antigravity');
  return ides;
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
  const ides = detectIDEs(dir);

  process.stdout.write('\n  🛡️  Veilguard — Silent security for vibe coders\n\n');

  if (ides.length === 0) {
    process.stdout.write('  No IDE config detected. Setting up with universal MCP config.\n');
    ides.push('universal');
  }

  for (const ide of ides) {
    switch (ide) {
      case 'cursor':
        copyTemplate('cursorrules.txt', join(dir, '.cursorrules'), true);
        addMcpConfig(join(dir, '.cursor', 'mcp.json'));
        process.stdout.write('  ✓ Cursor: .cursorrules + .cursor/mcp.json\n');
        break;
      case 'vscode':
        addMcpConfig(join(dir, '.vscode', 'mcp.json'));
        process.stdout.write('  ✓ VS Code: .vscode/mcp.json\n');
        break;
      case 'windsurf':
        copyTemplate('windsurfrules.txt', join(dir, '.windsurfrules'), true);
        addMcpConfig(join(dir, '.windsurf', 'mcp.json'));
        process.stdout.write('  ✓ Windsurf: .windsurfrules + .windsurf/mcp.json\n');
        break;
      case 'claude':
        copyTemplate('claude-md.txt', join(dir, 'CLAUDE.md'), true);
        addMcpConfig(join(dir, '.claude', 'mcp.json'));
        if (existsSync(join(dir, '.claude'))) {
          copyTemplate('claude-hooks.json', join(dir, '.claude', 'hooks.json'));
          process.stdout.write('  ✓ Claude Code: CLAUDE.md + .claude/mcp.json + hooks\n');
        } else {
          process.stdout.write('  ✓ Claude Code: CLAUDE.md + .claude/mcp.json\n');
        }
        break;
      case 'jetbrains':
        process.stdout.write('  ✓ JetBrains: Add manually in Settings → Tools → MCP Server\n');
        process.stdout.write('    Command: npx  Args: -y @veilguard/cli\n');
        break;
      case 'antigravity':
        copyTemplate('antigravityrules.txt', join(dir, '.antigravityrules'), true);
        addMcpConfig(join(dir, '.gemini', 'mcp.json'));
        process.stdout.write('  ✓ Antigravity: .antigravityrules + .gemini/mcp.json\n');
        break;
      default:
        process.stdout.write('  ✓ MCP config ready. Add to your IDE manually.\n');
        break;
    }
  }

  updateGitignore(dir);

  process.stdout.write('\n  Veilguard is now protecting this project.\n');
  process.stdout.write('  Free users: all 13 scanners active (depth-limited).\n');
  process.stdout.write('  Pro users: add VEILGUARD_KEY to your MCP config.\n');
  process.stdout.write('  → veilguard.dev/pro\n\n');
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
