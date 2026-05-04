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

/** Format the full audit report */
export function formatAuditReport(report: AuditReport): string {
  const lines: string[] = [
    `~~ veilguard ~~ Full Security Audit`,
    '',
    `Grade: ${report.grade} (${report.score}/100)`,
    '',
    `Summary:`,
    `  ${report.summary.critical} critical · ${report.summary.warning} warnings · ${report.summary.info} info · ${report.summary.passed} passed`,
    '',
  ];

  // Group findings by severity
  const criticals = report.scans.flatMap((s) => s.findings).filter((f) => f.severity === 'critical');
  const warnings = report.scans.flatMap((s) => s.findings).filter((f) => f.severity === 'warning');

  if (criticals.length > 0) {
    lines.push('⚠️ CRITICAL — must fix before deploy:');
    for (const f of criticals) {
      lines.push(`  • ${f.title}`);
      lines.push(`    ${f.message}`);
      if (f.fix) lines.push(`    Fix: ${f.fix}`);
      if (f.breach_precedent) lines.push(`    Breach: ${f.breach_precedent}`);
    }
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push('⚡ WARNINGS — should fix:');
    for (const f of warnings) {
      lines.push(`  • ${f.title}`);
      if (f.fix) lines.push(`    Fix: ${f.fix}`);
    }
    lines.push('');
  }

  // Add the AI-ready fix prompt
  lines.push('---');
  lines.push('AI-Ready Fix Prompt (paste this to fix all issues):');
  lines.push('');
  lines.push(report.fix_prompt);

  return lines.join('\n');
}
