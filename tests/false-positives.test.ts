import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { scanSecrets } from '../src/scanners/secret-scanner.js';
import { checkCors } from '../src/scanners/cors-scanner.js';
import { scanInjection } from '../src/scanners/injection-scanner.js';
import { scanWebhooks } from '../src/scanners/webhook-scanner.js';
import { scanAppSecurity } from '../src/scanners/app-security-scanner.js';
import { checkEnv } from '../src/scanners/env-checker.js';
import { runAllScanners } from '../src/scanners/full-audit.js';
import { calculateScore } from '../src/scanners/scoring.js';
import type { Finding, ScanResult } from '../src/types.js';

// Secret tokens are assembled at runtime by concatenation so this committed test
// file contains no contiguous key (GitHub push protection would otherwise block
// it). The corpora are written to temp dirs — never committed — so the scanner
// sees a real, contiguous key while the repo never stores one.
const SK_LIVE = 'sk_live_';
const VULN_KEY = SK_LIVE + '51MgQ7rEZpKd9xViaTbN2HoWcUf3LsYjAemX8qB4tDoZ'; // high-entropy, real-looking
const EXAMPLE_KEY = SK_LIVE + '4eC39HqLyjWDarjtT1zdp7dcEXAMPLEKEY'; // matches regex, but an example
const FLW_EXAMPLE = 'FLWSECK_TEST-' + '0000000000000';

const criticals = (r: ScanResult): Finding[] => r.findings.filter((f) => f.severity === 'critical');

async function writeFiles(root: string, files: Record<string, string>): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    await mkdir(join(full, '..'), { recursive: true });
    await writeFile(full, content);
  }
}

// ── corpus contents ───────────────────────────────────────────────────────────

// A static marketing/docs site. Every dangerous-looking token is display copy,
// JSON-LD, or a doc example — none of it executable. NOTHING here may be flagged.
const CLEAN_FILES: Record<string, string> = {
  '.gitignore': 'node_modules/\n.next/\ndist/\n.env*\ncoverage/\n',

  'app/layout.tsx': [
    "import type { ReactNode } from 'react';",
    '',
    'const jsonLd = {',
    "  '@context': 'https://schema.org',",
    "  '@type': 'SoftwareApplication',",
    "  name: 'Veilguard',",
    "  description: 'Webhook signature verification for Stripe, Paystack, M-Pesa, GitHub, and Flutterwave',",
    "  url: 'https://veilguard.dev',",
    '};',
    '',
    'export default function RootLayout({ children }: { children: ReactNode }) {',
    '  return (',
    '    <html lang="en">',
    '      <head>',
    '        <script',
    '          type="application/ld+json"',
    '          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}',
    '        />',
    '      </head>',
    '      <body>',
    '        <header>Webhook signature verification for Stripe, Paystack, and Flutterwave</header>',
    '        {children}',
    '      </body>',
    '    </html>',
    '  );',
    '}',
    '',
  ].join('\n'),

  'app/page.tsx': [
    'const features = [',
    '  {',
    "    title: 'CORS misconfiguration detection',",
    `    desc: "Catches cors({ origin: '*' }) and other wide-open CORS setups before they ship",`,
    '  },',
    '  {',
    "    title: 'Secret scanning',",
    `    desc: 'Example: a leaked key like ${EXAMPLE_KEY} is flagged instantly',`,
    '  },',
    '  {',
    "    title: 'African fintech keys',",
    `    desc: 'We also catch Flutterwave ${FLW_EXAMPLE} placeholder keys and Paystack secrets',`,
    '  },',
    '  {',
    "    title: 'Webhook verification',",
    "    desc: 'Flags any /api/webhook handler that skips Stripe constructEvent signature checks',",
    '  },',
    '  {',
    "    title: 'SQL injection',",
    '    desc: "Catches db.query(`SELECT * FROM users WHERE id = ${userInput}`) style interpolation",',
    '  },',
    '  {',
    "    title: 'Environment security',",
    "    desc: 'Detects secrets exposed to the browser via the NEXT_PUBLIC_ prefix',",
    "    example: 'WARNING: NEXT_PUBLIC_SUPABASE_SERVICE_KEY exposes a secret to the browser bundle',",
    '  },',
    '];',
    '',
    'export default function Page() {',
    '  return <main>{features.map((f) => <p key={f.title}>{f.desc}</p>)}</main>;',
    '}',
    '',
  ].join('\n'),

  'content/guide.md': [
    '# Security Guide',
    '',
    'This documentation *describes* vulnerabilities. It is prose, not running code.',
    '',
    '## SQL injection',
    '',
    '```js',
    'db.query(`SELECT * FROM users WHERE id = ${req.params.id}`);',
    '```',
    '',
    '## Leaked secrets',
    '',
    'A real key looks like `' + EXAMPLE_KEY + '` or `' + FLW_EXAMPLE + '`. Move these to env vars.',
    '',
    '## CORS',
    '',
    'Avoid `cors({ origin: \'*\' })` on authenticated APIs.',
    '',
  ].join('\n'),

  // Safe, real config — the new JWT/TLS/cookie/SSRF rules must NOT fire on these.
  'lib/safe.ts': [
    "import jwt from 'jsonwebtoken';",
    "import https from 'https';",
    'const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);',
    'const agent = new https.Agent({ rejectUnauthorized: true });',
    "const cookie = { httpOnly: true, secure: true, sameSite: 'lax' };",
    "async function load() { return fetch('https://api.example.com/data'); }",
    'export { token, agent, cookie, load };',
    '',
  ].join('\n'),
};

// A genuinely insecure API. Every issue is real, executable code and MUST flag.
const VULN_FILES: Record<string, string> = {
  'api/charge.ts': [
    "import express from 'express';",
    "import cors from 'cors';",
    "import { db } from '../db';",
    '',
    'const router = express.Router();',
    `const STRIPE_SECRET = '${VULN_KEY}';`,
    '',
    "router.use(cors({ origin: '*' }));",
    '',
    "router.post('/api/charge', async (req, res) => {",
    '  const userId = req.query.userId;',
    '  const order = await db.query(`SELECT * FROM orders WHERE id = ${userId}`);',
    '  res.json({ order, key: STRIPE_SECRET });',
    '});',
    '',
    'export default router;',
    '',
  ].join('\n'),

  'api/webhook.ts': [
    "import express from 'express';",
    '',
    'const router = express.Router();',
    '',
    '// Stripe payment webhook — processes events with no signature verification.',
    "router.post('/api/webhook', async (req, res) => {",
    '  const event = req.body;',
    "  if (event.type === 'checkout.session.completed') {",
    '    grantAccess(event.data.object.customer);',
    '  }',
    '  res.json({ received: true });',
    '});',
    '',
    'function grantAccess(_customer: string): void {}',
    '',
    'export default router;',
    '',
  ].join('\n'),

  // SSRF, path traversal, hardcoded JWT secret, and disabled TLS verification.
  'api/proxy.ts': [
    "import jwt from 'jsonwebtoken';",
    "import https from 'https';",
    "import { readFile } from 'fs/promises';",
    '',
    'export async function handler(req: any, res: any) {',
    '  const upstream = await fetch(req.query.url);',
    "  const token = jwt.sign({ id: 1 }, 'supersecret123');",
    '  const agent = new https.Agent({ rejectUnauthorized: false });',
    '  const data = await readFile(req.query.path);',
    '  res.json({ upstream, token, agent, data });',
    '}',
    '',
  ].join('\n'),
};

let cleanDir: string;
let vulnDir: string;

beforeAll(async () => {
  cleanDir = await mkdtemp(join(tmpdir(), 'veilguard-clean-'));
  vulnDir = await mkdtemp(join(tmpdir(), 'veilguard-vuln-'));
  await writeFiles(cleanDir, CLEAN_FILES);
  await writeFiles(vulnDir, VULN_FILES);
});

afterAll(async () => {
  await rm(cleanDir, { recursive: true, force: true });
  await rm(vulnDir, { recursive: true, force: true });
});

// Every scanner that had a documented false positive, against the clean
// marketing-site corpus. None may produce a critical.
describe('false-positive corpus (clean marketing site) — zero criticals', () => {
  it('secret scanner does not flag keys mentioned in copy/docs', async () => {
    expect(criticals(await scanSecrets(cleanDir, 'free'))).toEqual([]);
  });

  it('CORS scanner does not flag cors({ origin: "*" }) inside a description string', async () => {
    expect(criticals(await checkCors(cleanDir, 'free'))).toEqual([]);
  });

  it('injection scanner does not flag db.query examples in strings/docs', async () => {
    expect(criticals(await scanInjection(cleanDir, 'free'))).toEqual([]);
  });

  it('injection scanner treats JSON-LD dangerouslySetInnerHTML as at most info', async () => {
    const r = await scanInjection(cleanDir, 'free');
    const xss = r.findings.filter((f) => f.id === 'injection-xss-dangerously-set');
    expect(xss.every((f) => f.severity === 'info')).toBe(true);
  });

  it('webhook scanner does not flag SEO copy that names providers', async () => {
    expect(await scanWebhooks(cleanDir, 'free').then((r) => r.findings)).toEqual([]);
  });

  it('env-checker does not flag NEXT_PUBLIC_ named in display copy', async () => {
    const r = await checkEnv(cleanDir, 'free');
    expect(r.findings.some((f) => f.id === 'env-next-public-secret')).toBe(false);
  });

  it('full audit grades the clean site A/B with zero criticals', async () => {
    const all = (await runAllScanners(cleanDir, 'free')).scans.flatMap((s) => s.findings);
    const { score, grade } = calculateScore(all);
    expect(all.filter((f) => f.severity === 'critical')).toEqual([]);
    expect(score).toBeGreaterThanOrEqual(80);
    expect(['A+', 'A', 'B+', 'B']).toContain(grade);
  });
});

// The same scanners against a genuinely vulnerable app: true positives must
// still fire exactly as before.
describe('true-positive corpus (vulnerable app) — still flagged', () => {
  it('secret scanner flags the hardcoded live key', async () => {
    const c = criticals(await scanSecrets(vulnDir, 'free'));
    expect(c.some((f) => f.id.startsWith('secret-stripe-sk-live'))).toBe(true);
  });

  it('CORS scanner flags the real wildcard origin call', async () => {
    const c = criticals(await checkCors(vulnDir, 'free'));
    expect(c.some((f) => f.id === 'cors-wildcard-origin')).toBe(true);
  });

  it('injection scanner flags the real template-literal query', async () => {
    const c = criticals(await scanInjection(vulnDir, 'free'));
    expect(c.some((f) => f.id === 'injection-sql-template-literal')).toBe(true);
  });

  it('webhook scanner flags the unverified handler', async () => {
    const c = criticals(await scanWebhooks(vulnDir, 'free'));
    expect(c.some((f) => f.id === 'webhook-unverified-stripe')).toBe(true);
  });

  it('flags SSRF and path traversal (OWASP A10 / A03)', async () => {
    const c = criticals(await scanInjection(vulnDir, 'free'));
    expect(c.some((f) => f.id === 'injection-ssrf-user-url')).toBe(true);
    expect(c.some((f) => f.id === 'injection-path-traversal-user-input')).toBe(true);
  });

  it('flags hardcoded JWT secret and disabled TLS verification (OWASP A02)', async () => {
    const c = criticals(await scanAppSecurity(vulnDir, 'free'));
    expect(c.some((f) => f.id === 'auth-jwt-hardcoded-secret')).toBe(true);
    expect(c.some((f) => f.id === 'auth-tls-reject-unauthorized-false')).toBe(true);
  });

  it('full audit grades the vulnerable app F', async () => {
    const all = (await runAllScanners(vulnDir, 'free')).scans.flatMap((s) => s.findings);
    const { score, grade } = calculateScore(all);
    expect(all.filter((f) => f.severity === 'critical').length).toBeGreaterThan(0);
    expect(grade).toBe('F');
    expect(score).toBeLessThan(60);
  });
});

// .gitignore glob coverage: `.env*` must cover `.env.local`, but a gitignore
// without any env entry must still flag it.
describe('env-checker honours .gitignore globs', () => {
  let covered: string;
  let uncovered: string;

  beforeAll(async () => {
    covered = await mkdtemp(join(tmpdir(), 'veilguard-env-cov-'));
    await writeFile(join(covered, '.gitignore'), 'node_modules/\n.env*\ndist/\n');
    await writeFile(join(covered, '.env.local'), 'SECRET=shhh\n');

    uncovered = await mkdtemp(join(tmpdir(), 'veilguard-env-unc-'));
    await writeFile(join(uncovered, '.gitignore'), 'node_modules/\ndist/\n');
    await writeFile(join(uncovered, '.env.local'), 'SECRET=shhh\n');
  });

  afterAll(async () => {
    await rm(covered, { recursive: true, force: true });
    await rm(uncovered, { recursive: true, force: true });
  });

  it('does not flag .env.local when .env* covers it', async () => {
    const r = await checkEnv(covered, 'free');
    expect(r.findings.some((f) => f.id.includes('not-gitignored'))).toBe(false);
  });

  it('still flags .env.local when no env entry covers it', async () => {
    const r = await checkEnv(uncovered, 'free');
    expect(r.findings.some((f) => f.id === 'env-not-gitignored-.env.local')).toBe(true);
  });
});
