import { scanSecrets } from './secret-scanner.js';
import { checkEnv } from './env-checker.js';
import { checkGit } from './git-checker.js';
import { checkAuthConfig } from './auth-config-checker.js';
import { scanWebhooks } from './webhook-scanner.js';
import { scanInjection } from './injection-scanner.js';
import { checkCors } from './cors-scanner.js';
import { checkSupplyChain } from './supply-chain-checker.js';
import { scanDependencies } from './dependency-checker.js';
import { analyzeRls } from './rls-analyzer.js';
import { analyzeFirebase } from './firebase-analyzer.js';
import { scanAppSecurity } from './app-security-scanner.js';
import { scanRulesFiles } from './rules-file-scanner.js';
import { calculateScore, summarizeFindings, generateFixPrompt, gradeMeaning } from './scoring.js';
import { checkAuditLimit, incrementAuditUsage } from '../license/license.js';
import { logger } from '../utils/logger.js';
import type { AuditReport, ScanResult, Tier } from '../types.js';

export async function runAllScanners(directory: string, tier: Tier): Promise<AuditReport> {
  const start = Date.now();
  logger.info('Running all security scanners...');

  const scans: ScanResult[] = [];

  const scanners: Array<{ name: string; fn: () => Promise<ScanResult> }> = [
    { name: 'secrets', fn: () => scanSecrets(directory, tier) },
    { name: 'env', fn: () => checkEnv(directory, tier) },
    { name: 'git', fn: () => checkGit(directory, tier) },
    { name: 'auth', fn: () => checkAuthConfig(directory, tier) },
    { name: 'webhooks', fn: () => scanWebhooks(directory, tier) },
    { name: 'injection', fn: () => scanInjection(directory, tier) },
    { name: 'cors', fn: () => checkCors(directory, tier) },
    { name: 'supply-chain', fn: () => checkSupplyChain(directory, tier) },
    { name: 'dependencies', fn: () => scanDependencies(directory, tier) },
    { name: 'rls', fn: () => analyzeRls(directory, tier) },
    { name: 'firebase', fn: () => analyzeFirebase(directory, tier) },
    { name: 'app-security', fn: () => scanAppSecurity(directory, tier) },
    { name: 'rules-files', fn: () => scanRulesFiles(directory, tier) },
  ];

  for (const { name, fn } of scanners) {
    try {
      logger.debug(`Running ${name} scanner...`);
      const result = await fn();
      scans.push(result);
    } catch (error) {
      logger.error(`Scanner ${name} failed: ${(error as Error).message}`);
    }
  }

  const allFindings = scans.flatMap((s) => s.findings);
  const { score, grade } = calculateScore(allFindings);
  const summary = summarizeFindings(allFindings);
  const fixPrompt = generateFixPrompt(scans);

  const report: AuditReport = {
    score,
    grade,
    timestamp: new Date().toISOString(),
    scans,
    summary,
    fix_prompt: fixPrompt,
  };

  logger.info(`Scans complete: Grade ${grade} (${score}/100) in ${Date.now() - start}ms`);
  return report;
}

export async function runFullAudit(directory: string, tier: Tier): Promise<AuditReport | string> {
  const limitCheck = await checkAuditLimit();
  if (!limitCheck.allowed) {
    return limitCheck.message!;
  }

  const report = await runAllScanners(directory, tier);
  await incrementAuditUsage();
  return report;
}

const DIVIDER = '─────────────────────────────';

// plain-English consequences keyed by finding id, then category, then scanner
const ID_CONSEQUENCES: Record<string, string> = {
  // IDOR
  'injection-idor-params-id':
    "Other users can view, edit or delete data that isn't theirs by changing the ID in the URL",
  'injection-idor-prisma-where-id-only':
    "Other users can view, edit or delete data that isn't theirs by changing the ID in the URL",
  'idor-handler-scope':
    "Other users can view, edit or delete data that isn't theirs by changing the ID in the URL",
  // Mass assignment
  'injection-mass-assignment-spread':
    'Users can grant themselves admin or modify protected fields by sending extra data in their request',
  'injection-mass-assignment-object-assign':
    'Users can grant themselves admin or modify protected fields by sending extra data in their request',
  // Rate limiting
  'rate-limit-missing-payment':
    'Your payment endpoint can be hammered by attackers and rack up huge Stripe fees overnight',
  'rate-limit-missing-post':
    'Your API can be spammed or brute-forced because nothing limits how fast requests come in',
  'auth-no-rate-limit':
    'Attackers can brute-force user passwords because your login route has no rate limiting',
  // Password
  'auth-password-plaintext-insert':
    'User passwords are being stored in plain text — one database leak exposes every account',
  'auth-password-md5':
    'Passwords are hashed with a broken algorithm (MD5) — attackers can crack them in seconds',
  'auth-password-sha1':
    'Passwords are hashed with a broken algorithm (SHA-1) — attackers can crack them quickly',
  'auth-password-sha256-unsalted':
    'Passwords use a fast hash with no salt — easy for attackers to reverse with rainbow tables',
  'auth-bcrypt-low-cost':
    "Your bcrypt cost is too low — modern GPUs can brute-force passwords much faster than they should",
  'password-plaintext-compare':
    "Passwords are compared as plain text — they aren't actually being hashed",
  // Open redirect
  'auth-open-redirect-query':
    'Attackers can use your site to redirect victims to phishing pages while looking legitimate',
  'auth-open-redirect-window':
    'Attackers can use your site to redirect victims to phishing pages while looking legitimate',
  // File uploads
  'upload-no-size-limit':
    'Anyone can crash your server by uploading huge files until your disk fills up',
  'upload-no-type-filter':
    'Users can upload malicious files (scripts, executables) because no file types are blocked',
  'upload-public-dir':
    "User uploads land in a public folder — anyone who guesses the URL can download them",
  // Errors / logs
  'error-stack-exposed':
    'Your error messages leak internal file paths and stack traces to attackers',
  'sensitive-log':
    "You're logging passwords, tokens, or emails — anyone with log access can read them",
};

const CATEGORY_CONSEQUENCES: Record<string, string> = {
  secret: 'Your API keys are hardcoded in your source code — anyone who sees your code can steal them',
  webhook: 'Anyone can fake a payment and get your product for free',
  injection: 'Attackers can manipulate your database or run commands on your server',
  idor: "Other users can view, edit or delete data that isn't theirs",
  cors: "Hackers can call your API from any website on the internet and steal your users' data",
  env: 'Your secret API keys are exposed and could be stolen from your git history',
  rls: "Any logged-in user can read, edit or delete every other user's data",
  firebase: 'Your Firebase database is wide open — anyone can read or write all data',
  auth: 'Your authentication setup has gaps that could let attackers hijack accounts',
  headers: 'Your app has no browser protection — users are vulnerable to clickjacking',
  dependency: 'One of your npm packages has a known security vulnerability',
  'supply-chain': 'A suspicious package in your project could be stealing data',
  git: 'Sensitive files or secrets have been committed to your git history',
  'rate-limit': 'Your endpoints can be brute-forced or spammed because nothing limits request rate',
  upload: 'Users can upload malicious files because your uploads have no protection',
  'error-exposure': 'Your error messages leak internal details to attackers',
  logging: "You're logging sensitive data like passwords, tokens, or emails",
};

const SCANNER_CONSEQUENCES: Record<string, string> = {
  check_cors: CATEGORY_CONSEQUENCES.cors,
  check_env: CATEGORY_CONSEQUENCES.env,
  check_supabase_rls: CATEGORY_CONSEQUENCES.rls,
  scan_webhooks: CATEGORY_CONSEQUENCES.webhook,
  scan_secrets: CATEGORY_CONSEQUENCES.secret,
  scan_injection: CATEGORY_CONSEQUENCES.injection,
  check_headers: CATEGORY_CONSEQUENCES.headers,
  check_auth_config: CATEGORY_CONSEQUENCES.auth,
  scan_dependencies: CATEGORY_CONSEQUENCES.dependency,
  check_supply_chain: CATEGORY_CONSEQUENCES['supply-chain'],
  check_git: CATEGORY_CONSEQUENCES.git,
  check_firebase: CATEGORY_CONSEQUENCES.firebase,
  scan_app_security: 'Your application logic has security gaps that attackers commonly exploit',
};

const SCANNER_PASSED_LABEL: Record<string, string> = {
  scan_secrets: 'No hardcoded API keys or secrets found in your source code',
  check_env: 'Environment variables are properly configured',
  check_git: 'Git history is clean',
  check_auth_config: 'Authentication setup looks solid',
  scan_webhooks: 'Webhook handlers verify signatures correctly',
  scan_injection: 'No SQL injection or unsafe input found',
  check_cors: 'CORS is configured safely',
  check_supply_chain: 'No malicious or typosquatted packages detected',
  scan_dependencies: 'No dependency vulnerabilities found',
  check_supabase_rls: 'Supabase Row Level Security policies look safe',
  check_firebase: 'Firebase security rules look safe',
  check_headers: 'Security headers are in place',
  scan_app_security: 'App-layer checks passed (rate limiting, IDOR, uploads, logging, etc.)',
};

function findingConsequence(f: import('../types.js').Finding, scanner: string): string {
  return (
    ID_CONSEQUENCES[f.id] ||
    (f.category && CATEGORY_CONSEQUENCES[f.category]) ||
    SCANNER_CONSEQUENCES[scanner] ||
    f.title
  );
}

interface RenderedFinding {
  consequence: string;
  file?: string;
  line?: number;
  fix?: string;
}

function collectRendered(report: AuditReport, severity: 'critical' | 'warning'): RenderedFinding[] {
  const out: RenderedFinding[] = [];
  for (const scan of report.scans) {
    for (const f of scan.findings) {
      if (f.severity !== severity) continue;
      out.push({
        consequence: findingConsequence(f, scan.scanner),
        file: f.file,
        line: f.line,
        fix: f.fix,
      });
    }
  }
  return out;
}

function renderFindingBlock(
  lines: string[],
  rendered: RenderedFinding[],
  startNumber: number,
  includeFix: boolean,
): number {
  let n = startNumber;
  for (const r of rendered) {
    lines.push(`${n}. ${r.consequence}`);
    if (r.file) {
      lines.push(`   → File: ${r.file}${r.line ? ':' + r.line : ''}`);
    }
    if (includeFix && r.fix) {
      lines.push(`   → Fix: ${r.fix}`);
    }
    lines.push('');
    n++;
  }
  return n;
}

function buildPassedSection(report: AuditReport): string[] {
  const passed: string[] = [];
  for (const scan of report.scans) {
    const hasIssue = scan.findings.some(
      (f) => f.severity === 'critical' || f.severity === 'warning',
    );
    if (hasIssue) continue;
    const label = SCANNER_PASSED_LABEL[scan.scanner];
    if (label) passed.push(label);
  }
  return passed;
}

export function formatAuditReport(report: AuditReport): string {
  const criticals = collectRendered(report, 'critical');
  const warnings = collectRendered(report, 'warning');
  const total = criticals.length + warnings.length;

  const lines: string[] = [];
  lines.push('🛡️ Veilguard Security Audit');
  lines.push(DIVIDER);
  lines.push('');
  lines.push(
    `Grade: ${report.grade}  |  Score: ${report.score}/100  |  Found: ${total} ${total === 1 ? 'issue' : 'issues'}`,
  );
  lines.push('');

  if (criticals.length > 0) {
    lines.push(DIVIDER);
    lines.push(
      `🔴 CRITICAL — Fix before deploying (${criticals.length} ${criticals.length === 1 ? 'issue' : 'issues'})`,
    );
    lines.push(DIVIDER);
    const next = renderFindingBlock(lines, criticals, 1, true);
    if (warnings.length > 0) {
      lines.push(DIVIDER);
      lines.push(
        `🟡 WARNINGS — Fix soon (${warnings.length} ${warnings.length === 1 ? 'issue' : 'issues'})`,
      );
      lines.push(DIVIDER);
      renderFindingBlock(lines, warnings, next, true);
    }
  } else if (warnings.length > 0) {
    lines.push(DIVIDER);
    lines.push(
      `🟡 WARNINGS — Fix soon (${warnings.length} ${warnings.length === 1 ? 'issue' : 'issues'})`,
    );
    lines.push(DIVIDER);
    renderFindingBlock(lines, warnings, 1, true);
  } else {
    lines.push(DIVIDER);
    lines.push('✅ Nothing critical, nothing to warn about. Excellent work.');
    lines.push(DIVIDER);
    lines.push('');
  }

  // Grade meaning
  lines.push(DIVIDER);
  lines.push('📊 What this grade means');
  lines.push(DIVIDER);
  lines.push(gradeMeaning(report.grade));
  lines.push('');

  // AI Fix Prompt (only when there is something to fix)
  if (total > 0) {
    lines.push(DIVIDER);
    lines.push('🔧 AI Fix Prompt');
    lines.push(DIVIDER);
    lines.push('Copy and paste this into your AI agent to fix everything at once:');
    lines.push('');
    lines.push(report.fix_prompt);
    lines.push('');
  }

  // What passed
  const passed = buildPassedSection(report);
  if (passed.length > 0) {
    lines.push(DIVIDER);
    lines.push(`✅ What passed (${passed.length} ${passed.length === 1 ? 'check' : 'checks'})`);
    lines.push(DIVIDER);
    for (const p of passed) lines.push(`• ${p}`);
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

export function formatLockedAuditReport(report: AuditReport): string {
  const criticals = collectRendered(report, 'critical');
  const warnings = collectRendered(report, 'warning');
  const total = criticals.length + warnings.length;

  const lines: string[] = [];
  lines.push('🛡️ Veilguard Security Audit');
  lines.push(DIVIDER);
  lines.push('');
  lines.push(`Found: ${total} ${total === 1 ? 'issue' : 'issues'}`);
  lines.push('');

  if (criticals.length > 0) {
    lines.push(DIVIDER);
    lines.push(
      `🔴 CRITICAL — Fix before deploying (${criticals.length} ${criticals.length === 1 ? 'issue' : 'issues'})`,
    );
    lines.push(DIVIDER);
    renderFindingBlock(lines, criticals, 1, true);
  }

  if (warnings.length > 0) {
    lines.push(DIVIDER);
    lines.push(
      `🟡 WARNINGS — Fix soon (${warnings.length} ${warnings.length === 1 ? 'issue' : 'issues'})`,
    );
    lines.push(DIVIDER);
    renderFindingBlock(lines, warnings, criticals.length + 1, true);
  }

  if (total === 0) {
    lines.push(DIVIDER);
    lines.push('✅ No critical issues or warnings were found in this scan.');
    lines.push(DIVIDER);
    lines.push('');
  }

  // What passed
  const passed = buildPassedSection(report);
  if (passed.length > 0) {
    lines.push(DIVIDER);
    lines.push(`✅ What passed (${passed.length} ${passed.length === 1 ? 'check' : 'checks'})`);
    lines.push(DIVIDER);
    for (const p of passed) lines.push(`• ${p}`);
    lines.push('');
  }

  // Locked grade upsell — replaces the grade + AI fix prompt sections.
  lines.push(DIVIDER);
  lines.push('🔒 Your security grade is locked');
  lines.push(DIVIDER);
  lines.push('');
  lines.push('Veilguard scanned your project and found the issues above.');
  lines.push('To unlock your grade (A+ to F), detailed fix instructions,');
  lines.push('and AI-ready fix prompt:');
  lines.push('');
  lines.push('→ veilguard.dev/pro — $15/month, unlimited full audits');
  lines.push('');
  lines.push('Add VEILGUARD_KEY to your MCP config and run full audit again.');

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}
