import { join } from 'path';
import { readFileSafe, readJsonFile } from '../utils/file-reader.js';
import { scanDirectory } from '../utils/glob-scanner.js';
import type { Finding, ScanResult, Tier } from '../types.js';

async function findRulesFile(directory: string): Promise<string | null> {
  // Check firebase.json for rules path
  const firebaseConfig = await readJsonFile<{ firestore?: { rules?: string }; database?: { rules?: string } }>(
    join(directory, 'firebase.json'),
  );

  if (firebaseConfig?.firestore?.rules) {
    return join(directory, firebaseConfig.firestore.rules);
  }
  if (firebaseConfig?.database?.rules) {
    return join(directory, firebaseConfig.database.rules);
  }

  // Search for common rules file names
  const files = await scanDirectory(directory, ['.rules']);
  if (files.length > 0) return files[0];

  // Check for firestore.rules or database.rules
  const candidates = ['firestore.rules', 'database.rules', 'storage.rules'];
  for (const name of candidates) {
    const content = await readFileSafe(join(directory, name));
    if (content !== null) return join(directory, name);
  }

  return null;
}

function analyzeRules(content: string, filePath: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // allow read, write: if true
    if (/allow\s+(read|write|read,\s*write)\s*:\s*if\s+true/i.test(line)) {
      findings.push({
        id: 'firebase-if-true',
        severity: 'critical',
        category: 'firebase',
        title: 'Firebase rule: allow if true',
        message: `"allow ... if true" at ${filePath}:${i + 1} — completely open to anyone on the internet.`,
        file: filePath,
        line: i + 1,
        fix: 'Replace with: allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;',
        cwe: 'CWE-862',
      });
    }

    // request.query.userId instead of request.auth.uid
    if (/request\.(query|data)\.userId\s*==\s*userId/i.test(line) && !line.includes('request.auth')) {
      findings.push({
        id: 'firebase-client-controlled-auth',
        severity: 'critical',
        category: 'firebase',
        title: 'Firebase rule: client-controlled auth check',
        message: `Rule at ${filePath}:${i + 1} uses request.query.userId or request.data.userId — client can set any value.`,
        file: filePath,
        line: i + 1,
        fix: 'Use request.auth.uid == userId instead of request.query.userId.',
        cwe: 'CWE-287',
      });
    }

    // allow read: if request.auth != null (too permissive)
    if (/allow\s+read\s*:\s*if\s+request\.auth\s*!=\s*null\s*;?\s*$/i.test(line.trim())) {
      findings.push({
        id: 'firebase-auth-not-null-only',
        severity: 'critical',
        category: 'firebase',
        title: 'Firebase rule: any logged-in user reads everything',
        message: `Rule at ${filePath}:${i + 1} only checks if user is authenticated, not if they own the data.`,
        file: filePath,
        line: i + 1,
        fix: 'Add ownership check: allow read: if request.auth != null && request.auth.uid == resource.data.userId;',
        cwe: 'CWE-862',
      });
    }
  }

  return findings;
}

export async function analyzeFirebase(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const findings: Finding[] = [];

  const rulesFile = await findRulesFile(directory);

  if (!rulesFile) {
    // Check if this is even a Firebase project
    const hasFirebaseJson = await readFileSafe(join(directory, 'firebase.json'));
    if (hasFirebaseJson !== null) {
      findings.push({
        id: 'firebase-no-rules-file',
        severity: 'warning',
        category: 'firebase',
        title: 'No Firebase rules file found',
        message: 'firebase.json exists but no rules file was found. Firebase may be using default rules which could be open.',
        fix: 'Create firestore.rules or database.rules with proper access controls.',
      });
    }
  } else {
    const content = await readFileSafe(rulesFile);
    if (content) {
      const ruleFindings = analyzeRules(content, rulesFile);
      findings.push(...ruleFindings);
    }
  }

  return {
    scanner: 'check_firebase',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings,
  };
}

export function formatFirebaseResults(result: ScanResult, _tier: Tier): string {
  const { findings } = result;

  if (findings.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nFirebase rules look properly configured. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [`~~ veilguard ~~ ${findings.length} Firebase rule issue${findings.length > 1 ? 's' : ''} found`, ''];
  for (const f of findings) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    if (f.fix) lines.push(`  Fix: ${f.fix}`);
    lines.push('');
  }
  return lines.join('\n');
}
