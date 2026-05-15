import { readFile } from 'fs/promises';
import { join } from 'path';
import { scanDirectory } from '../utils/glob-scanner.js';
import { readFileSafe } from '../utils/file-reader.js';
import { logger } from '../utils/logger.js';
import { getPatternsDir } from '../utils/paths.js';
import type { Finding, ScanResult, Tier } from '../types.js';

/**
 * Pattern shape used by patterns/auth-rules.json.
 * Same idea as InjectionPattern but augmented with an optional category.
 */
interface AuthRule {
  id: string;
  name: string;
  pattern: string;
  severity: 'critical' | 'warning' | 'info' | 'passed';
  category?: string;
  fix: string;
  cwe?: string;
  breach_precedent?: string;
}

let authRulesCache: AuthRule[] | null = null;

async function loadAuthRules(): Promise<AuthRule[]> {
  if (authRulesCache) return authRulesCache;
  try {
    const p = join(getPatternsDir(), 'auth-rules.json');
    const raw = await readFile(p, 'utf-8');
    authRulesCache = JSON.parse(raw) as AuthRule[];
    return authRulesCache;
  } catch (error) {
    logger.error(`Failed to load auth rules: ${(error as Error).message}`);
    return [];
  }
}

/** Hints that a file is/contains API route handlers. */
function looksLikeRouteFile(filePath: string, content: string): boolean {
  const p = filePath.toLowerCase();
  if (
    p.includes('/api/') ||
    p.includes('/routes/') ||
    p.includes('/route.ts') ||
    p.includes('/route.js') ||
    p.includes('/handlers/') ||
    p.includes('/server/') ||
    p.includes('/controllers/')
  ) {
    return true;
  }
  // Express-style or Next.js route handler markers
  return (
    /\b(app|router)\.(post|put|patch|delete|get)\s*\(/.test(content) ||
    /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)\s*\(/.test(content) ||
    /export\s+const\s+(POST|PUT|PATCH|DELETE)\s*=/.test(content)
  );
}

function fileMentionsRateLimit(content: string): boolean {
  return (
    /rateLimit|rate-limit|rateLimiter|express-rate-limit|@upstash\/ratelimit|Ratelimit|slowDown/i.test(
      content,
    ) || /next-rate-limit|nextjs-rate-limit/.test(content)
  );
}

const PAYMENT_ROUTE_REGEX =
  /\/(checkout|charge|payment|payments|pay|billing|subscribe|subscription|invoice|order|orders|stripe|paystack|flutterwave|mpesa|m-pesa)\b/i;

/** Generic helpers used to keep noise down. */
function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(t|j)sx?$/.test(filePath) || filePath.includes('__tests__');
}

/* -----------------------------------------------------------
 * Individual heuristic checks
 * --------------------------------------------------------- */

/**
 * 1. Rate limiting missing on auth / payment / generic POST routes.
 *    Auth endpoints are already covered by auth-config-checker; this scanner
 *    targets payment + generic POST routes that currently slip through.
 */
function checkRateLimiting(filePath: string, content: string): Finding[] {
  if (!looksLikeRouteFile(filePath, content)) return [];
  if (fileMentionsRateLimit(content)) return [];

  const lines = content.split('\n');
  const findings: Finding[] = [];
  let emittedPayment = false;
  let emittedGeneric = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const isPaymentRoute =
      PAYMENT_ROUTE_REGEX.test(line) &&
      /(app|router)\.(post|put|patch)\s*\(|export\s+(async\s+)?function\s+POST\s*\(/.test(line);

    if (isPaymentRoute && !emittedPayment) {
      findings.push({
        id: 'rate-limit-missing-payment',
        severity: 'critical',
        category: 'rate-limit',
        title: 'No rate limiting on payment endpoint',
        message: `Payment endpoint at ${filePath}:${i + 1} has no rate limiting. Attackers can spam it.`,
        file: filePath,
        line: i + 1,
        fix: 'Add rate limiting (express-rate-limit, @upstash/ratelimit, or middleware) on payment / checkout routes.',
        cwe: 'CWE-770',
        breach_precedent:
          'Unlimited payment endpoints are abused for card-testing attacks costing thousands in Stripe fees overnight.',
      });
      emittedPayment = true;
    }

    const isGenericPost =
      /(app|router)\.post\s*\(/.test(line) ||
      /export\s+(async\s+)?function\s+POST\s*\(/.test(line) ||
      /export\s+const\s+POST\s*=/.test(line);

    if (isGenericPost && !isPaymentRoute && !emittedGeneric) {
      findings.push({
        id: 'rate-limit-missing-post',
        severity: 'warning',
        category: 'rate-limit',
        title: 'No rate limiting on POST route',
        message: `POST route at ${filePath}:${i + 1} has no rate limiting in this file.`,
        file: filePath,
        line: i + 1,
        fix: 'Add a rate limiter (express-rate-limit or @upstash/ratelimit) to mutating routes.',
        cwe: 'CWE-770',
      });
      emittedGeneric = true;
    }

    if (emittedPayment && emittedGeneric) break;
  }

  return findings;
}

/**
 * 2. IDOR — heuristics for handlers that read `req.params.id` and then use it
 *    inside a DB call without ever referencing the current user.
 *    Pattern-based IDOR detection also lives in injection-rules.json; this
 *    function adds a function-scope cross-reference check.
 */
function checkIdorHandlerScope(filePath: string, content: string): Finding[] {
  if (!/req\.(params|query)\.(id|userId|orderId)/.test(content)) return [];
  if (!/(prisma|supabase|db|sequelize|mongoose|knex)/i.test(content)) return [];

  const referencesCurrentUser =
    /req\.user\b|req\.session\.userId|req\.auth\b|getCurrentUser\(|auth\.uid\(|locals\.user|ctx\.user/.test(
      content,
    );
  if (referencesCurrentUser) return [];

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/req\.(params|query)\.(id|userId|orderId)/.test(lines[i])) {
      return [
        {
          id: 'idor-handler-scope',
          severity: 'critical',
          category: 'idor',
          title: 'Likely IDOR — handler uses req.params.id but never checks the current user',
          message: `Handler in ${filePath}:${i + 1} reads req.params.id and queries a database, but the file never references req.user / session / auth context.`,
          file: filePath,
          line: i + 1,
          fix: 'Pull the authenticated user (req.user.id) and include it in your WHERE clause or check ownership before responding.',
          cwe: 'CWE-639',
          breach_precedent:
            'Optus 2022: 9.8M records exfiltrated via /api/users/:id with no ownership check.',
        },
      ];
    }
  }
  return [];
}

/**
 * 3. Password security — pattern-driven via auth-rules.json (handled below)
 *    plus heuristic for "if (password === ...)" comparing plain text.
 */
function checkPlaintextPasswordCompare(filePath: string, content: string): Finding[] {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      /(user|account)\.password\s*===\s*req\.body\.password/.test(line) ||
      /req\.body\.password\s*===\s*\w+\.password\b/.test(line)
    ) {
      return [
        {
          id: 'password-plaintext-compare',
          severity: 'critical',
          category: 'auth',
          title: 'Plain-text password comparison',
          message: `Password compared with === at ${filePath}:${i + 1}. Stored passwords should be hashed and compared with bcrypt.compare / argon2.verify.`,
          file: filePath,
          line: i + 1,
          fix: 'Hash passwords with bcrypt (cost >= 12) and compare via await bcrypt.compare(input, hash).',
          cwe: 'CWE-256',
        },
      ];
    }
  }
  return [];
}

/**
 * 4. File upload security — uploads with no mime/size limits, or stored in public/.
 */
function checkFileUploads(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  if (!/multer|formidable|busboy|@vercel\/blob|next-connect|multipart/i.test(content)) return findings;

  const lines = content.split('\n');

  // No file-size limit configured anywhere in the file
  if (!/limits\s*:\s*\{[^}]*fileSize/i.test(content) && /multer\s*\(/.test(content)) {
    const line = lines.findIndex((l) => /multer\s*\(/.test(l));
    findings.push({
      id: 'upload-no-size-limit',
      severity: 'warning',
      category: 'upload',
      title: 'File upload has no size limit',
      message: `multer() configured in ${filePath}${line >= 0 ? ':' + (line + 1) : ''} without a fileSize limit. Attackers can fill disk and crash the server.`,
      file: filePath,
      line: line >= 0 ? line + 1 : undefined,
      fix: 'Add limits: { fileSize: 5 * 1024 * 1024 } (or similar) to your multer config.',
      cwe: 'CWE-400',
    });
  }

  // No mime/type filtering
  if (
    /multer\s*\(/.test(content) &&
    !/fileFilter\s*:|mimetype|accept\s*=\s*["']/.test(content)
  ) {
    const line = lines.findIndex((l) => /multer\s*\(/.test(l));
    findings.push({
      id: 'upload-no-type-filter',
      severity: 'warning',
      category: 'upload',
      title: 'File upload has no MIME / extension filter',
      message: `multer() in ${filePath} accepts any file type. Attackers can upload .html, .svg, or executable payloads.`,
      file: filePath,
      line: line >= 0 ? line + 1 : undefined,
      fix: 'Provide a fileFilter that whitelists allowed mimetypes (e.g. image/png, image/jpeg).',
      cwe: 'CWE-434',
    });
  }

  // Uploads stored to a publicly served directory
  if (/(dest|destination)\s*:\s*['"`][^'"`]*\/?public\//.test(content)) {
    const line = lines.findIndex((l) =>
      /(dest|destination)\s*:\s*['"`][^'"`]*\/?public\//.test(l),
    );
    findings.push({
      id: 'upload-public-dir',
      severity: 'critical',
      category: 'upload',
      title: 'User uploads stored in a public directory',
      message: `Uploads land in a publicly served folder (${filePath}:${line + 1}). Anyone who guesses the URL can fetch them.`,
      file: filePath,
      line: line >= 0 ? line + 1 : undefined,
      fix: 'Store uploads outside the public/ directory (e.g. S3, R2, or a private uploads/ folder) and serve through an authenticated route.',
      cwe: 'CWE-552',
    });
  }

  return findings;
}

/**
 * 5. Error exposure — stack traces / verbose error objects returned to clients.
 */
function checkErrorExposure(filePath: string, content: string): Finding[] {
  const lines = content.split('\n');
  const findings: Finding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      /res\.(status\s*\(\s*5\d\d\s*\))?\s*\.?(json|send)\s*\(\s*\{[^}]*(error|stack|err)\s*:\s*(err|error)\.(stack|message|toString)/i.test(
        line,
      ) ||
      /res\.(status\s*\(\s*5\d\d\s*\))?\s*\.?(json|send)\s*\(\s*(err|error)\.stack/i.test(line) ||
      /res\.(json|send)\s*\(\s*(err|error)\s*\)/.test(line)
    ) {
      findings.push({
        id: 'error-stack-exposed',
        severity: 'warning',
        category: 'error-exposure',
        title: 'Stack trace / error object returned to client',
        message: `Raw error returned to the client at ${filePath}:${i + 1}. Leaks file paths, stack frames, library internals.`,
        file: filePath,
        line: i + 1,
        fix: 'Return a generic message ({ error: "Internal server error" }) and log the full error server-side only.',
        cwe: 'CWE-209',
      });
      break;
    }
  }

  return findings;
}

/**
 * 6. Sensitive data logging — console.log of password / token / email / card data.
 */
function checkSensitiveLogging(filePath: string, content: string): Finding[] {
  const lines = content.split('\n');
  const findings: Finding[] = [];
  const re =
    /console\.(log|info|warn|error|debug)\s*\([^)]*\b(password|passwd|secret|token|api[_-]?key|authorization|jwt|credit[_-]?card|card[_-]?number|cvv|ssn|email|stripe[_-]?key)\b/i;

  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      findings.push({
        id: 'sensitive-log',
        severity: 'warning',
        category: 'logging',
        title: 'Sensitive data printed to logs',
        message: `${filePath}:${i + 1} logs sensitive data. Logs are searchable and end up in third-party log services.`,
        file: filePath,
        line: i + 1,
        fix: 'Never log passwords, tokens, full emails, or payment details. Mask or omit them.',
        cwe: 'CWE-532',
      });
      break;
    }
  }
  return findings;
}

/**
 * 7. Apply patterns/auth-rules.json against the file.
 *    Covers password storage, weak hashing, open redirects.
 */
function applyAuthRules(filePath: string, content: string, rules: AuthRule[]): Finding[] {
  const lines = content.split('\n');
  const findings: Finding[] = [];

  for (const rule of rules) {
    let regex: RegExp;
    try {
      regex = new RegExp(rule.pattern, 'gi');
    } catch {
      logger.debug(`Invalid auth-rule regex: ${rule.id}`);
      continue;
    }

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        findings.push({
          id: `auth-${rule.id}`,
          severity: rule.severity,
          category: rule.category ?? 'auth',
          title: rule.name,
          message: `${rule.name} at ${filePath}:${i + 1}.`,
          file: filePath,
          line: i + 1,
          fix: rule.fix,
          cwe: rule.cwe,
          breach_precedent: rule.breach_precedent,
        });
        break; // one finding per rule per file
      }
      regex.lastIndex = 0;
    }
  }

  return findings;
}

/** Run the app security scanner across a project. */
export async function scanAppSecurity(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const rules = await loadAuthRules();
  const files = await scanDirectory(directory, ['.ts', '.tsx', '.js', '.jsx', '.mjs']);

  const findings: Finding[] = [];

  for (const file of files) {
    if (isTestFile(file)) continue;
    const content = await readFileSafe(file);
    if (!content) continue;

    findings.push(...checkRateLimiting(file, content));
    findings.push(...checkIdorHandlerScope(file, content));
    findings.push(...checkPlaintextPasswordCompare(file, content));
    findings.push(...checkFileUploads(file, content));
    findings.push(...checkErrorExposure(file, content));
    findings.push(...checkSensitiveLogging(file, content));
    findings.push(...applyAuthRules(file, content, rules));
  }

  return {
    scanner: 'scan_app_security',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings,
  };
}

export function formatAppSecurityResults(result: ScanResult, tier: Tier): string {
  const { findings } = result;
  if (findings.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nNo app security issues found. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [
    `~~ veilguard ~~ ${findings.length} app security issue${findings.length > 1 ? 's' : ''} found`,
    '',
  ];

  for (const f of findings) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    if (tier === 'pro' && f.fix) lines.push(`  Fix: ${f.fix}`);
    else if (f.fix) lines.push(`  Fix: ${f.fix}`);
    if (f.breach_precedent) lines.push(`  Breach: ${f.breach_precedent}`);
    lines.push('');
  }

  return lines.join('\n');
}
