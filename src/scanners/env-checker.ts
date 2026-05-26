import { access, readFile } from 'fs/promises';
import { join } from 'path';
import { execSync } from 'child_process';
import { readFileSafe } from '../utils/file-reader.js';
import { scanDirectory } from '../utils/glob-scanner.js';
import type { Finding, ScanResult, Tier } from '../types.js';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function gitignoreContains(rootDir: string, pattern: string): Promise<boolean> {
  try {
    const content = await readFile(join(rootDir, '.gitignore'), 'utf-8');
    return content.split('\n').some((line) => line.trim() === pattern || line.trim() === pattern + '/');
  } catch {
    return false;
  }
}

function isTrackedByGit(rootDir: string, fileName: string): boolean {
  try {
    const result = execSync(`git ls-files ${fileName}`, { cwd: rootDir, encoding: 'utf-8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

async function checkNextPublicVars(directory: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx', '.env']);

  const secretKeywords = [
    'SECRET', 'PRIVATE', 'PASSWORD', 'TOKEN', 'API_KEY',
    'SERVICE_ROLE', 'DATABASE_URL', 'SUPABASE_SERVICE',
    'STRIPE_SECRET', 'PAYSTACK_SECRET', 'FLW_SECRET',
  ];

  for (const file of files) {
    const content = await readFileSafe(file);
    if (!content) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/NEXT_PUBLIC_(\w+)/);
      if (match) {
        const varName = match[1];
        if (secretKeywords.some((kw) => varName.toUpperCase().includes(kw))) {
          findings.push({
            id: 'env-next-public-secret',
            severity: 'critical',
            category: 'env',
            title: `Secret exposed via NEXT_PUBLIC_ prefix`,
            message: `NEXT_PUBLIC_${varName} in ${file}:${i + 1} — NEXT_PUBLIC_ vars are bundled into client-side code and visible to anyone.`,
            file,
            line: i + 1,
            fix: `Remove the NEXT_PUBLIC_ prefix. Use a server-side API route to access this value.`,
            cwe: 'CWE-200',
            breach_precedent: 'v0 scanner blocked 17,000+ deployments where AI exposed secrets via NEXT_PUBLIC_ prefix.',
          });
        }
      }
    }
  }

  return findings;
}

export async function checkEnv(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const findings: Finding[] = [];

  // Check .gitignore exists
  const hasGitignore = await fileExists(join(directory, '.gitignore'));
  if (!hasGitignore) {
    findings.push({
      id: 'env-no-gitignore',
      severity: 'info',
      category: 'env',
      title: 'No .gitignore found',
      message: 'Project root has no .gitignore file. Secrets may be committed to git.',
      file: join(directory, '.gitignore'),
      fix: 'Create a .gitignore file with at least: .env, .env.local, .env.production, node_modules/',
    });
  }

  // Check .env files are gitignored
  const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];
  for (const envFile of envFiles) {
    const exists = await fileExists(join(directory, envFile));
    if (exists) {
      const isIgnored = await gitignoreContains(directory, envFile);
      if (!isIgnored) {
        findings.push({
          id: `env-not-gitignored-${envFile}`,
          severity: 'critical',
          category: 'env',
          title: `${envFile} is not in .gitignore`,
          message: `${envFile} exists but is not listed in .gitignore. Your secrets will be committed to git.`,
          file: join(directory, '.gitignore'),
          fix: `Add "${envFile}" to your .gitignore file immediately.`,
          cwe: 'CWE-538',
        });
      }

      // Check if .env is tracked by git
      if (isTrackedByGit(directory, envFile)) {
        findings.push({
          id: `env-tracked-by-git-${envFile}`,
          severity: 'critical',
          category: 'env',
          title: `${envFile} is tracked by git`,
          message: `${envFile} has been committed to git. Even if you add it to .gitignore now, it persists in history.`,
          file: join(directory, envFile),
          fix: `Add ${envFile} to .gitignore, then run: git rm --cached ${envFile} && git commit -m "Remove ${envFile} from tracking". Consider rotating all secrets in this file.`,
          cwe: 'CWE-538',
        });
      }
    }
  }

  // Check for NEXT_PUBLIC_ misuse
  const nextPublicFindings = await checkNextPublicVars(directory);
  findings.push(...nextPublicFindings);

  return {
    scanner: 'check_env',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings,
  };
}

export function formatEnvResults(result: ScanResult, _tier: Tier): string {
  const { findings } = result;

  if (findings.length === 0) {
    return [
      '~~ veilguard ~~ all clear ✓',
      '',
      `Environment config looks good. (${result.duration_ms}ms)`,
    ].join('\n');
  }

  const lines: string[] = [
    `~~ veilguard ~~ ${findings.length} environment issue${findings.length > 1 ? 's' : ''} found`,
    '',
  ];

  for (const f of findings) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    if (f.fix) lines.push(`  Fix: ${f.fix}`);
    lines.push('');
  }

  return lines.join('\n');
}
