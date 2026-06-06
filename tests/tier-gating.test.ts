import { describe, it, expect } from 'vitest';
import { renderFix, getFullAuditMessage } from '../src/license/license.js';
import { formatRlsResults } from '../src/scanners/rls-analyzer.js';
import { formatAuditReport } from '../src/scanners/full-audit.js';
import type { Finding, ScanResult, AuditReport } from '../src/types.js';

const finding: Finding = {
  id: 'rls-using-true',
  severity: 'critical',
  category: 'rls',
  title: 'USING (true) — no restriction',
  message: 'Found in schema.sql:10',
  fix: 'Replace USING (true) with USING (auth.uid() = user_id)',
  breach_precedent: 'Lovable CVE-2025-48757 exposed 170+ apps.',
};

function rlsResult(): ScanResult {
  return { scanner: 'check_supabase_rls', timestamp: '', duration_ms: 1, findings: [finding] };
}

function auditReport(): AuditReport {
  return {
    score: 40,
    grade: 'F',
    timestamp: '',
    scans: [rlsResult()],
    summary: { critical: 1, warning: 0, info: 0, passed: 0 },
    fix_prompt: 'Fix the RLS policy by replacing USING (true).',
  };
}

describe('renderFix tier gate', () => {
  it('hides the fix and breach for free, shows a locked upsell', () => {
    const out = renderFix(finding, 'free').join('\n');
    expect(out).not.toContain('auth.uid() = user_id'); // real fix text withheld
    expect(out).not.toContain('Lovable'); // breach context withheld
    expect(out).toMatch(/Locked|Pro/);
  });

  it('shows the fix and breach for pro', () => {
    const out = renderFix(finding, 'pro').join('\n');
    expect(out).toContain('auth.uid() = user_id');
    expect(out).toContain('Lovable');
  });

  it('returns nothing when there is no fix or breach', () => {
    expect(renderFix({ ...finding, fix: undefined, breach_precedent: undefined }, 'pro')).toEqual([]);
  });
});

describe('scanner formatter respects tier', () => {
  it('free output alerts but omits the solution', () => {
    const out = formatRlsResults(rlsResult(), 'free');
    expect(out).toContain('USING (true)'); // the alert is shown
    expect(out).not.toContain('auth.uid() = user_id'); // the fix is not
    expect(out).not.toContain('Lovable');
  });

  it('pro output includes the fix and breach', () => {
    const out = formatRlsResults(rlsResult(), 'pro');
    expect(out).toContain('auth.uid() = user_id');
    expect(out).toContain('Lovable');
  });
});

describe('full audit free vs pro', () => {
  it('free gets NO audit — just an upgrade prompt (no findings, no grade)', () => {
    const out = getFullAuditMessage();
    expect(out).toMatch(/Pro/);
    expect(out).toMatch(/veilguard\.dev\/pro/);
    expect(out).not.toContain('Grade:');
    expect(out).not.toContain('USING (true)'); // no actual findings leaked
  });

  it('pro report hands the user a copy-paste fix prompt (does not fix it for them)', () => {
    const out = formatAuditReport(auditReport());
    expect(out).toContain('Grade: F');
    expect(out).toContain('How to fix all of this');
    expect(out).toMatch(/paste it to your AI/i);
    expect(out).toMatch(/won't touch your code/i);
    expect(out).toContain('replacing USING (true)'); // the fix prompt body is still included
  });
});
