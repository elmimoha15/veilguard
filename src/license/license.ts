import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { createHash, randomUUID } from 'crypto';
import {
  VEILGUARD_HOME,
  LICENSE_CACHE_PATH,
  AUDIT_USAGE_PATH,
  ACTIVATION_PATH,
  MACHINE_ID_PATH,
  LICENSE_CACHE_TTL_MS,
  POLAR_API_URL,
  POLAR_SANDBOX_API_URL,
  POLAR_ACTIVATE_URL,
  POLAR_SANDBOX_ACTIVATE_URL,
  POLAR_DEACTIVATE_URL,
  POLAR_SANDBOX_DEACTIVATE_URL,
  POLAR_ORG_ID,
  USE_POLAR_SANDBOX,
  PRO_MONTHLY_AUDIT_LIMIT,
  UPSELL_NUDGE_THRESHOLD,
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
// Anti-sharing: the Polar License Key benefit MUST have "Limit activations" set.
// Each machine claims one activation slot on first validation (bound to a stable
// machine id stored in ~/.veilguard). Subsequent runs reuse that activation id, so
// a key shared beyond the limit can't activate the extra machines → they get free.
//
// IMPORTANT (Polar API contract): the /activate endpoint returns HTTP 403 with an
// identical message — "License key activation not supported or limit reached" —
// whether the limit was hit OR the benefit simply has no activation limit set. The
// two are indistinguishable, so we fail closed: any 403 → free. Practical upshot:
// if "Limit activations" is NOT configured on the benefit, EVERY machine gets 403
// and therefore free. Configure the activation limit, or no one gets Pro.
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

// The activation slot Polar issued for this machine, tied to the current key.
interface ActivationRecord {
  key_hash: string;
  activation_id: string;
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

// ── machine id + activation record ────────────────────────────────────────────────

// A stable, random per-machine id, persisted once to ~/.veilguard/machine-id. It
// is opaque (a random UUID — no hardware/PII) and only used to label this machine's
// activation slot in Polar. Falls back to an ephemeral id if it can't be persisted.
async function getMachineId(): Promise<string> {
  try {
    const existing = (await readFile(MACHINE_ID_PATH, 'utf-8')).trim();
    if (existing) return existing;
  } catch {
    // Not created yet — fall through and create it.
  }
  const id = randomUUID();
  if (await ensureHome()) {
    try {
      await writeFile(MACHINE_ID_PATH, id);
    } catch (error) {
      logger.warn(`License validation: failed to persist machine id (${(error as Error).message})`);
    }
  }
  return id;
}

async function readActivation(): Promise<ActivationRecord | null> {
  try {
    const parsed = JSON.parse(await readFile(ACTIVATION_PATH, 'utf-8')) as Partial<ActivationRecord>;
    if (typeof parsed.key_hash === 'string' && typeof parsed.activation_id === 'string') {
      return parsed as ActivationRecord;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeActivation(record: ActivationRecord): Promise<void> {
  if (!(await ensureHome())) return;
  try {
    await writeFile(ACTIVATION_PATH, JSON.stringify(record, null, 2));
  } catch (error) {
    logger.warn(`License validation: failed to write activation (${(error as Error).message})`);
  }
}

async function clearActivation(): Promise<void> {
  try {
    await rm(ACTIVATION_PATH, { force: true });
  } catch {
    // Best effort — a leftover record is harmless (it just re-validates).
  }
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
//   • invalid     — any other HTTP response (404/403/422/etc.) → key/activation not valid
//   • unreachable — timeout, network error, or unparseable body → unknown
// When `activationId` is supplied it is sent too, so Polar checks the key is still
// valid AND that this machine's activation slot is still live.
async function validateWithPolar(key: string, activationId?: string): Promise<PolarOutcome> {
  const url = USE_POLAR_SANDBOX ? POLAR_SANDBOX_API_URL : POLAR_API_URL;
  logger.debug(
    `License validation: calling Polar API (${USE_POLAR_SANDBOX ? 'sandbox' : 'production'})...`,
  );
  logger.debug(`License validation: validating key: ${keyPrefix(key)}...`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POLAR_TIMEOUT_MS);

  const payload: Record<string, unknown> = { key, organization_id: POLAR_ORG_ID };
  if (activationId) payload.activation_id = activationId;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

// ── Polar activation ────────────────────────────────────────────────────────────

type ActivateOutcome =
  | { kind: 'activated'; activationId: string }
  | { kind: 'limit_reached' } // 403: limit hit OR activations not enabled (Polar can't distinguish)
  | { kind: 'invalid' } //        404 bad key / 422 malformed / other
  | { kind: 'unreachable' };

// Claims an activation slot for this machine. Polar caps the number of slots at
// the benefit's "Limit activations" value, so the (limit+1)-th machine is rejected.
async function activateWithPolar(key: string, machineId: string): Promise<ActivateOutcome> {
  const url = USE_POLAR_SANDBOX ? POLAR_SANDBOX_ACTIVATE_URL : POLAR_ACTIVATE_URL;
  logger.debug('License validation: activating this machine with Polar...');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POLAR_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        organization_id: POLAR_ORG_ID,
        label: `veilguard-${machineId.slice(0, 8)}`,
        meta: { machine_id: machineId, source: 'veilguard-mcp' },
      }),
      signal: controller.signal,
    });

    if (response.ok) {
      let body: { id?: string };
      try {
        body = (await response.json()) as { id?: string };
      } catch {
        return { kind: 'unreachable' };
      }
      if (typeof body.id === 'string' && body.id.length > 0) {
        logger.debug('License validation: machine activated');
        return { kind: 'activated', activationId: body.id };
      }
      return { kind: 'unreachable' };
    }

    // Polar returns 403 with one ambiguous message for BOTH "limit reached" and
    // "activations not enabled on this benefit". We require activations, so a 403
    // means this machine can't claim a slot → no Pro (fail closed).
    if (response.status === 403) {
      logger.warn('License validation: activation refused (limit reached, or activations not enabled on the benefit)');
      return { kind: 'limit_reached' };
    }
    logger.debug(`License validation: activate returned HTTP ${response.status}`);
    return { kind: 'invalid' };
  } catch (error) {
    const name = (error as Error).name;
    const reason = name === 'AbortError' ? `timeout after ${POLAR_TIMEOUT_MS}ms` : (error as Error).message;
    logger.debug(`License validation: activate unreachable (${reason})`);
    return { kind: 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

// Releases this machine's activation slot. Best effort — never throws.
async function deactivateWithPolar(key: string, activationId: string): Promise<boolean> {
  const url = USE_POLAR_SANDBOX ? POLAR_SANDBOX_DEACTIVATE_URL : POLAR_DEACTIVATE_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), POLAR_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, organization_id: POLAR_ORG_ID, activation_id: activationId }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ── tier resolution ──────────────────────────────────────────────────────────────

type TierOutcome =
  | { kind: 'granted' }
  | { kind: 'invalid' }
  | { kind: 'limit' } // activation limit hit — key is on too many machines
  | { kind: 'unreachable' };

// Resolve against Polar, binding this machine to an activation slot when the
// benefit enforces a limit, and falling back to plain validation when it doesn't.
async function resolveAgainstPolar(key: string, keyHash: string): Promise<TierOutcome> {
  // (a) Reuse this machine's existing activation for this key, if we have one.
  const stored = await readActivation();
  if (stored && stored.key_hash === keyHash) {
    const v = await validateWithPolar(key, stored.activation_id);
    if (v.kind === 'granted') return { kind: 'granted' };
    if (v.kind === 'unreachable') return { kind: 'unreachable' };
    // The stored activation was revoked/removed server-side — drop it, re-activate.
    logger.debug('License validation: stored activation no longer valid, re-activating');
    await clearActivation();
  }

  // (b) Claim a fresh activation slot for this machine.
  const machineId = await getMachineId();
  const act = await activateWithPolar(key, machineId);

  switch (act.kind) {
    case 'activated':
      await writeActivation({ key_hash: keyHash, activation_id: act.activationId });
      return { kind: 'granted' };
    case 'limit_reached':
      return { kind: 'limit' };
    case 'invalid':
      return { kind: 'invalid' };
    case 'unreachable':
      return { kind: 'unreachable' };
  }
}

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
    // A different key invalidates this machine's old activation slot.
    await clearActivation();
  }

  // Without an org id we cannot validate against Polar at all.
  if (!POLAR_ORG_ID) {
    logger.warn('License validation: POLAR_ORG_ID is not set, cannot validate — falling back to free');
    return 'free';
  }

  // 2. Ask Polar — validating this machine's slot or claiming a new one.
  const outcome = await resolveAgainstPolar(key, keyHash);

  if (outcome.kind === 'granted') {
    await writeCache(buildCache('pro', key, 'granted'));
    logger.info('License tier: pro');
    return 'pro';
  }

  if (outcome.kind === 'limit') {
    await writeCache(buildCache('free', key, 'activation_limit'));
    logger.info('License tier: free (activation limit reached — key is on too many machines)');
    return 'free';
  }

  if (outcome.kind === 'invalid') {
    await writeCache(buildCache('free', key, 'invalid'));
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

// Releases this machine's activation slot (so the user can re-use it elsewhere),
// then clears the local activation + cache. Returns a human-readable result. Used
// by the `veilguard-cli deactivate` command. Never throws.
export async function deactivateMachine(): Promise<string> {
  const key = normalizedKey();
  if (!key) return 'No VEILGUARD_KEY set — nothing to deactivate.';
  if (!POLAR_ORG_ID) return 'No organization configured — cannot deactivate.';

  const stored = await readActivation();
  if (!stored || stored.key_hash !== hashKey(key)) {
    return 'This machine has no active license activation to release.';
  }

  const ok = await deactivateWithPolar(key, stored.activation_id);
  await clearActivation();
  // Drop the cached tier so the next run re-resolves from scratch.
  await rm(LICENSE_CACHE_PATH, { force: true }).catch(() => {});
  sessionTier = undefined;

  return ok
    ? 'Deactivated this machine. Its activation slot is now free for another machine.'
    : 'Cleared this machine locally, but Polar could not be reached to free the slot — it will expire on its own.';
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

// Appended to EVERY free-tier individual scanner result — including clean scans
// with zero findings. Without this, a free user whose project is clean never
// sees the Pro offer at all, and an AI agent can quietly reconstruct an "audit"
// from the individual scanners. Pro users never see it.
export function getScannerFooter(): string {
  return [
    '',
    '🔒 This is 1 of 13 security checks. Get your whole-project security grade',
    '   (A+ to F) and a one-paste fix prompt for Claude that patches every issue',
    '   at once — run full_audit on Pro → veilguard.dev/pro ($19/mo or $149/yr).',
  ].join('\n');
}

// Stronger nudge once a free session has run several scanners individually — the
// exact moment an agent is doing (the hard way) what full_audit does in one shot.
// Shown once per server lifetime.
export function getBypassNudge(): string {
  return [
    '',
    '~~ veilguard ~~ Running scanners one at a time?',
    '',
    'full_audit runs all 13 checks at once, grades your project (A+ to F), and',
    'writes a single AI-ready fix prompt that patches everything together.',
    'Unlimited on Pro → veilguard.dev/pro ($19/mo or $149/yr — save 35%)',
    '',
    'Add your key to the MCP config: VEILGUARD_KEY=your_key_here',
  ].join('\n');
}

// Builds a stateful appender that wraps an individual scanner's formatted output
// with the Pro upsell. Pro tier passes the text through untouched. Free tier gets
// the footer on every result, plus a one-time bypass nudge once it has wrapped
// UPSELL_NUDGE_THRESHOLD results. The MCP server creates one of these per session.
export function makeUpsellAppender(tier: Tier): (text: string) => string {
  let count = 0;
  let nudgeShown = false;
  return (text: string): string => {
    if (tier === 'pro') return text;
    count += 1;
    let out = `${text}\n${getScannerFooter()}`;
    if (!nudgeShown && count >= UPSELL_NUDGE_THRESHOLD) {
      nudgeShown = true;
      out += `\n${getBypassNudge()}`;
    }
    return out;
  };
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
