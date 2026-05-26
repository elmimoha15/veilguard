import { join } from 'path';
import { execSync } from 'child_process';
import { readFileSafe } from '../utils/file-reader.js';
import type { Finding, ScanResult, Tier } from '../types.js';

function isGitRepo(directory: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: directory, encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function gitLsFiles(directory: string, file: string): boolean {
  try {
    const result = execSync(`git ls-files ${file}`, { cwd: directory, encoding: 'utf-8', stdio: 'pipe' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function searchGitHistory(directory: string, pattern: string): boolean {
  try {
    const result = execSync(`git log --all --oneline -S "${pattern}" -1`, {
      cwd: directory,
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 10000,
    });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

export async function checkGit(directory: string, tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const findings: Finding[] = [];

  if (!isGitRepo(directory)) {
    findings.push({
      id: 'git-not-a-repo',
      severity: 'info',
      category: 'git',
      title: 'Not a git repository',
      message: 'This directory is not a git repository. Git-specific checks skipped.',
    });
    return { scanner: 'check_git', timestamp: new Date().toISOString(), duration_ms: Date.now() - start, findings };
  }

  // Check .gitignore exists
  const gitignoreContent = await readFileSafe(join(directory, '.gitignore'));
  if (gitignoreContent === null) {
    findings.push({
      id: 'git-no-gitignore',
      severity: 'info',
      category: 'git',
      title: 'No .gitignore file',
      message: 'Project has no .gitignore. Secrets and build artifacts may be committed.',
      fix: 'Create a .gitignore with at least: .env, .env.local, .env.production, node_modules/, dist/, .next/',
    });
  } else {
    // Check for .env in .gitignore
    const envPatterns = ['.env', '.env.local', '.env.production'];
    for (const pattern of envPatterns) {
      if (!gitignoreContent.includes(pattern)) {
        findings.push({
          id: `git-gitignore-missing-${pattern}`,
          severity: 'warning',
          category: 'git',
          title: `${pattern} missing from .gitignore`,
          message: `${pattern} is not listed in .gitignore. It may be committed with secrets.`,
          fix: `Add "${pattern}" to your .gitignore file.`,
        });
      }
    }
  }

  // Check if .env is tracked by git
  if (gitLsFiles(directory, '.env')) {
    findings.push({
      id: 'git-env-tracked',
      severity: 'critical',
      category: 'git',
      title: '.env file is tracked by git',
      message: '.env has been committed to git. Even after adding to .gitignore, it persists in history.',
      fix: 'Run: git rm --cached .env && git commit -m "Remove .env from tracking". Then rotate ALL secrets.',
      cwe: 'CWE-538',
    });
  }

  // Check if node_modules is committed
  if (gitLsFiles(directory, 'node_modules')) {
    findings.push({
      id: 'git-node-modules-tracked',
      severity: 'warning',
      category: 'git',
      title: 'node_modules committed to git',
      message: 'node_modules is tracked by git. This bloats the repository and may contain sensitive files.',
      fix: 'Add "node_modules/" to .gitignore, then: git rm -r --cached node_modules',
    });
  }

  // Pro: deep scan git history for secrets
  if (tier === 'pro') {
    const secretPatterns = ['sk_live_', 'sk_test_', 'AKIA', 'FLWSECK_', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'];
    for (const pattern of secretPatterns) {
      if (searchGitHistory(directory, pattern)) {
        findings.push({
          id: `git-history-secret-${pattern.replace(/[^a-zA-Z0-9]/g, '')}`,
          severity: 'critical',
          category: 'git',
          title: `Secret found in git history: ${pattern}...`,
          message: `Pattern "${pattern}" appears in git commit history. Even if deleted from current files, it persists in history.`,
          fix: `Use BFG Repo-Cleaner to purge: bfg --replace-text secrets.txt. Then rotate the compromised credential.`,
          cwe: 'CWE-538',
          breach_precedent: 'GitGuardian 2026: 1.27M secrets tied to AI-generated commits.',
        });
      }
    }
  } else {
    findings.push({
      id: 'git-history-scan-pro',
      severity: 'info',
      category: 'git',
      title: 'Git history deep scan available with Pro',
      message: 'Upgrade to Pro to scan your entire git history for committed secrets.',
    });
  }

  return {
    scanner: 'check_git',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings,
  };
}

export function formatGitResults(result: ScanResult, _tier: Tier): string {
  const { findings } = result;
  const issues = findings.filter((f) => f.severity !== 'passed' && f.severity !== 'info');

  if (issues.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nGit security looks good. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [`~~ veilguard ~~ ${issues.length} git security issue${issues.length > 1 ? 's' : ''} found`, ''];
  for (const f of findings) {
    if (f.severity === 'passed') continue;
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    if (f.fix) lines.push(`  Fix: ${f.fix}`);
    lines.push('');
  }

  return lines.join('\n');
}
