import { readFile, writeFile, mkdir } from 'fs/promises';
import {
  VEILGUARD_HOME,
  LICENSE_CACHE_PATH,
  LICENSE_API_URL,
  LICENSE_CACHE_DURATION_MS,
} from '../utils/constants.js';
import { fetchSafe } from '../utils/http.js';
import { logger } from '../utils/logger.js';
import type { LicenseResult, Tier, Finding } from '../types.js';

async function ensureDir(): Promise<void> {
  try {
    await mkdir(VEILGUARD_HOME, { recursive: true });
  } catch {
    // Already exists
  }
}

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

async function writeCache(result: LicenseResult): Promise<void> {
  await ensureDir();
  const data = { ...result, timestamp: Date.now() };
  await writeFile(LICENSE_CACHE_PATH, JSON.stringify(data, null, 2));
}

// Never throws — falls back to free tier if validation fails
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