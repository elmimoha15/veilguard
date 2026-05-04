import { describe, it, expect } from 'vitest';
import { join } from 'path';
import { calculateScore, summarizeFindings, generateFixPrompt } from '../../src/scanners/scoring.js';
import type { Finding, ScanResult } from '../../src/types.js';

describe('scoring', () => {
  it('starts at 100 with no findings', () => {
    const { score, grade } = calculateScore([]);
    expect(score).toBe(100);
    expect(grade).toBe('A+');
  });

  it('deducts 15 per critical', () => {
    const findings: Finding[] = [
      { id: 'test-1', severity: 'critical', category: 'secret', title: 'Test', message: 'Test' },
      { id: 'test-2', severity: 'critical', category: 'secret', title: 'Test', message: 'Test' },
    ];
    const { score } = calculateScore(findings);
    expect(score).toBe(70);
  });

  it('deducts 5 per warning', () => {
    const findings: Finding[] = [
      { id: 'test-1', severity: 'warning', category: 'env', title: 'Test', message: 'Test' },
    ];
    const { score } = calculateScore(findings);
    expect(score).toBe(95);
  });

  it('never goes below 0', () => {
    const findings: Finding[] = Array.from({ length: 20 }, (_, i) => ({
      id: `test-${i}`,
      severity: 'critical' as const,
      category: 'secret',
      title: 'Test',
      message: 'Test',
    }));
    const { score, grade } = calculateScore(findings);
    expect(score).toBe(0);
    expect(grade).toBe('F');
  });

  it('assigns correct grades', () => {
    expect(calculateScore([]).grade).toBe('A+');

    const oneWarning: Finding[] = [{ id: 'w', severity: 'warning', category: 'env', title: 't', message: 'm' }];
    expect(calculateScore(oneWarning).grade).toBe('A+');

    const twoCriticals: Finding[] = [
      { id: 'c1', severity: 'critical', category: 'secret', title: 't', message: 'm' },
      { id: 'c2', severity: 'critical', category: 'secret', title: 't', message: 'm' },
    ];
    expect(calculateScore(twoCriticals).grade).toBe('C');
  });

  it('summarizes findings correctly', () => {
    const findings: Finding[] = [
      { id: '1', severity: 'critical', category: 'a', title: 't', message: 'm' },
      { id: '2', severity: 'critical', category: 'a', title: 't', message: 'm' },
      { id: '3', severity: 'warning', category: 'a', title: 't', message: 'm' },
      { id: '4', severity: 'info', category: 'a', title: 't', message: 'm' },
      { id: '5', severity: 'passed', category: 'a', title: 't', message: 'm' },
    ];
    const summary = summarizeFindings(findings);
    expect(summary.critical).toBe(2);
    expect(summary.warning).toBe(1);
    expect(summary.info).toBe(1);
    expect(summary.passed).toBe(1);
  });

  it('generates fix prompt with numbered items', () => {
    const scans: ScanResult[] = [
      {
        scanner: 'test',
        timestamp: new Date().toISOString(),
        duration_ms: 100,
        findings: [
          { id: '1', severity: 'critical', category: 'secret', title: 'Stripe key exposed', message: 'Found in app.ts', fix: 'Move to .env' },
        ],
      },
    ];
    const prompt = generateFixPrompt(scans);
    expect(prompt).toContain('1.');
    expect(prompt).toContain('Stripe key exposed');
    expect(prompt).toContain('Move to .env');
  });
});
