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
import { calculateScore, summarizeFindings, generateFixPrompt } from './scoring.js';
import { checkAuditLimit, incrementAuditUsage } from '../license/license.js';
import { logger } from '../utils/logger.js';
import type { AuditReport, ScanResult, Tier } from '../types.js';

/** Run the full security audit (PRO, 3/month) */
export async function runFullAudit(directory: string, tier: Tier): Promise<AuditReport | string> {
  // Check audit limit
  const limitCheck = await checkAuditLimit();
  if (!limitCheck.allowed) {
    return limitCheck.message!;
  }

  const start = Date.now();
  logger.info('Starting full security audit...');

  const scans: ScanResult[] = [];

  // Run all scanners in sequence
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

  // Increment audit counter
  await incrementAuditUsage();

  const report: AuditReport = {
    score,
    grade,
    timestamp: new Date().toISOString(),
    scans,
    summary,
    fix_prompt: fixPrompt,
  };

  logger.info(`Audit complete: Grade ${grade} (${score}/100) in ${Date.now() - start}ms`);
  return report;
}

/**
 * Plain-English consequence per scanner. The end user is a non-technical "vibe coder",
 * so we describe what will actually happen to them if the issue is not fixed — never
 * the scanner name, file path, or any technical jargon.
 */
const SCANNER_CONSEQUENCES: Record<string, string> = {
  check_cors:
    "Hackers can call your API from any website on the internet and steal your users' data",
  check_env:
    'Your secret API keys are exposed and could be stolen from your git history',
  check_supabase_rls:
    "Any logged-in user can read, edit or delete every other user's data",
  scan_webhooks: 'Anyone can fake a payment and get your product for free',
  scan_secrets:
    'Your API keys are hardcoded — anyone who sees your code can steal them',
  scan_injection:
    'Attackers can manipulate your database or run commands on your server',
  check_headers:
    'Your app has no browser protection — users are vulnerable to clickjacking',
  check_auth_config:
    'Your authentication setup has gaps that could let attackers hijack accounts',
  scan_dependencies: 'One of your npm packages has a known security vulnerability',
  check_supply_chain: 'A suspicious package in your project could be stealing data',
  check_git: 'Sensitive files or secrets have been committed to your git history',
  check_firebase:
    'Your Firebase database is wide open — anyone can read or write all data',
};

/** Format the full audit report in plain English for non-technical users. */
export function formatAuditReport(report: AuditReport): string {
  const lines: string[] = [
    '🛡️ Veilguard Security Audit',
    '',
    `Grade: ${report.grade} (Score: ${report.score}/100)`,
    '',
  ];

  // If the grade is A or A+, the app passed — skip findings entirely.
  if (report.grade === 'A' || report.grade === 'A+') {
    lines.push('✅ Your app passed the security audit. Safe to deploy.');
    return lines.join('\n');
  }

  // Collect one plain-English consequence per scanner per severity bucket.
  // A scanner shows up under "critical" if it produced any critical finding;
  // otherwise under "warnings" if it produced any warning finding.
  const criticalScanners = new Set<string>();
  const warningScanners = new Set<string>();

  for (const scan of report.scans) {
    const hasCritical = scan.findings.some((f) => f.severity === 'critical');
    const hasWarning = scan.findings.some((f) => f.severity === 'warning');
    if (hasCritical) criticalScanners.add(scan.scanner);
    else if (hasWarning) warningScanners.add(scan.scanner);
  }

  const criticalMessages = [...criticalScanners]
    .map((s) => SCANNER_CONSEQUENCES[s])
    .filter((m): m is string => Boolean(m));
  const warningMessages = [...warningScanners]
    .map((s) => SCANNER_CONSEQUENCES[s])
    .filter((m): m is string => Boolean(m));

  if (criticalMessages.length > 0) {
    const word = criticalMessages.length === 1 ? 'issue' : 'issues';
    lines.push(
      `Your app has ${criticalMessages.length} critical ${word}. Do NOT deploy until these are fixed:`,
    );
    lines.push('');
    for (const msg of criticalMessages) lines.push(`🔴 ${msg}`);
    lines.push('');
  }

  if (warningMessages.length > 0) {
    lines.push(
      `⚠️ ${warningMessages.length} ${warningMessages.length === 1 ? 'warning' : 'warnings'} (less urgent but should be fixed):`,
    );
    for (const msg of warningMessages) lines.push(`🟡 ${msg}`);
    lines.push('');
  }

  if (criticalMessages.length === 0 && warningMessages.length === 0) {
    lines.push('✅ No critical issues or warnings found.');
    return lines.join('\n');
  }

  if (criticalMessages.length > 0) {
    lines.push(`Type "fix all critical issues" and I'll patch everything now.`);
  } else {
    lines.push(`Type "fix all warnings" and I'll patch everything now.`);
  }

  return lines.join('\n');
}
