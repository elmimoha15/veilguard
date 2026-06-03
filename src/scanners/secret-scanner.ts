import { readFile } from 'fs/promises';
import { join } from 'path';
import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import { logger } from '../utils/logger.js';
import { getPatternsDir } from '../utils/paths.js';
import { FREE_TIER_MAX_FINDINGS } from '../utils/constants.js';
import { getUpgradeMessage } from '../license/license.js';
import { vetMatch, isDocFile, isTestOrExampleFile } from '../utils/match-context.js';
import type { Finding, ScanResult, SecretPattern, Tier } from '../types.js';

let patternsCache: SecretPattern[] | null = null;

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

function maskSecret(value: string): string {
  if (value.length <= 12) return value.substring(0, 4) + '...';
  return value.substring(0, 8) + '...';
}

function isEnvFile(filePath: string): boolean {
  const name = filePath.split('/').pop() || '';
  return name.startsWith('.env');
}

function isFrontendFile(filePath: string): boolean {
  const p = filePath.toLowerCase();
  const frontendDirs = ['/components/', '/pages/', '/app/', '/src/components/', '/src/pages/', '/src/app/'];
  const backendDirs = ['/api/', '/server/', '/lib/server/', '/routes/', '/backend/'];
  
  // If in a backend directory, not frontend
  if (backendDirs.some(dir => p.includes(dir))) return false;
  
  // If in a frontend directory, it's frontend
  if (frontendDirs.some(dir => p.includes(dir))) return true;
  
  // Files ending in .tsx or .jsx in src/ are likely frontend
  if ((p.endsWith('.tsx') || p.endsWith('.jsx')) && p.includes('/src/')) return true;
  
  return false;
}

function checkServiceRoleInFrontend(filePath: string, content: string, rootDir: string): Finding[] {
  if (!isFrontendFile(filePath)) return [];

  const lines = content.split('\n');

  // Check for service_role key patterns in frontend
  const serviceRolePatterns = [
    /service_role/i,
    /SUPABASE_SERVICE_ROLE/i,
    /serviceRoleKey/i,
    /service[-_]?role[-_]?key/i,
  ];

  // Also check for the actual JWT pattern that service_role keys use
  const jwtPattern = /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{20,}/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for service_role variable names
    for (const pattern of serviceRolePatterns) {
      const m = pattern.exec(line);
      if (m) {
        const vetted = vetMatch(
          {
            id: 'secret-service-role-frontend',
            severity: 'critical',
            category: 'secret',
            title: 'Supabase service_role key in frontend',
            message: `Your Supabase service_role key is exposed in frontend code at ${filePath}:${i + 1}. This key bypasses all your database security rules. Anyone who finds it can read, write, and delete every row in your entire database. This is exactly how the Moltbook breach happened — 1.5 million records exposed. Move this key to server-side only immediately.`,
            file: filePath,
            line: i + 1,
            fix: 'Remove this key from frontend code. Use the anon key for client-side and service_role only in server-side API routes.',
            cwe: 'CWE-798',
            breach_precedent: 'Moltbook breach: 1.5M tokens + 35K emails exposed via service_role key in frontend.',
          },
          { filePath, content, lineIndex: i, column: m.index, matchText: m[0], rootDir, mode: 'code-construct' },
        );
        if (vetted) return [vetted];
      }
    }

    // Check for JWT that might be service_role (if in frontend and looks like Supabase)
    const jwt = jwtPattern.exec(line);
    if (jwt && /supabase/i.test(content)) {
      // Check if this is being used as a client key (dangerous)
      if (/createClient|supabaseClient|SupabaseClient/i.test(content)) {
        const vetted = vetMatch(
          {
            id: 'secret-jwt-in-frontend',
            severity: 'critical',
            category: 'secret',
            title: 'Supabase JWT key in frontend code',
            message: `A Supabase JWT key is hardcoded in frontend code at ${filePath}:${i + 1}. If this is the service_role key, your entire database is exposed. Verify this is only the anon key.`,
            file: filePath,
            line: i + 1,
            fix: 'Use environment variables: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY for frontend. Never expose service_role.',
            cwe: 'CWE-798',
          },
          { filePath, content, lineIndex: i, column: jwt.index, matchText: jwt[0], rootDir, mode: 'secret-value' },
        );
        if (vetted) return [vetted];
      }
    }
  }

  return [];
}

function checkClientSideAiCalls(filePath: string, content: string, rootDir: string): Finding[] {
  if (!isFrontendFile(filePath)) return [];

  const findings: Finding[] = [];
  const lines = content.split('\n');

  const aiApiPatterns = [
    { pattern: /fetch\s*\(\s*['"`]https:\/\/api\.openai\.com/i, name: 'OpenAI API' },
    { pattern: /fetch\s*\(\s*['"`]https:\/\/api\.anthropic\.com/i, name: 'Anthropic API' },
    { pattern: /fetch\s*\(\s*['"`]https:\/\/generativelanguage\.googleapis\.com/i, name: 'Google AI API' },
    { pattern: /new\s+OpenAI\s*\(/i, name: 'OpenAI SDK' },
    { pattern: /new\s+Anthropic\s*\(/i, name: 'Anthropic SDK' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { pattern, name } of aiApiPatterns) {
      const m = pattern.exec(line);
      if (m) {
        const vetted = vetMatch(
          {
            id: 'secret-client-side-ai-api',
            severity: 'critical',
            category: 'secret',
            title: `${name} called from frontend`,
            message: `Your AI API is being called directly from the browser at ${filePath}:${i + 1}. Any visitor to your site can steal your API key from the network tab and run up thousands of dollars in charges overnight. Move this call to a backend API route.`,
            file: filePath,
            line: i + 1,
            fix: 'Move this API call to a server-side API route (e.g., /api/chat) and call that from your frontend instead.',
            cwe: 'CWE-200',
            breach_precedent: 'The $82,000 overnight bill attack: exposed AI keys get scraped and abused within hours.',
          },
          { filePath, content, lineIndex: i, column: m.index, matchText: m[0], rootDir, mode: 'code-construct' },
        );
        if (vetted) findings.push(vetted);
        break;
      }
    }

    // Check for Authorization: Bearer in frontend fetch calls
    const bearer =
      /['"`]Authorization['"`]\s*:\s*['"`]Bearer\s+/.exec(line) ||
      /Authorization['"`]?\s*:\s*`Bearer\s+\$\{/.exec(line);
    if (bearer) {
      const vetted = vetMatch(
        {
          id: 'secret-client-side-bearer-token',
          severity: 'critical',
          category: 'secret',
          title: 'Bearer token in frontend code',
          message: `Authorization header with Bearer token constructed in frontend code at ${filePath}:${i + 1}. This exposes your API key to anyone viewing the network tab.`,
          file: filePath,
          line: i + 1,
          fix: 'Never send API keys from the browser. Create a backend API route that adds the Authorization header server-side.',
          cwe: 'CWE-200',
          breach_precedent: 'The $82,000 overnight bill attack: exposed AI keys get scraped and abused within hours.',
        },
        { filePath, content, lineIndex: i, column: bearer.index, matchText: bearer[0], rootDir, mode: 'code-construct' },
      );
      if (vetted) findings.push(vetted);
    }
  }

  return findings;
}

async function scanFile(
  filePath: string,
  patterns: SecretPattern[],
  rootDir: string,
): Promise<Finding[]> {
  if (isEnvFile(filePath)) return [];
  // Documentation and test/example files describe secrets — they don't leak them.
  if (isDocFile(filePath) || isTestOrExampleFile(filePath, rootDir)) return [];

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
          const vetted = vetMatch(
            {
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
            },
            { filePath, content, lineIndex: lineNum, column: match.index, matchText: match[0], rootDir, mode: 'secret-value' },
          );
          if (vetted) findings.push(vetted);
        }
      }
    } catch {
      logger.debug(`Invalid regex pattern: ${pattern.id}`);
    }
  }

  // Special: detect fallback trap keys (process.env.X || "sk_live_...")
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const m = /process\.env\.\w+\s*\|\|\s*["']([a-zA-Z0-9_-]{10,})["']/.exec(line);
    if (m) {
      const vetted = vetMatch(
        {
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
        },
        // Classify the fallback *value* (group 1) so a placeholder fallback is ignored.
        { filePath, content, lineIndex: lineNum, column: m.index, matchText: m[1], rootDir, mode: 'secret-value' },
      );
      if (vetted) findings.push(vetted);
    }
  }

  // Check for client-side AI API calls (the $82,000 overnight bill attack)
  findings.push(...checkClientSideAiCalls(filePath, content, rootDir));

  // Check for service_role key in frontend (the Moltbook attack)
  findings.push(...checkServiceRoleInFrontend(filePath, content, rootDir));

  return findings;
}

export async function scanSecrets(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const patterns = await loadPatterns();
  const files = await scanDirectory(directory);

  logger.debug(`Scanning ${files.length} files for ${patterns.length} secret patterns`);

  const allFindings: Finding[] = [];

  for (const file of files) {
    const findings = await scanFile(file, patterns, directory);
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
