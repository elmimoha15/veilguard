import { readFile } from 'fs/promises';
import { join } from 'path';
import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import { logger } from '../utils/logger.js';
import { getPatternsDir } from '../utils/paths.js';
import { FREE_TIER_MAX_FINDINGS } from '../utils/constants.js';
import { getUpgradeMessage } from '../license/license.js';
import { classifyMatch, vetMatch } from '../utils/match-context.js';
import type { Finding, ScanResult, WebhookRule, Tier } from '../types.js';

// A webhook finding is only credible inside code that actually receives requests.
// SEO/marketing copy that merely *names* providers ("Webhook verification for
// Stripe, Paystack, …") lives in components with no handler and must be ignored.
function looksLikeServerHandler(filePath: string, content: string): boolean {
  const p = filePath.toLowerCase();
  if (
    p.includes('/api/') ||
    p.includes('/server/') ||
    p.includes('/routes/') ||
    p.includes('/handlers/') ||
    p.includes('/functions/') ||
    p.includes('/pages/api/') ||
    /route\.[cm]?[tj]s$/.test(p)
  ) {
    return true;
  }
  return (
    /\b(app|router)\.(post|put|patch|get|delete|use)\s*\(/.test(content) ||
    /export\s+(async\s+)?function\s+(POST|PUT|PATCH|GET|DELETE)\s*\(/.test(content) ||
    /export\s+const\s+(POST|PUT|PATCH|GET|DELETE)\s*=/.test(content) ||
    /exports\.handler\b/.test(content) ||
    /addEventListener\s*\(\s*['"`]fetch['"`]/.test(content) ||
    /\.on\s*\(\s*['"`]request['"`]/.test(content)
  );
}

// Drop matches that sit in prose, comments, JSX text, docs, or fixtures — but
// keep ordinary string literals (a webhook route path is legitimately a string).
function endpointMatchIsReal(
  filePath: string,
  content: string,
  lineIndex: number,
  column: number,
  matchText: string,
  rootDir: string,
): boolean {
  const c = classifyMatch({
    filePath,
    content,
    lineIndex,
    column,
    matchText,
    rootDir,
    mode: 'code-construct',
  });
  if (c.kind === 'doc-file' || c.kind === 'test-fixture') return false;
  if (c.kind === 'comment' || c.kind === 'jsx-text') return false;
  return !c.isProse;
}

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

function hasVerification(content: string, required: string[]): boolean {
  // Strip single-line comments to avoid false positives
  const codeOnly = content
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, ''))
    .join('\n');
  return required.some((pattern) => codeOnly.includes(pattern));
}

function checkMissingFailureHandlers(filePath: string, content: string): Finding[] {
  // Only check files that look like Stripe webhook handlers
  if (!/stripe/i.test(content)) return [];
  if (!/webhook/i.test(filePath) && !/webhook/i.test(content)) return [];
  
  const successEvents = [
    'charge.succeeded',
    'payment_intent.succeeded',
    'checkout.session.completed',
    'invoice.paid',
    'invoice.payment_succeeded',
  ];
  
  const failureEvents = [
    'invoice.payment_failed',
    'customer.subscription.deleted',
    'charge.dispute.created',
    'charge.failed',
    'payment_intent.payment_failed',
  ];
  
  const hasSuccessHandler = successEvents.some(event => content.includes(event));
  const hasFailureHandler = failureEvents.some(event => content.includes(event));
  
  if (hasSuccessHandler && !hasFailureHandler) {
    // Find the line with the success handler for better error location
    const lines = content.split('\n');
    let lineNum = 0;
    for (let i = 0; i < lines.length; i++) {
      if (successEvents.some(event => lines[i].includes(event))) {
        lineNum = i + 1;
        break;
      }
    }
    
    return [{
      id: 'webhook-missing-failure-handler',
      severity: 'critical',
      category: 'webhook',
      title: 'Missing payment failure handlers',
      message: `Your app unlocks access when payment succeeds but never locks it again when payment fails or a subscription is cancelled. Users can keep your product for free after their card is declined or they cancel. This is an ongoing silent revenue leak. Found in ${filePath}:${lineNum}`,
      file: filePath,
      line: lineNum,
      fix: 'Add handlers for invoice.payment_failed, customer.subscription.deleted, and charge.dispute.created to revoke access when payments fail.',
      cwe: 'CWE-840',
      breach_precedent: 'Silent revenue leak: SaaS apps lose thousands monthly when cancelled users retain access.',
    }];
  }
  
  return [];
}

async function scanFileForWebhooks(
  filePath: string,
  rules: WebhookRule[],
  rootDir: string,
): Promise<Finding[]> {
  const content = await readFileSafe(filePath);
  if (!content) return [];

  // Only real request-handling code can host a webhook bug. This single gate
  // removes the entire class of "marketing copy names a provider" false positives.
  if (!looksLikeServerHandler(filePath, content)) return [];

  const findings: Finding[] = [];
  const lines = content.split('\n');

  // Check for missing failure handlers (GAP 2)
  findings.push(...checkMissingFailureHandlers(filePath, content));

  for (const rule of rules) {
    for (const endpointPattern of rule.endpoint_patterns) {
      const regex = new RegExp(endpointPattern, 'i');

      for (let i = 0; i < lines.length; i++) {
        const m = regex.exec(lines[i]);
        if (!m) continue;
        if (!endpointMatchIsReal(filePath, content, i, m.index, m[0], rootDir)) break;
        // Found a real webhook endpoint — check if the file has verification
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
            confidence: 0.9,
          });
        }
        break; // Only flag once per rule per file
      }
    }

    // Check for exec/eval in webhook handlers (command injection)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = /\b(exec|execSync|eval)\s*\(/.exec(line);
      if (/webhook/i.test(content) && m) {
        const vetted = vetMatch(
          {
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
          },
          { filePath, content, lineIndex: i, column: m.index, matchText: m[0], rootDir, mode: 'code-construct' },
        );
        if (vetted) findings.push(vetted);
      }
    }
  }

  return findings;
}

export async function scanWebhooks(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const rules = await loadRules();
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx', '.mjs']);

  const allFindings: Finding[] = [];
  for (const file of files) {
    const findings = await scanFileForWebhooks(file, rules, directory);
    allFindings.push(...findings);
  }

  return {
    scanner: 'scan_webhooks',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings: allFindings,
  };
}

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
