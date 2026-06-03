import { describe, it, expect, beforeAll } from 'vitest';
import {
  getTier,
  canRunAudit,
  getAuditUsageRemaining,
  getFullAuditMessage,
  getAuditLimitMessage,
  getUpgradeMessage,
} from '../src/license/license.js';

// These tests exercise the free-tier path only: with no VEILGUARD_KEY set,
// getTier() must short-circuit to 'free' WITHOUT touching the network or the
// filesystem. getTier() memoizes per process, so once it resolves to 'free'
// here, every dependent function (canRunAudit, getAuditUsageRemaining) follows.
describe('license — free tier (no key)', () => {
  beforeAll(() => {
    delete process.env.VEILGUARD_KEY;
    delete process.env.POLAR_ORG_ID;
  });

  it('getTier() resolves to free when no key is set, and never throws', async () => {
    await expect(getTier()).resolves.toBe('free');
  });

  it('canRunAudit() is false for free users', async () => {
    await expect(canRunAudit()).resolves.toBe(false);
  });

  it('getAuditUsageRemaining() is 0 for free users', async () => {
    await expect(getAuditUsageRemaining()).resolves.toBe(0);
  });
});

describe('license — upsell messages', () => {
  it('full-audit upsell points to Pro without leaking a grade', () => {
    const out = getFullAuditMessage();
    expect(out).toMatch(/Pro/);
    expect(out).toMatch(/veilguard\.dev\/pro/);
    expect(out).not.toContain('Grade:');
  });

  it('audit-limit message explains the monthly cap and the reset', () => {
    const out = getAuditLimitMessage();
    expect(out).toMatch(/limit reached/i);
    expect(out).toContain('3/3');
    expect(out).toMatch(/next month/);
  });

  it('upgrade message pluralizes the hidden-finding count', () => {
    expect(getUpgradeMessage(1)).toContain('1 more issue found');
    expect(getUpgradeMessage(4)).toContain('4 more issues found');
  });
});
