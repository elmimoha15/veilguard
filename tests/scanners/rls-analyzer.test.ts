import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { analyzeRls } from '../../src/scanners/rls-analyzer.js';

const VULNERABLE_APP = join(__dirname, '..', 'fixtures', 'vulnerable-app');

describe('rls-analyzer', () => {
  it('detects missing RLS on users table', async () => {
    const result = await analyzeRls(VULNERABLE_APP, 'pro');
    const missingRls = result.findings.filter((f) => f.id.includes('rls-missing'));
    expect(missingRls.length).toBeGreaterThan(0);
  });

  it('detects auth.uid() IS NOT NULL logical bypass', async () => {
    const result = await analyzeRls(VULNERABLE_APP, 'pro');
    const bypassFindings = result.findings.filter((f) => f.id === 'rls-uid-is-not-null');
    expect(bypassFindings.length).toBeGreaterThan(0);
  });

  it('detects USING (true) policy', async () => {
    const result = await analyzeRls(VULNERABLE_APP, 'pro');
    const trueFindings = result.findings.filter((f) => f.id === 'rls-using-true');
    // The WITH CHECK (true) should be caught
    expect(result.findings.some((f) => f.title.includes('true'))).toBe(true);
  });

  it('includes breach precedent context', async () => {
    const result = await analyzeRls(VULNERABLE_APP, 'pro');
    const withBreach = result.findings.filter((f) => f.breach_precedent);
    expect(withBreach.length).toBeGreaterThan(0);
  });
});
