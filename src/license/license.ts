import { readFile, writeFile, mkdir } from 'fs/promises';
import { createHash } from 'crypto';
import {
  VEILGUARD_HOME,
  LICENSE_CACHE_PATH,
  AUDIT_USAGE_PATH,
  LICENSE_CACHE_TTL_MS,
  POLAR_API_URL,
  POLAR_SANDBOX_API_URL,
  POLAR_ORG_ID,
  USE_POLAR_SANDBOX,
  PRO_MONTHLY_AUDIT_LIMIT,
} from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import type { Tier, Finding } from '../types.js';

// ──────────────────────────────────────────────────────────────────────────────
// Veilguard license system (Polar.sh)
//
// getTier() is the single entry point every scanner relies on. Its contract is
// absolute: it NEVER throws, NEVER blocks longer than the network timeout, and
// NEVER crashes the MCP server. Every failure mode degrades to the free tier.
//
//   1. No VEILGUARD_KEY               → free (immediately)
//   2. Fresh cache (< 24h, same key)  → cached tier
//   3. Polar says "granted"/"active"  → pro   (cache it)
//   4. Polar says anything else       → free  (cache it — key is invalid)
//   5. Polar unreachable / timeout    → stale cache if we have one, else free
//
// The resolved tier is memoized for the lifetime of the process, so a long-lived
// MCP server validates once at startup and reuses the result for every scan.
// ──────────────────────────────────────────────────────────────────────────────

const POLAR_TIMEOUT_MS = 5000;
const PLACEHOLDER_KEYS = new Set(['', 'your_key_here', 'your-key-here']);

interface LicenseCache {
  tier: Tier;
  key_hash: string;
  validated_at: string;
  expires_at: string;
  polar_status: string;
}

interface AuditUsage {
  count: number;
  month: string;
}

// Resolved once per process. `undefined` = not yet resolved.
let sessionTier: Tier | undefined;

// ── helpers ───────────────────────────────────────────────────────────────────

// First 8 chars of the key's SHA-256. Lets us detect a changed key without ever
// persisting the raw key to disk.
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

// First 4 chars of the raw key, only for debug logs. Never log the full key.
function keyPrefix(key: string): string {
  return key.slice(0, 4);
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "2026-06"
}

function normalizedKey(): string | null {
  const key = process.env.VEILGUARD_KEY?.trim();
  if (!key || PLACEHOLDER_KEYS.has(key)) return null;
  return key;
}

// Create ~/.veilguard if needed. Returns false if the directory can't be created
// (e.g. a permissions issue) — callers then skip caching rather than crash.
async function ensureHome(): Promise<boolean> {
  try {
    await mkdir(VEILGUARD_HOME, { recursive: true });
    return true;
  } catch (error) {
    logger.warn(
      `License validation: cannot create ${VEILGUARD_HOME} (${(error as Error).message}) — caching disabled`,
    );
    return false;
  }
}

// ── cache read/write ───────────────────────────────────────────────────────────

async function readCache(): Promise<LicenseCache | null> {
  try {
    const raw = await readFile(LICENSE_CACHE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LicenseCache>;
    if (
      (parsed.tier === 'free' || parsed.tier === 'pro') &&
      typeof parsed.key_hash === 'string' &&
      typeof parsed.expires_at === 'string'
    ) {
      return parsed as LicenseCache;
    }
    return null;
  } catch {
    // Missing file or invalid JSON — treat as no cache.
    return null;
  }
}

async function writeCache(cache: LicenseCache): Promise<void> {
  if (!(await ensureHome())) return;
  try {
    await writeFile(LICENSE_CACHE_PATH, JSON.stringify(cache, null, 2));
  } catch (error) {
    logger.warn(`License validation: failed to write cache (${(error as Error).message})`);
  }
}

function buildCache(tier: Tier, key: string, polarStatus: string): LicenseCache {
  const now = Date.now();
  return {
    tier,
    key_hash: hashKey(key),
    validated_at: new Date(now).toISOString(),
    expires_at: new Date(now + LICENSE_CACHE_TTL_MS).toISOString(),
    polar_status: polarStatus,
  };
}

function isFresh(cache: LicenseCache): boolean {
  const expires = Date.parse(cache.expires_at);
  return Number.isFinite(expires) && Date.now() < expires;
}

// ── Polar validation ────────────────────────────────────────────────────────────

type PolarOutcome =
  | { kind: 'granted'; status: string }
  | { kind: 'invalid'; status: string }
  | { kind: 'unreachable' };

interface PolarResponse {
  status?: string;
}

// Calls Polar's validate endpoint. Distinguishes three outcomes:
//   • granted     — 200 + status "granted"/"active" → user is Pro
//   • invalid     — any other HTTP response (404/403/etc.) → key is not valid
//   • unreachable — timeout, network error, or unparseable body → unknown
async function validateWithPolar(key: string): Promise<PolarOutcome> {
  const url = USE_POLAR_SANDBOX ? POLAR_SANDBOX_API_URL : POLAR_API_URL;
  logger.debug(
    `License validation: calling Polar API (${USE_POLAR_SANDBOX ? 'sandbox' : 'production'})...`,
  );
  logger.debug(`License validation: validating key: ${keyPrefix(key)}...`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POLAR_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, organization_id: POLAR_ORG_ID }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.debug(`License validation: Polar API returned HTTP ${response.status}`);
      return { kind: 'invalid', status: `http_${response.status}` };
    }

    let body: PolarResponse;
    try {
      body = (await response.json()) as PolarResponse;
    } catch {
      logger.warn('License validation: Polar API returned invalid JSON, falling back to free');
      return { kind: 'unreachable' };
    }

    const status = body.status ?? 'unknown';
    if (status === 'granted' || status === 'active') {
      logger.debug(`License validation: API returned status=${status}, tier=pro`);
      return { kind: 'granted', status };
    }

    logger.debug(`License validation: API returned status=${status}, tier=free`);
    return { kind: 'invalid', status };
  } catch (error) {
    const name = (error as Error).name;
    const reason = name === 'AbortError' ? `timeout after ${POLAR_TIMEOUT_MS}ms` : (error as Error).message;
    logger.debug(`License validation: Polar API unreachable (${reason})`);
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

// ── tier resolution ──────────────────────────────────────────────────────────────

// The full resolution flow (uncached). Wrapped by getTier(), which memoizes.
async function resolveTier(): Promise<Tier> {
  const key = normalizedKey();
  if (!key) {
    logger.info('License tier: free (no key set)');
    return 'free';
  }

  const keyHash = hashKey(key);

  // 1. Fresh cache for this exact key wins — no network call needed.
  logger.debug('License validation: checking cache...');
  const cache = await readCache();
  if (cache && cache.key_hash === keyHash && isFresh(cache)) {
    logger.debug(`License validation: cache valid, tier=${cache.tier}`);
    if (cache.tier === 'pro') logger.info('License tier: pro');
    else logger.info('License tier: free (invalid key)');
    return cache.tier;
  }
  if (cache && cache.key_hash !== keyHash) {
    logger.debug('License validation: key changed since last validation, re-validating');
  }

  // Without an org id we cannot validate against Polar at all.
  if (!POLAR_ORG_ID) {
    logger.warn('License validation: POLAR_ORG_ID is not set, cannot validate — falling back to free');
    return 'free';
  }

  // 2. Ask Polar.
  const outcome = await validateWithPolar(key);

  if (outcome.kind === 'granted') {
    await writeCache(buildCache('pro', key, outcome.status));
    logger.info('License tier: pro');
    return 'pro';
  }

  if (outcome.kind === 'invalid') {
    await writeCache(buildCache('free', key, outcome.status));
    logger.info('License tier: free (invalid key)');
    return 'free';
  }

  // 3. Unreachable — lean on a stale cache for this key if we have one.
  if (cache && cache.key_hash === keyHash) {
    logger.warn('License validation: Polar API unreachable, using cached tier');
    logger.info(`License tier: ${cache.tier}${cache.tier === 'free' ? ' (cached)' : ''}`);
    return cache.tier;
  }

  logger.warn('License validation: network error, falling back to free');
  logger.info('License tier: free (validation unavailable)');
  return 'free';
}

// Returns the caller's tier. Never throws. Memoized for the process lifetime so
// the MCP server validates once at startup and reuses the result for every scan.
export async function getTier(): Promise<Tier> {
  if (sessionTier !== undefined) return sessionTier;
  try {
    sessionTier = await resolveTier();
  } catch (error) {
    // Absolute last-resort guard — resolveTier already handles its own errors.
    logger.warn(`License validation: unexpected error (${(error as Error).message}), defaulting to free`);
    sessionTier = 'free';
  }
  return sessionTier;
}

// ── audit usage (Pro monthly limit) ──────────────────────────────────────────────

// Read the audit-usage counter, transparently resetting it when the month rolls
// over. Never throws — returns a zeroed counter for the current month on error.
async function readAuditUsage(): Promise<AuditUsage> {
  const month = currentMonth();
  try {
    const raw = await readFile(AUDIT_USAGE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AuditUsage>;
    if (parsed.month === month && typeof parsed.count === 'number' && parsed.count >= 0) {
      return { count: parsed.count, month };
    }
    // Different month (or malformed) → start fresh for the current month.
    return { count: 0, month };
  } catch {
    return { count: 0, month };
  }
}

async function writeAuditUsage(usage: AuditUsage): Promise<void> {
  if (!(await ensureHome())) return;
  try {
    await writeFile(AUDIT_USAGE_PATH, JSON.stringify(usage, null, 2));
  } catch (error) {
    logger.warn(`License validation: failed to write audit usage (${(error as Error).message})`);
  }
}

// How many full audits the user has left this month. Free users always get 0.
export async function getAuditUsageRemaining(): Promise<number> {
  if ((await getTier()) !== 'pro') return 0;
  const usage = await readAuditUsage();
  return Math.max(0, PRO_MONTHLY_AUDIT_LIMIT - usage.count);
}

// True only when the user is Pro AND has audits remaining this month.
export async function canRunAudit(): Promise<boolean> {
  if ((await getTier()) !== 'pro') return false;
  return (await getAuditUsageRemaining()) > 0;
}

// Increment the monthly audit counter. Call after a successful full audit.
export async function recordAuditUsage(): Promise<void> {
  try {
    const usage = await readAuditUsage(); // already month-normalized
    usage.count += 1;
    await writeAuditUsage(usage);
    logger.debug(`License: recorded audit usage (${usage.count}/${PRO_MONTHLY_AUDIT_LIMIT} this month)`);
  } catch (error) {
    logger.warn(`License: failed to record audit usage (${(error as Error).message})`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Upsell / messaging — unchanged behaviour, used by scanner formatters and the
// MCP tool handlers.
// ──────────────────────────────────────────────────────────────────────────────

// The full security audit (grade + AI fix prompt) is a Pro-only tool. Free
// users get this upsell instead — they do not get any full audit at all.
export function getFullAuditMessage(): string {
  return [
    '~~ veilguard ~~ Full audit is a Pro feature 🔒',
    '',
    'The full security audit grades your whole project (A+ to F) and writes an',
    'AI-ready fix prompt that patches every issue at once. It\'s unlimited on Pro.',
    '',
    'Want your grade and the one-paste fix? Upgrade to Pro:',
    '→ veilguard.dev/pro ($19/mo or $149/yr — save 35%)',
    '',
    'Meanwhile, the individual scanners still run free and will alert you to any',
    'vulnerability they find (the fixes for those are unlocked with Pro too).',
    '',
    'Add your key to the MCP config: VEILGUARD_KEY=your_key_here',
  ].join('\n');
}

// Shown to a Pro user who has used all of their monthly full audits.
export function getAuditLimitMessage(): string {
  return [
    `~~ veilguard ~~ Monthly full-audit limit reached (${PRO_MONTHLY_AUDIT_LIMIT}/${PRO_MONTHLY_AUDIT_LIMIT}) 🔒`,
    '',
    `Your Pro plan includes ${PRO_MONTHLY_AUDIT_LIMIT} full audits per month, and you've used them all.`,
    'The counter resets at the start of next month.',
    '',
    'The individual scanners still run unlimited — only the scored full audit is capped.',
  ].join('\n');
}

// The free/pro gate for an individual finding's "solution". Free users see the
// ALERT (severity, title, message) but never the fix or breach context — those
// are the paid value, and we actively offer the upgrade. Pro users get both.
// Every scanner formatter routes its fix/breach lines through this so the gate
// stays consistent.
export function renderFix(f: Finding, tier: Tier, indent = '  '): string[] {
  if (!f.fix && !f.breach_precedent) return []; // nothing to hide or show
  if (tier === 'pro') {
    const out: string[] = [];
    if (f.fix) out.push(`${indent}Fix: ${f.fix}`);
    if (f.breach_precedent) out.push(`${indent}Breach: ${f.breach_precedent}`);
    return out;
  }
  return [`${indent}Fix: 🔒 Want the fix? It's a Pro feature — unlock the exact solution at veilguard.dev/pro`];
}

export function getUpgradeMessage(hiddenCount: number): string {
  return [
    `~~ veilguard ~~ ${hiddenCount} more issue${hiddenCount > 1 ? 's' : ''} found`,
    '',
    'Upgrade to Pro to see all findings + fix suggestions.',
    '→ veilguard.dev/pro ($19/mo or $149/yr — save 35%)',
    '',
    'Pro includes:',
    '  ✓ All findings shown (no caps)',
    '  ✓ Fix suggestions for every issue',
    '  ✓ Full git history deep scan',
    '  ✓ All dependencies checked',
    '  ✓ Supabase RLS deep audit',
    '  ✓ Firebase rules audit',
    '  ✓ Unlimited full audits with grade (A+ to F)',
    '  ✓ AI-ready fix prompt (paste to fix everything)',
    '  ✓ Breach precedent context',
    '',
    'Add your key to the MCP config:',
    '  VEILGUARD_KEY=your_key_here',
  ].join('\n');
}

export function getProOnlyMessage(toolName: string): string {
  return [
    '~~ veilguard ~~ Pro feature',
    '',
    `${toolName} requires Pro.`,
    '→ veilguard.dev/pro ($19/mo or $149/yr)',
    '',
    'Add your key: VEILGUARD_KEY=your_key_here',
    'Then restart your IDE. That\'s it.',
  ].join('\n');
}
