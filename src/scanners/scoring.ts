import type { Finding, ScanResult } from '../types.js';

/** Calculate security score from findings */
export function calculateScore(findings: Finding[]): { score: number; grade: string } {
  let score = 100;

  for (const f of findings) {
    switch (f.severity) {
      case 'critical':
        score -= 15;
        break;
      case 'warning':
        score -= 5;
        break;
      case 'info':
        score -= 1;
        break;
      case 'passed':
        break;
    }
  }

  score = Math.max(0, score);
  const grade = scoreToGrade(score);
  return { score, grade };
}

function scoreToGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  if (score >= 75) return 'C+';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/** Summarize findings by severity */
export function summarizeFindings(findings: Finding[]): {
  critical: number;
  warning: number;
  info: number;
  passed: number;
} {
  return {
    critical: findings.filter((f) => f.severity === 'critical').length,
    warning: findings.filter((f) => f.severity === 'warning').length,
    info: findings.filter((f) => f.severity === 'info').length,
    passed: findings.filter((f) => f.severity === 'passed').length,
  };
}

/** Generate AI-ready fix prompt from all findings */
export function generateFixPrompt(scans: ScanResult[]): string {
  const allFindings = scans.flatMap((s) => s.findings).filter((f) => f.severity === 'critical' || f.severity === 'warning');

  if (allFindings.length === 0) return 'No fixes needed — your project is clean!';

  const lines: string[] = [
    'Fix the following security issues in my project:',
    '',
  ];

  for (let i = 0; i < allFindings.length; i++) {
    const f = allFindings[i];
    lines.push(`${i + 1}. [${f.severity.toUpperCase()}] ${f.title}`);
    if (f.file) lines.push(`   File: ${f.file}${f.line ? `:${f.line}` : ''}`);
    if (f.fix) lines.push(`   Fix: ${f.fix}`);
    lines.push('');
  }

  lines.push('Apply all fixes while maintaining existing functionality. Do not break any working features.');
  return lines.join('\n');
}
