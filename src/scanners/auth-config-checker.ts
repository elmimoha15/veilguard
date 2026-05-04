import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import { logger } from '../utils/logger.js';
import type { Finding, ScanResult, Tier } from '../types.js';

/** Detect which auth provider is used */
async function detectAuthProvider(directory: string): Promise<string | null> {
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx', '.json']);
  for (const file of files) {
    const content = await readFileSafe(file);
    if (!content) continue;
    if (content.includes('@clerk/')) return 'clerk';
    if (content.includes('next-auth') || content.includes('NextAuth')) return 'nextauth';
    if (content.includes('supabase') && content.includes('auth')) return 'supabase';
    if (content.includes('firebase') && content.includes('auth')) return 'firebase';
  }
  return null;
}

/** Check for common auth misconfigurations */
async function checkAuthPatterns(directory: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx']);

  for (const file of files) {
    const content = await readFileSafe(file);
    if (!content) continue;
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // getSession() on frontend (can be spoofed)
      if (/supabase\.auth\.getSession\(\)/.test(line) && !file.includes('server') && !file.includes('api/')) {
        findings.push({
          id: 'auth-getsession-frontend',
          severity: 'critical',
          category: 'auth',
          title: 'getSession() used on frontend (can be spoofed)',
          message: `supabase.auth.getSession() in ${file}:${i + 1} — this reads from localStorage and can be tampered with. Use getUser() for server-validated auth.`,
          file,
          line: i + 1,
          fix: 'Replace supabase.auth.getSession() with supabase.auth.getUser() which validates the JWT server-side.',
          cwe: 'CWE-287',
          breach_precedent: 'Cursor research showed getSession() can be spoofed, leading to auth bypass.',
        });
      }

      // Session stored in localStorage
      if (/localStorage\.setItem\s*\(\s*['"`](token|session|jwt|auth)/i.test(line)) {
        findings.push({
          id: 'auth-localstorage-session',
          severity: 'warning',
          category: 'auth',
          title: 'Session token stored in localStorage',
          message: `Session/token stored in localStorage at ${file}:${i + 1}. XSS attacks can steal it.`,
          file,
          line: i + 1,
          fix: 'Use httpOnly cookies for session storage. They cannot be accessed by JavaScript.',
          cwe: 'CWE-922',
        });
      }

      // Missing rate limiting on auth endpoints
      if (/\/(login|signin|signup|register|auth)\b/.test(line) && /\.(post|get|all)\s*\(/.test(line)) {
        // Check if rate limiter is imported/used in the file
        if (!content.includes('rateLimit') && !content.includes('rate-limit') && !content.includes('rateLimiter')) {
          findings.push({
            id: 'auth-no-rate-limit',
            severity: 'warning',
            category: 'auth',
            title: 'No rate limiting on auth endpoint',
            message: `Auth endpoint at ${file}:${i + 1} has no rate limiting. Brute force attacks are possible.`,
            file,
            line: i + 1,
            fix: 'Add rate limiting: npm install express-rate-limit, then apply to auth routes.',
            cwe: 'CWE-307',
          });
          break; // One per file
        }
      }
    }
  }

  return findings;
}

/** Run the auth config checker */
export async function checkAuthConfig(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const provider = await detectAuthProvider(directory);
  logger.debug(`Detected auth provider: ${provider ?? 'none'}`);

  const findings = await checkAuthPatterns(directory);

  return {
    scanner: 'check_auth_config',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings,
  };
}

export function formatAuthResults(result: ScanResult, tier: Tier): string {
  const { findings } = result;

  if (findings.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nAuth configuration looks good. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [
    `~~ veilguard ~~ ${findings.length} auth issue${findings.length > 1 ? 's' : ''} found`,
    '',
  ];

  for (const f of findings) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    if (tier === 'pro' && f.fix) lines.push(`  Fix: ${f.fix}`);
    else if (tier === 'free' && f.severity === 'critical') lines.push('  Fix: [Upgrade to Pro to see fix]');
    else if (f.fix) lines.push(`  Fix: ${f.fix}`);
    lines.push('');
  }

  return lines.join('\n');
}
