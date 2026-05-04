import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { scanInjection } from '../../src/scanners/injection-scanner.js';

const VULNERABLE_APP = join(__dirname, '..', 'fixtures', 'vulnerable-app');
const SECURE_APP = join(__dirname, '..', 'fixtures', 'secure-app');

describe('injection-scanner', () => {
  it('detects SQL injection via template literal', async () => {
    const result = await scanInjection(VULNERABLE_APP, 'pro');
    const sqlFindings = result.findings.filter((f) => f.id.includes('sql'));
    expect(sqlFindings.length).toBeGreaterThan(0);
  });

  it('detects unsanitized req.body insert', async () => {
    const result = await scanInjection(VULNERABLE_APP, 'pro');
    const bodyFindings = result.findings.filter((f) => f.id.includes('body'));
    expect(bodyFindings.length).toBeGreaterThan(0);
  });

  it('finds zero injection issues in secure app', async () => {
    const result = await scanInjection(SECURE_APP, 'pro');
    expect(result.findings.length).toBe(0);
  });
});
