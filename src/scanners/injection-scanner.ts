import { readFile } from 'fs/promises';
import { join } from 'path';
import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import { logger } from '../utils/logger.js';
import { getPatternsDir } from '../utils/paths.js';
import { FREE_TIER_MAX_FINDINGS } from '../utils/constants.js';
import { getUpgradeMessage } from '../license/license.js';
import type { Finding, ScanResult, InjectionPattern, Tier } from '../types.js';

let rulesCache: InjectionPattern[] | null = null;

async function loadRules(): Promise<InjectionPattern[]> {
  if (rulesCache) return rulesCache;
  try {
    const rulesPath = join(getPatternsDir(), 'injection-rules.json');
    const raw = await readFile(rulesPath, 'utf-8');
    rulesCache = JSON.parse(raw) as InjectionPattern[];
    return rulesCache;
  } catch (error) {
    logger.error(`Failed to load injection rules: ${(error as Error).message}`);
    return [];
  }
}

async function scanFileForInjection(
  filePath: string,
  rules: InjectionPattern[],
): Promise<Finding[]> {
  const content = await readFileSafe(filePath);
  if (!content) return [];

  const lines = content.split('\n');
  const findings: Finding[] = [];

  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.pattern, 'gi');

      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          findings.push({
            id: `injection-${rule.id}`,
            severity: rule.severity,
            category: 'injection',
            title: rule.name,
            message: `${rule.name} detected in ${filePath}:${i + 1}`,
            file: filePath,
            line: i + 1,
            fix: rule.fix,
            cwe: rule.cwe,
            breach_precedent: rule.breach_precedent,
          });
          break; // One finding per rule per file
        }
        regex.lastIndex = 0;
      }
    } catch {
      logger.debug(`Invalid injection regex: ${rule.id}`);
    }
  }

  return findings;
}

export async function scanInjection(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const rules = await loadRules();
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx', '.mjs']);

  const allFindings: Finding[] = [];
  for (const file of files) {
    const findings = await scanFileForInjection(file, rules);
    allFindings.push(...findings);
  }

  return {
    scanner: 'scan_injection',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings: allFindings,
  };
}

export function formatInjectionResults(result: ScanResult, tier: Tier): string {
  const { findings } = result;

  if (findings.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nNo injection vulnerabilities found. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [
    `~~ veilguard ~~ ${findings.length} injection issue${findings.length > 1 ? 's' : ''} found`,
    '',
  ];

  const visible = tier === 'pro' ? findings : findings.slice(0, FREE_TIER_MAX_FINDINGS);
  const hidden = findings.length - visible.length;

  for (const f of visible) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    if (tier === 'pro' && f.fix) lines.push(`  Fix: ${f.fix}`);
    else if (tier === 'free') lines.push('  Fix: [Upgrade to Pro to see fix]');
    if (tier === 'pro' && f.breach_precedent) lines.push(`  Breach: ${f.breach_precedent}`);
    lines.push('');
  }

  if (hidden > 0) lines.push(getUpgradeMessage(hidden));
  return lines.join('\n');
}
