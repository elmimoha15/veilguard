import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import { renderFix } from '../license/license.js';
import { vetMatch } from '../utils/match-context.js';
import type { Finding, ScanResult, Tier } from '../types.js';

function hasAuthEndpoints(content: string): boolean {
  return /\/(login|signin|signup|auth|api\/)/i.test(content);
}

// CORS rules: a regex plus a factory for the (uncalibrated) finding. The match
// index is fed to the context classifier so a `cors({origin:'*'})` written inside
// a string/comment/JSX (e.g. a feature description) is never flagged as real.
interface CorsRule {
  regex: RegExp;
  make: (file: string, line: number, hasAuth: boolean) => Finding;
}

const CORS_RULES: CorsRule[] = [
  {
    regex: /cors\s*\(\s*\{[^}]*origin\s*:\s*['"`]\*['"`]/i,
    make: (file, line, hasAuth) => ({
      id: 'cors-wildcard-origin',
      severity: hasAuth ? 'critical' : 'warning',
      category: 'cors',
      title: 'CORS wildcard origin',
      message: `cors({ origin: '*' }) in ${file}:${line}${hasAuth ? ' — this app has auth endpoints, making this dangerous.' : '.'}`,
      file,
      line,
      fix: "Replace with specific origin: cors({ origin: 'https://yourapp.com' })",
      cwe: 'CWE-942',
    }),
  },
  {
    regex: /app\.use\s*\(\s*cors\s*\(\s*\)\s*\)/,
    make: (file, line) => ({
      id: 'cors-no-options',
      severity: 'warning',
      category: 'cors',
      title: 'CORS with no options (defaults to *)',
      message: `cors() called without options in ${file}:${line} — Express cors middleware defaults to origin: '*'.`,
      file,
      line,
      fix: "Add explicit origin: cors({ origin: 'https://yourapp.com' })",
      cwe: 'CWE-942',
    }),
  },
  {
    regex: /['"`]Access-Control-Allow-Origin['"`]\s*[,:]\s*['"`]\*['"`]/,
    make: (file, line, hasAuth) => ({
      id: 'cors-manual-wildcard',
      severity: hasAuth ? 'critical' : 'warning',
      category: 'cors',
      title: 'Manual CORS wildcard header',
      message: `Access-Control-Allow-Origin: * set manually in ${file}:${line}.`,
      file,
      line,
      fix: 'Replace * with your specific domain.',
      cwe: 'CWE-942',
    }),
  },
];

export async function checkCors(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json']);

  for (const file of files) {
    const content = await readFileSafe(file);
    if (!content) continue;
    const lines = content.split('\n');
    const hasAuth = hasAuthEndpoints(content);

    for (const rule of CORS_RULES) {
      let matched = false;
      for (let i = 0; i < lines.length && !matched; i++) {
        const m = rule.regex.exec(lines[i]);
        if (!m) continue;
        const vetted = vetMatch(rule.make(file, i + 1, hasAuth), {
          filePath: file,
          content,
          lineIndex: i,
          column: m.index,
          matchText: m[0],
          rootDir: directory,
          mode: 'code-construct',
        });
        if (vetted) {
          findings.push(vetted);
          matched = true; // one finding per rule per file (matches prior behaviour)
        }
      }
    }
  }

  return {
    scanner: 'check_cors',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings,
  };
}

export function formatCorsResults(result: ScanResult, tier: Tier): string {
  const { findings } = result;
  if (findings.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nNo CORS misconfigurations found. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [`~~ veilguard ~~ ${findings.length} CORS issue${findings.length > 1 ? 's' : ''} found`, ''];
  for (const f of findings) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    lines.push(...renderFix(f, tier));
    lines.push('');
  }
  return lines.join('\n');
}
