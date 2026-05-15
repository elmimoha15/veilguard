#!/usr/bin/env node
import { scanSecrets } from './scanners/secret-scanner.js';
import { checkEnv } from './scanners/env-checker.js';
import { scanInjection } from './scanners/injection-scanner.js';
import { scanWebhooks } from './scanners/webhook-scanner.js';

function getCommand(): string {
  return process.argv[2] || 'start';
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
