import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { scanWebhooks } from '../../src/scanners/webhook-scanner.js';

const VULNERABLE_APP = join(__dirname, '..', 'fixtures', 'vulnerable-app');

describe('webhook-scanner', () => {
  it('detects unverified Stripe webhook', async () => {
    const result = await scanWebhooks(VULNERABLE_APP, 'pro');
    const stripeFindings = result.findings.filter((f) => f.id.includes('stripe'));
    expect(stripeFindings.length).toBeGreaterThan(0);
  });

  it('flags missing constructEvent verification', async () => {
    const result = await scanWebhooks(VULNERABLE_APP, 'pro');
    const webhookIssues = result.findings.filter((f) => f.category === 'webhook');
    expect(webhookIssues.length).toBeGreaterThan(0);
    expect(webhookIssues[0].severity).toBe('critical');
  });
});
