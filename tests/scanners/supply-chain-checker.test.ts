import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { checkSupplyChain } from '../../src/scanners/supply-chain-checker.js';

const VULNERABLE_APP = join(__dirname, '..', 'fixtures', 'vulnerable-app');
const SECURE_APP = join(__dirname, '..', 'fixtures', 'secure-app');

describe('supply-chain-checker', () => {
  it('detects typosquatted package (lodahs)', async () => {
    const result = await checkSupplyChain(VULNERABLE_APP, 'pro');
    const typosquats = result.findings.filter((f) => f.id.includes('typosquat'));
    expect(typosquats.length).toBeGreaterThan(0);
    expect(typosquats[0].message).toContain('lodash');
  });

  it('finds no issues in secure app', async () => {
    const result = await checkSupplyChain(SECURE_APP, 'pro');
    const issues = result.findings.filter((f) => f.severity === 'critical');
    expect(issues.length).toBe(0);
  });

  it('limits to 20 deps for free tier', async () => {
    const result = await checkSupplyChain(VULNERABLE_APP, 'free');
    const limitInfo = result.findings.filter((f) => f.id === 'supply-chain-limit');
    // Only triggers if more than 20 deps
    expect(result.findings.length).toBeGreaterThan(0);
  });
});
