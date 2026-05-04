import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import type { Finding, ScanResult, Tier } from '../types.js';

/** Check if the project has auth endpoints (context for CORS severity) */
function hasAuthEndpoints(content: string): boolean {
  return /\/(login|signin|signup|auth|api\/)/i.test(content);
}

/** Run the CORS scanner */
export async function checkCors(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json']);

  for (const file of files) {
    const content = await readFileSafe(file);
    if (!content) continue;
    const lines = content.split('\n');
    const hasAuth = hasAuthEndpoints(content);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // cors({ origin: '*' }) or cors({ origin: "*" })
      if (/cors\s*\(\s*\{[^}]*origin\s*:\s*['"`]\*['"`]/i.test(line)) {
        findings.push({
          id: 'cors-wildcard-origin',
          severity: hasAuth ? 'critical' : 'warning',
          category: 'cors',
          title: 'CORS wildcard origin',
          message: `cors({ origin: '*' }) in ${file}:${i + 1}${hasAuth ? ' — this app has auth endpoints, making this dangerous.' : '.'}`,
          file,
          line: i + 1,
          fix: "Replace with specific origin: cors({ origin: 'https://yourapp.com' })",
          cwe: 'CWE-942',
        });
        break;
      }

      // cors() with no options (Express defaults to *)
      if (/app\.use\s*\(\s*cors\s*\(\s*\)\s*\)/.test(line)) {
        findings.push({
          id: 'cors-no-options',
          severity: 'warning',
          category: 'cors',
          title: 'CORS with no options (defaults to *)',
          message: `cors() called without options in ${file}:${i + 1} — Express cors middleware defaults to origin: '*'.`,
          file,
          line: i + 1,
          fix: "Add explicit origin: cors({ origin: 'https://yourapp.com' })",
          cwe: 'CWE-942',
        });
        break;
      }

      // Manual Access-Control-Allow-Origin: *
      if (/['"`]Access-Control-Allow-Origin['"`]\s*[,:]\s*['"`]\*['"`]/.test(line)) {
        findings.push({
          id: 'cors-manual-wildcard',
          severity: hasAuth ? 'critical' : 'warning',
          category: 'cors',
          title: 'Manual CORS wildcard header',
          message: `Access-Control-Allow-Origin: * set manually in ${file}:${i + 1}.`,
          file,
          line: i + 1,
          fix: 'Replace * with your specific domain.',
          cwe: 'CWE-942',
        });
        break;
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

export function formatCorsResults(result: ScanResult, _tier: Tier): string {
  const { findings } = result;
  if (findings.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nNo CORS misconfigurations found. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [`~~ veilguard ~~ ${findings.length} CORS issue${findings.length > 1 ? 's' : ''} found`, ''];
  for (const f of findings) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    if (f.fix) lines.push(`  Fix: ${f.fix}`);
    lines.push('');
  }
  return lines.join('\n');
}
