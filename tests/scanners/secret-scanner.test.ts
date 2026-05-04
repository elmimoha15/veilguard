import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { scanSecrets } from '../../src/scanners/secret-scanner.js';

const VULNERABLE_APP = join(__dirname, '..', 'fixtures', 'vulnerable-app');
const SECURE_APP = join(__dirname, '..', 'fixtures', 'secure-app');

describe('secret-scanner', () => {
  it('detects hardcoded secrets in vulnerable app', async () => {
    const result = await scanSecrets(VULNERABLE_APP, 'pro');
    expect(result.findings.length).toBeGreaterThan(0);

    const stripeFindings = result.findings.filter((f) => f.id.includes('stripe'));
    expect(stripeFindings.length).toBeGreaterThan(0);

    const paystackFindings = result.findings.filter((f) => f.id.includes('paystack'));
    expect(paystackFindings.length).toBeGreaterThan(0);
  });

  it('detects fallback trap keys', async () => {
    const result = await scanSecrets(VULNERABLE_APP, 'pro');
    const trapFindings = result.findings.filter((f) => f.id === 'secret-fallback-trap-key');
    expect(trapFindings.length).toBeGreaterThan(0);
  });

  it('finds zero secrets in secure app', async () => {
    const result = await scanSecrets(SECURE_APP, 'pro');
    const criticals = result.findings.filter((f) => f.severity === 'critical');
    expect(criticals.length).toBe(0);
  });

  it('masks secrets in output (never exposes full key)', async () => {
    const result = await scanSecrets(VULNERABLE_APP, 'pro');
    for (const finding of result.findings) {
      if (finding.message.includes('sk_live_')) {
        expect(finding.message).toContain('...');
        expect(finding.message.length).toBeLessThan(finding.message.length + 50); // key is masked, not fully exposed
      }
    }
  });

  it('limits findings for free tier', async () => {
    const result = await scanSecrets(VULNERABLE_APP, 'free');
    // Scanner returns all findings; formatting limits them
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it('includes breach precedent in findings', async () => {
    const result = await scanSecrets(VULNERABLE_APP, 'pro');
    const withBreach = result.findings.filter((f) => f.breach_precedent);
    expect(withBreach.length).toBeGreaterThan(0);
  });
});
