import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import type { Finding, ScanResult, Tier } from '../types.js';

async function analyzeMigrations(directory: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const files = await scanDirectory(directory, ['.sql']);

  for (const file of files) {
    const content = await readFileSafe(file);
    if (!content) continue;
    const lines = content.split('\n');

    // Strip SQL comments for accurate detection
    const codeLines = lines.map((line) => line.replace(/--.*$/, '').trim());
    const codeOnly = codeLines.join('\n');
    const upperCode = codeOnly.toUpperCase();

    // Check for CREATE TABLE without ENABLE ROW LEVEL SECURITY nearby
    const tableMatches = codeOnly.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi);
    for (const match of tableMatches) {
      const tableName = match[1];
      if (!upperCode.includes(`ALTER TABLE ${tableName.toUpperCase()} ENABLE ROW LEVEL SECURITY`) &&
          !upperCode.includes(`ALTER TABLE PUBLIC.${tableName.toUpperCase()} ENABLE ROW LEVEL SECURITY`)) {
        findings.push({
          id: `rls-missing-${tableName}`,
          severity: 'critical',
          category: 'rls',
          title: `Missing RLS on "${tableName}" table`,
          message: `Table "${tableName}" created in ${file} without ENABLE ROW LEVEL SECURITY. Anyone with the anon key can read/write all rows.`,
          file,
          fix: `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Users access own data" ON public.${tableName}\n  FOR ALL USING (auth.uid() = user_id);`,
          cwe: 'CWE-862',
          breach_precedent: 'Lovable CVE-2025-48757: missing RLS exposed 170+ production apps.',
        });
      }
    }

    // Check for USING (true) — no restriction
    for (let i = 0; i < lines.length; i++) {
      if (/USING\s*\(\s*true\s*\)/i.test(lines[i])) {
        findings.push({
          id: 'rls-using-true',
          severity: 'critical',
          category: 'rls',
          title: 'RLS policy with USING (true)',
          message: `USING (true) at ${file}:${i + 1} — this policy allows unrestricted access. Equivalent to no RLS.`,
          file,
          line: i + 1,
          fix: 'Replace USING (true) with USING (auth.uid() = user_id)',
          cwe: 'CWE-862',
        });
      }
    }

    // Check for auth.role() = 'authenticated' without auth.uid()
    for (let i = 0; i < lines.length; i++) {
      if (/auth\.role\(\)\s*=\s*['"]authenticated['"]/i.test(lines[i]) &&
          !lines[i].includes('auth.uid()')) {
        findings.push({
          id: 'rls-auth-role-only',
          severity: 'critical',
          category: 'rls',
          title: 'RLS uses auth.role() without auth.uid()',
          message: `Policy at ${file}:${i + 1} checks auth.role()='authenticated' but not auth.uid(). Any logged-in user can access ALL rows.`,
          file,
          line: i + 1,
          fix: "Replace auth.role() = 'authenticated' with auth.uid() = user_id",
          cwe: 'CWE-862',
          breach_precedent: 'Wiz research: this pattern found across 20% of vibe-coded apps.',
        });
      }
    }

    // Check for auth.uid() IS NOT NULL — logical bypass
    for (let i = 0; i < lines.length; i++) {
      if (/auth\.uid\(\)\s+IS\s+NOT\s+NULL/i.test(lines[i])) {
        findings.push({
          id: 'rls-uid-is-not-null',
          severity: 'critical',
          category: 'rls',
          title: 'Logical RLS bypass: auth.uid() IS NOT NULL',
          message: `Policy at ${file}:${i + 1} uses USING (auth.uid() IS NOT NULL). This passes naive "is RLS on?" checks but lets ANY logged-in user see ALL data.`,
          file,
          line: i + 1,
          fix: 'Replace USING (auth.uid() IS NOT NULL) with USING (auth.uid() = user_id)',
          cwe: 'CWE-862',
          breach_precedent: 'Flagged by Wiz research — this is the sneakiest RLS bypass pattern.',
        });
      }
    }
  }

  return findings;
}

async function analyzeSourceCode(directory: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx']);

  for (const file of files) {
    const content = await readFileSafe(file);
    if (!content) continue;
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // select('*') without .eq('user_id')
      if (/\.from\s*\(['"`]\w+['"`]\)\s*\.select\s*\(['"`]\*['"`]\)/.test(line)) {
        // Check next few lines for .eq('user_id')
        const context = lines.slice(i, i + 5).join('\n');
        if (!context.includes('.eq(') && !context.includes('user_id')) {
          findings.push({
            id: 'rls-select-all-no-filter',
            severity: 'critical',
            category: 'rls',
            title: "select('*') without user filter",
            message: `Unfiltered select('*') at ${file}:${i + 1}. Without RLS or .eq('user_id'), this returns ALL rows for ALL users.`,
            file,
            line: i + 1,
            fix: "Add .eq('user_id', user.id) to filter by authenticated user, or ensure RLS is enabled on this table.",
            cwe: 'CWE-862',
            breach_precedent: 'Moltbook breach: select(*) without filter exposed 1.5M tokens.',
          });
        }
      }

      // getSession() on frontend
      if (/supabase\.auth\.getSession\(\)/.test(line) && !file.includes('server') && !file.includes('api/')) {
        findings.push({
          id: 'rls-getsession-frontend',
          severity: 'critical',
          category: 'rls',
          title: 'getSession() on frontend (spoofable)',
          message: `supabase.auth.getSession() at ${file}:${i + 1}. This reads from localStorage and can be tampered with.`,
          file,
          line: i + 1,
          fix: 'Use supabase.auth.getUser() instead — it validates the JWT server-side.',
          cwe: 'CWE-287',
        });
      }
    }
  }

  return findings;
}

export async function analyzeRls(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const migrationFindings = await analyzeMigrations(directory);
  const sourceFindings = await analyzeSourceCode(directory);

  return {
    scanner: 'check_supabase_rls',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings: [...migrationFindings, ...sourceFindings],
  };
}

export function formatRlsResults(result: ScanResult, _tier: Tier): string {
  const { findings } = result;

  if (findings.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nSupabase RLS looks properly configured. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [`~~ veilguard ~~ ${findings.length} RLS issue${findings.length > 1 ? 's' : ''} found`, ''];
  for (const f of findings) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    if (f.fix) lines.push(`  Fix: ${f.fix}`);
    if (f.breach_precedent) lines.push(`  Breach: ${f.breach_precedent}`);
    lines.push('');
  }
  return lines.join('\n');
}
