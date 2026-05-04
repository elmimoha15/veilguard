import { readFile } from 'fs/promises';
import { join } from 'path';
import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import { logger } from '../utils/logger.js';
import { getPatternsDir } from '../utils/paths.js';
import { FREE_TIER_MAX_FINDINGS } from '../utils/constants.js';
import { getUpgradeMessage } from '../license/license.js';
import type { Finding, ScanResult, WebhookRule, Tier } from '../types.js';

let rulesCache: WebhookRule[] | null = null;

async function loadRules(): Promise<WebhookRule[]> {
  if (rulesCache) return rulesCache;
  try {
    const rulesPath = join(getPatternsDir(), 'webhook-rules.json');
    const raw = await readFile(rulesPath, 'utf-8');
    rulesCache = JSON.parse(raw) as WebhookRule[];
    return rulesCache;
  } catch (error) {
    logger.error(`Failed to load webhook rules: ${(error as Error).message}`);
    return [];
  }
}

/** Check if file content contains any of the required verification patterns (ignoring comments) */
function hasVerification(content: string, required: string[]): boolean {
  // Strip single-line comments to avoid false positives
  const codeOnly = content
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''))
    .join('\n');
  return required.some((pattern) => codeOnly.includes(pattern));
}

/** Scan a file for webhook endpoints missing verification */
async function scanFileForWebhooks(
  filePath: string,
  rules: WebhookRule[],
): Promise<Finding[]> {
  const content = await readFileSafe(filePath);
  if (!content) return [];

  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (const rule of rules) {
    for (const endpointPattern of rule.endpoint_patterns) {
      const regex = new RegExp(endpointPattern, 'i');

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          // Found a webhook endpoint — check if the file has verification
          if (!hasVerification(content, rule.required_verification)) {
            findings.push({
              id: `webhook-unverified-${rule.provider}`,
              severity: rule.severity,
              category: 'webhook',
              title: `Unverified ${rule.provider} webhook`,
              message: `${rule.provider} webhook endpoint at ${filePath}:${i + 1} is missing signature verification.`,
              file: filePath,
              line: i + 1,
              fix: rule.fix,
              cwe: 'CWE-345',
              breach_precedent: rule.breach_precedent,
            });
          }
          break; // Only flag once per rule per file
        }
      }
    }

    // Check for exec/eval in webhook handlers (command injection)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/webhook/i.test(content) && /\b(exec|execSync|eval)\s*\(/.test(line)) {
        findings.push({
          id: 'webhook-command-injection',
          severity: 'critical',
          category: 'webhook',
          title: 'Command injection in webhook handler',
          message: `exec/eval called inside webhook handler at ${filePath}:${i + 1}. Attackers can inject commands via webhook payload.`,
          file: filePath,
          line: i + 1,
          fix: 'Never pass webhook payload data to exec/eval. Use a whitelist of allowed actions.',
          cwe: 'CWE-78',
          breach_precedent: 'CurXecute-style attacks: unverified webhooks allow arbitrary command execution.',
        });
      }
    }
  }

  return findings;
}

/** Run the webhook scanner */
export async function scanWebhooks(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const rules = await loadRules();
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx', '.mjs']);

  const allFindings: Finding[] = [];
  for (const file of files) {
    const findings = await scanFileForWebhooks(file, rules);
    allFindings.push(...findings);
  }

  return {
    scanner: 'scan_webhooks',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings: allFindings,
  };
}

/** Format webhook results with tier-aware depth */
export function formatWebhookResults(result: ScanResult, tier: Tier): string {
  const { findings } = result;

  if (findings.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nWebhook endpoints verified. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [
    `~~ veilguard ~~ ${findings.length} webhook issue${findings.length > 1 ? 's' : ''} found`,
    '',
  ];

  const visible = tier === 'pro' ? findings : findings.slice(0, FREE_TIER_MAX_FINDINGS);
  const hidden = findings.length - visible.length;

  for (const f of visible) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    if (tier === 'pro' && f.fix) lines.push(`  Fix: ${f.fix}`);
    else if (tier === 'free') lines.push('  Fix: [Upgrade to Pro to see fix]');
    if (tier === 'pro' && f.breach_precedent) lines.push(`  Breach: ${f.breach_precedent}`);
    lines.push('');
  }

  if (hidden > 0) lines.push(getUpgradeMessage(hidden));
  return lines.join('\n');
}
