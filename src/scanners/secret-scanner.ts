import { readFile } from 'fs/promises';
import { join } from 'path';
import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import { logger } from '../utils/logger.js';
import { getPatternsDir } from '../utils/paths.js';
import { FREE_TIER_MAX_FINDINGS } from '../utils/constants.js';
import { getUpgradeMessage } from '../license/license.js';
import type { Finding, ScanResult, SecretPattern, Tier } from '../types.js';

let patternsCache: SecretPattern[] | null = null;

/** Load secret patterns from patterns/secrets.json */
async function loadPatterns(): Promise<SecretPattern[]> {
  if (patternsCache) return patternsCache;

  try {
    const patternsPath = join(getPatternsDir(), 'secrets.json');
    const raw = await readFile(patternsPath, 'utf-8');
    patternsCache = JSON.parse(raw) as SecretPattern[];
    return patternsCache;
  } catch (error) {
    logger.error(`Failed to load secret patterns: ${(error as Error).message}`);
    return [];
  }
}

/** Mask a secret value — show first 8 chars + ... */
function maskSecret(value: string): string {
  if (value.length <= 12) return value.substring(0, 4) + '...';
  return value.substring(0, 8) + '...';
}

/** Check if file is in a .env file (secrets there are expected) */
function isEnvFile(filePath: string): boolean {
  const name = filePath.split('/').pop() || '';
  return name.startsWith('.env');
}

/** Scan a single file for secret patterns */
async function scanFile(
  filePath: string,
  patterns: SecretPattern[],
): Promise<Finding[]> {
  if (isEnvFile(filePath)) return [];

  const content = await readFileSafe(filePath);
  if (!content) return [];

  const lines = content.split('\n');
  const findings: Finding[] = [];

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern.pattern, 'g');

      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(line)) !== null) {
          findings.push({
            id: `secret-${pattern.id}`,
            severity: pattern.severity,
            category: 'secret',
            title: `${pattern.name} exposed`,
            message: `Found ${pattern.name} in ${filePath}:${lineNum + 1} — ${maskSecret(match[0])}`,
            file: filePath,
            line: lineNum + 1,
            fix: pattern.fix,
            cwe: 'CWE-798',
            breach_precedent: pattern.breach_precedent,
          });
        }
      }
    } catch {
      logger.debug(`Invalid regex pattern: ${pattern.id}`);
    }
  }

  // Special: detect fallback trap keys (process.env.X || "sk_live_...")
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    if (/process\.env\.\w+\s*\|\|\s*["'][a-zA-Z0-9_-]{10,}["']/.test(line)) {
      findings.push({
        id: 'secret-fallback-trap-key',
        severity: 'critical',
        category: 'secret',
        title: 'Fallback trap key detected',
        message: `AI added a live key as env var fallback in ${filePath}:${lineNum + 1}. This is the #1 way AI sneaks secrets into code.`,
        file: filePath,
        line: lineNum + 1,
        fix: 'Remove the fallback string. Use only process.env.YOUR_KEY without || "...".',
        cwe: 'CWE-798',
        breach_precedent: 'AI tools frequently add || "sk_live_..." as fallback when env vars fail — reported across Reddit and dev forums.',
      });
    }
  }

  return findings;
}

/** Run the secret scanner on a directory */
export async function scanSecrets(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const patterns = await loadPatterns();
  const files = await scanDirectory(directory);

  logger.debug(`Scanning ${files.length} files for ${patterns.length} secret patterns`);

  const allFindings: Finding[] = [];

  for (const file of files) {
    const findings = await scanFile(file, patterns);
    allFindings.push(...findings);
  }

  // Deduplicate by file+line+pattern
  const seen = new Set<string>();
  const uniqueFindings = allFindings.filter((f) => {
    const key = `${f.file}:${f.line}:${f.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    scanner: 'scan_secrets',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings: uniqueFindings,
  };
}

/** Format scan results with tier-aware depth limiting */
export function formatSecretResults(result: ScanResult, tier: Tier): string {
  const { findings } = result;

  if (findings.length === 0) {
    return [
      '~~ veilguard ~~ all clear ✓',
      '',
      `Scanned for secrets. No exposed keys found. (${result.duration_ms}ms)`,
    ].join('\n');
  }

  const lines: string[] = [
    `~~ veilguard ~~ ${findings.length} secret${findings.length > 1 ? 's' : ''} found`,
    '',
  ];

  const visibleFindings = tier === 'pro' ? findings : findings.slice(0, FREE_TIER_MAX_FINDINGS);
  const hiddenCount = findings.length - visibleFindings.length;

  for (let i = 0; i < visibleFindings.length; i++) {
    const f = visibleFindings[i];
    lines.push(`${i + 1}. ${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`   ${f.message}`);

    if (tier === 'pro') {
      if (f.fix) lines.push(`   Fix: ${f.fix}`);
      if (f.breach_precedent) lines.push(`   Breach: ${f.breach_precedent}`);
    } else {
      lines.push('   Fix: [Upgrade to Pro to see fix]');
    }
    lines.push('');
  }

  if (hiddenCount > 0) {
    lines.push(getUpgradeMessage(hiddenCount));
  }

  lines.push(`Scanned in ${result.duration_ms}ms`);
  return lines.join('\n');
}
