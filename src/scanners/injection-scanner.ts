import { readFile } from 'fs/promises';
import { join } from 'path';
import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import { logger } from '../utils/logger.js';
import { getPatternsDir } from '../utils/paths.js';
import { FREE_TIER_MAX_FINDINGS } from '../utils/constants.js';
import { getUpgradeMessage } from '../license/license.js';
import { vetMatch } from '../utils/match-context.js';
import type { Finding, ScanResult, InjectionPattern, Tier } from '../types.js';

// dangerouslySetInnerHTML fed JSON-LD / JSON.stringify(...) is static, controlled
// content (a very common SEO pattern), not user-driven XSS. Down-rank it.
function isControlledHtmlSink(line: string, content: string, lineIndex: number): boolean {
  const window = [line, content.split('\n').slice(lineIndex, lineIndex + 3).join('\n')].join('\n');
  return (
    /__html\s*:\s*JSON\.stringify/.test(window) ||
    /application\/ld\+json/i.test(content) ||
    /__html\s*:\s*`?\s*\$\{?\s*JSON\.stringify/.test(window)
  );
}

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
  rootDir: string,
): Promise<Finding[]> {
  const content = await readFileSafe(filePath);
  if (!content) return [];

  const lines = content.split('\n');
  const findings: Finding[] = [];

  for (const rule of rules) {
    try {
      const regex = new RegExp(rule.pattern, 'gi');

      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        const m = regex.exec(lines[i]);
        if (!m) continue;

        // JSON-LD / JSON.stringify into dangerouslySetInnerHTML is static and
        // controlled — at most informational, never a blocking critical.
        let severity = rule.severity;
        if (rule.id === 'xss-dangerously-set' && isControlledHtmlSink(lines[i], content, i)) {
          severity = 'info';
        }

        const vetted = vetMatch(
          {
            id: `injection-${rule.id}`,
            severity,
            category: 'injection',
            title: rule.name,
            message: `${rule.name} detected in ${filePath}:${i + 1}`,
            file: filePath,
            line: i + 1,
            fix: rule.fix,
            cwe: rule.cwe,
            breach_precedent: rule.breach_precedent,
          },
          {
            filePath,
            content,
            lineIndex: i,
            column: m.index,
            matchText: m[0],
            rootDir,
            mode: 'code-construct',
          },
        );

        if (vetted) {
          findings.push(vetted);
          break; // One finding per rule per file
        }
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
    const findings = await scanFileForInjection(file, rules, directory);
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
