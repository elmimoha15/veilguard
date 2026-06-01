import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import { logger } from '../utils/logger.js';
import { renderFix } from '../license/license.js';
import type { Finding, ScanResult, Tier } from '../types.js';

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

function checkPasswordResetSecurity(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');
  
  // Only check files that look like password reset handlers
  if (!/reset|forgot|password/i.test(filePath) && !/reset|forgot/i.test(content)) {
    return findings;
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for Math.random() used for token generation (insecure)
    if (/Math\.random\s*\(\s*\)/.test(line) && /token|reset|password/i.test(content)) {
      findings.push({
        id: 'auth-weak-reset-token',
        severity: 'critical',
        category: 'auth',
        title: 'Weak password reset token (Math.random)',
        message: `Your password reset flow uses Math.random() at ${filePath}:${i + 1}. This is predictable and attackers can guess reset tokens. Use crypto.randomBytes() instead.`,
        file: filePath,
        line: i + 1,
        fix: "Use crypto.randomBytes(32).toString('hex') for secure token generation.",
        cwe: 'CWE-330',
        breach_precedent: 'Predictable reset tokens allow account takeover by guessing the token.',
      });
    }
    
    // Check for token in URL without expiry validation
    if (/req\.(query|params)\.token/.test(line) && !/expir|valid|timestamp|createdAt/i.test(content)) {
      findings.push({
        id: 'auth-reset-token-no-expiry',
        severity: 'warning',
        category: 'auth',
        title: 'Password reset token without expiry check',
        message: `Password reset token read from URL at ${filePath}:${i + 1} but no expiry validation found. Old tokens should expire after 1 hour.`,
        file: filePath,
        line: i + 1,
        fix: 'Store token creation time and reject tokens older than 1 hour. Also invalidate after use.',
        cwe: 'CWE-640',
      });
    }
  }
  
  // Check for missing rate limiting on reset endpoint
  if (/\/reset|\/forgot|password-reset|forgot-password/i.test(content)) {
    if (!/rateLimit|rate-limit|rateLimiter/i.test(content)) {
      for (let i = 0; i < lines.length; i++) {
        if (/\.(post|get|all)\s*\(\s*['"`].*reset|forgot/i.test(lines[i])) {
          findings.push({
            id: 'auth-reset-no-rate-limit',
            severity: 'warning',
            category: 'auth',
            title: 'No rate limiting on password reset',
            message: `Password reset endpoint at ${filePath}:${i + 1} has no rate limiting. Attackers can spam reset emails to harass users or enumerate accounts.`,
            file: filePath,
            line: i + 1,
            fix: 'Add rate limiting: max 3 reset requests per email per hour.',
            cwe: 'CWE-307',
          });
          break;
        }
      }
    }
  }
  
  // Check for token reuse (no invalidation after use)
  if (/token/.test(content) && /reset|password/i.test(content)) {
    // If we see token validation but no deletion/invalidation
    if (/findOne|findUnique|where.*token/i.test(content) && 
        !/delete|remove|invalidate|used\s*=\s*true|update.*used/i.test(content)) {
      findings.push({
        id: 'auth-reset-token-reuse',
        severity: 'warning',
        category: 'auth',
        title: 'Password reset token may be reusable',
        message: `Password reset flow in ${filePath} validates tokens but may not invalidate them after use. Tokens should be single-use.`,
        file: filePath,
        fix: 'Delete or mark the token as used immediately after successful password reset.',
        cwe: 'CWE-640',
      });
    }
  }
  
  return findings;
}

async function checkAuthPatterns(directory: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx']);

  for (const file of files) {
    const content = await readFileSafe(file);
    if (!content) continue;
    const lines = content.split('\n');
    
    // Check password reset security (GAP 6)
    findings.push(...checkPasswordResetSecurity(file, content));

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
    lines.push(...renderFix(f, tier));
    lines.push('');
  }

  return lines.join('\n');
}
