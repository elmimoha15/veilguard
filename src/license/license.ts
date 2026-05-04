import { readFile, writeFile, mkdir } from 'fs/promises';
import {
  VEILGUARD_HOME,
  LICENSE_CACHE_PATH,
  AUDIT_USAGE_PATH,
  LICENSE_API_URL,
  LICENSE_CACHE_DURATION_MS,
  PRO_AUDIT_LIMIT,
} from '../utils/constants.js';
import { fetchSafe } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import type { LicenseResult, AuditUsage, Tier } from '../types.js';

/** Ensure the ~/.veilguard directory exists */
async function ensureDir(): Promise<void> {
  try {
    await mkdir(VEILGUARD_HOME, { recursive: true });
  } catch {
    // Already exists
  }
}

/** Read cached license result */
async function readCache(): Promise<LicenseResult | null> {
  try {
    const raw = await readFile(LICENSE_CACHE_PATH, 'utf-8');
    const cached = JSON.parse(raw) as LicenseResult & { timestamp: number };
    const age = Date.now() - cached.timestamp;
    if (age < LICENSE_CACHE_DURATION_MS) {
      return { ...cached, cached: true };
    }
    return null;
  } catch {
    return null;
  }
}

/** Write license result to cache */
async function writeCache(result: LicenseResult): Promise<void> {
  await ensureDir();
  const data = { ...result, timestamp: Date.now() };
  await writeFile(LICENSE_CACHE_PATH, JSON.stringify(data, null, 2));
}

/**
 * Validate the license key. Checks cache first, then calls the API.
 * Returns 'free' tier if anything goes wrong (never blocks the user).
 */
export async function validateLicense(): Promise<LicenseResult> {
  const key = process.env.VEILGUARD_KEY;

  if (!key || key.trim() === '' || key === 'your_key_here') {
    return { tier: 'free', valid: false, cached: false };
  }

  // Check cache first
  const cached = await readCache();
  if (cached) {
    logger.debug(`License: using cached result (tier: ${cached.tier})`);
    return cached;
  }

  // Call validation API
  try {
    const response = await fetchSafe<{ tier: Tier; valid: boolean }>(LICENSE_API_URL, {
      method: 'POST',
      body: JSON.stringify({ key }),
    });

    if (response && response.valid) {
      const result: LicenseResult = { tier: 'pro', valid: true, cached: false };
      await writeCache(result);
      logger.info('License: validated successfully (Pro)');
      return result;
    }

    const result: LicenseResult = { tier: 'free', valid: false, cached: false };
    await writeCache(result);
    return result;
  } catch {
    // API unreachable — try cache even if expired
    try {
      const raw = await readFile(LICENSE_CACHE_PATH, 'utf-8');
      const stale = JSON.parse(raw) as LicenseResult;
      logger.warn('License: API unreachable, using stale cache');
      return { ...stale, cached: true };
    } catch {
      return { tier: 'free', valid: false, cached: false };
    }
  }
}

/** Read current audit usage */
async function readAuditUsage(): Promise<AuditUsage> {
  try {
    const raw = await readFile(AUDIT_USAGE_PATH, 'utf-8');
    const usage = JSON.parse(raw) as AuditUsage;

    // Check if reset date has passed
    const resetDate = new Date(usage.reset_date);
    if (new Date() >= resetDate) {
      return { count: 0, reset_date: getNextResetDate() };
    }
    return usage;
  } catch {
    return { count: 0, reset_date: getNextResetDate() };
  }
}

/** Get the 1st of next month as reset date */
function getNextResetDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString();
}

/**
 * Check if a full audit can be run (under the 3/month limit).
 * Returns { allowed: true } or { allowed: false, message: string }.
 */
export async function checkAuditLimit(): Promise<{ allowed: boolean; message?: string }> {
  const usage = await readAuditUsage();

  if (usage.count >= PRO_AUDIT_LIMIT) {
    const resetDate = new Date(usage.reset_date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return {
      allowed: false,
      message: [
        '~~ veilguard ~~ audit limit reached',
        '',
        `You've used ${usage.count}/${PRO_AUDIT_LIMIT} full audits this month. Resets on ${resetDate}.`,
        '',
        'You can still run every individual scanner with full results anytime.',
        'Only the combined full_audit is limited to 3/month.',
      ].join('\n'),
    };
  }

  return { allowed: true };
}

/** Increment the audit counter after a successful full audit */
export async function incrementAuditUsage(): Promise<void> {
  await ensureDir();
  const usage = await readAuditUsage();
  usage.count += 1;
  await writeFile(AUDIT_USAGE_PATH, JSON.stringify(usage, null, 2));
}

/** Generate the upgrade message for free users */
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
    '  ✓ Full security audit with grade (3/month)',
    '  ✓ Breach precedent context',
    '',
    'Add your key to the MCP config:',
    '  VEILGUARD_KEY=your_key_here',
  ].join('\n');
}

/** Generate the Pro-only tool message */
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
