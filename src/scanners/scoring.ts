import type { Finding, ScanResult } from '../types.js';

interface ScoreRule {
  match: (f: Finding) => boolean;
  penalty: number;
}

const SCORE_RULES: ScoreRule[] = [
  // Service role in frontend is the worst — instant database takeover (Moltbook attack)
  { match: (f) => f.id === 'secret-service-role-frontend', penalty: 25 },
  { match: (f) => f.category === 'secret' || f.id.startsWith('secret-'), penalty: 20 },
  { match: (f) => f.category === 'webhook' || f.id.startsWith('webhook-'), penalty: 20 },
  // SQL/NoSQL/command injection (not IDOR or mass-assign — those have separate rules below)
  {
    match: (f) =>
      (f.id.startsWith('injection-sql') ||
        f.id.startsWith('injection-nosql') ||
        f.id.startsWith('injection-command') ||
        f.id === 'injection-unsanitized-body-insert'),
    penalty: 20,
  },
  // Missing Supabase RLS / open Firebase rules
  {
    match: (f) =>
      f.category === 'rls' ||
      f.id.startsWith('rls-') ||
      f.category === 'firebase' ||
      f.id.startsWith('firebase-'),
    penalty: 20,
  },
  // IDOR
  {
    match: (f) =>
      f.category === 'idor' ||
      f.id === 'injection-idor-params-id' ||
      f.id === 'injection-idor-prisma-where-id-only' ||
      f.id === 'idor-handler-scope',
    penalty: 20,
  },
  // Mass assignment
  {
    match: (f) =>
      f.id === 'injection-mass-assignment-spread' ||
      f.id === 'injection-mass-assignment-object-assign',
    penalty: 15,
  },
  // Missing rate limiting on auth / payment routes
  {
    match: (f) =>
      f.id === 'auth-no-rate-limit' ||
      f.id === 'rate-limit-missing-payment',
    penalty: 15,
  },
  // CORS wildcard / misconfig
  { match: (f) => f.category === 'cors' || f.id.startsWith('cors-'), penalty: 10 },
  // Sensitive data in logs
  { match: (f) => f.id === 'sensitive-log' || f.category === 'logging', penalty: 10 },
  // Error stack / verbose error exposure
  {
    match: (f) => f.id === 'error-stack-exposed' || f.category === 'error-exposure',
    penalty: 8,
  },
  // Missing security headers
  { match: (f) => f.category === 'headers' || f.id.startsWith('header-'), penalty: 5 },
];

export function calculateScore(findings: Finding[]): { score: number; grade: string } {
  let score = 100;

  for (const f of findings) {
    if (f.severity === 'passed' || f.severity === 'info') {
      if (f.severity === 'info') score -= 1;
      continue;
    }

    const rule = SCORE_RULES.find((r) => r.match(f));
    const basePenalty = rule ? rule.penalty : f.severity === 'critical' ? 15 : 5;

    // Scale by the scanner's confidence that this is a real, exploitable issue.
    // Findings without a confidence (most scanners, and all that weren't context-
    // classified) are treated as fully confident (1), preserving prior behaviour.
    // A contextual / lower-confidence finding costs proportionally less, so a
    // clean docs site can't be dragged to an F by ambiguous matches.
    const confidence = typeof f.confidence === 'number' ? f.confidence : 1;
    score -= basePenalty * confidence;
  }

  score = Math.max(0, Math.round(score));
  const grade = scoreToGrade(score);
  return { score, grade };
}

export function gradeMeaning(grade: string): string {
  switch (grade) {
    case 'A+':
    case 'A':
      return 'Your app is production-ready. Excellent security hygiene.';
    case 'B+':
    case 'B':
      return 'Good security. A few improvements recommended before scaling.';
    case 'C+':
    case 'C':
      return 'Moderate risk. Fix warnings before you get real users.';
    case 'D':
      return 'High risk. Critical issues present. Fix before deploying.';
    case 'F':
    default:
      return 'Do NOT deploy. Your app has critical vulnerabilities that attackers actively exploit.';
  }
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

// Builds the prompt the user copies and pastes into their own AI coding
// assistant. Veilguard never edits the user's code — it hands them this prompt
// instead. Written in plain language for non-technical "vibe coders".
export function generateFixPrompt(scans: ScanResult[]): string {
  const allFindings = scans.flatMap((s) => s.findings).filter((f) => f.severity === 'critical' || f.severity === 'warning');

  if (allFindings.length === 0) return 'No fixes needed — your project is clean!';

  const lines: string[] = [
    'I ran a security scan on my app and it found some issues. Please fix each one for me — carefully, and without breaking anything that already works.',
    '',
    'Here is what is wrong and where. The "suggested direction" is just a hint —',
    'use your own understanding of my codebase to apply the best real fix, not a copy-paste:',
    '',
  ];

  for (let i = 0; i < allFindings.length; i++) {
    const f = allFindings[i];
    lines.push(`${i + 1}. ${f.title}`);
    if (f.file) lines.push(`   Where: ${f.file}${f.line ? `:${f.line}` : ''}`);
    if (f.fix) lines.push(`   Suggested direction: ${f.fix}`);
    lines.push('');
  }

  lines.push(
    "Please make these changes one at a time using your own judgment. After each fix, double-check it didn't break any feature that already works. When you're done, explain in plain, non-technical language what you changed and why my app is now safer.",
  );
  return lines.join('\n');
}
