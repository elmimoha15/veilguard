import { join } from 'path';
import { homedir } from 'os';

export const SKIP_DIRS = [
  'node_modules',
  '.next',
  'dist',
  'build',
  '.git',
  '.veilguard',
  'coverage',
  '.turbo',
  '.vercel',
  '.output',
  '__pycache__',
  'venv',
  '.venv',
];

export const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.toml',
  '.sql', '.graphql', '.gql',
  '.env', '.env.local', '.env.production', '.env.development',
  '.py', '.rb', '.go', '.java', '.cs',
  '.html', '.vue', '.svelte',
];

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const OSV_API_URL = 'https://api.osv.dev/v1/query';
export const DEP_CACHE_DURATION_MS = 60 * 60 * 1000;
export const HTTP_TIMEOUT_MS = 5000;

// ── Polar license validation ──────────────────────────────────────────────────
// Pro license keys are issued and validated by Polar.sh. We call their
// customer-portal validate endpoint with the user's key + our org id.
export const POLAR_API_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/validate';
export const POLAR_SANDBOX_API_URL =
  'https://sandbox-api.polar.sh/v1/customer-portal/license-keys/validate';
// Activation endpoints bind one license key to a limited number of machines, so
// a shared key only works on the first N machines (the "Limit activations" cap
// set on the Polar License Key benefit).
export const POLAR_ACTIVATE_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/activate';
export const POLAR_SANDBOX_ACTIVATE_URL =
  'https://sandbox-api.polar.sh/v1/customer-portal/license-keys/activate';
export const POLAR_DEACTIVATE_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/deactivate';
export const POLAR_SANDBOX_DEACTIVATE_URL =
  'https://sandbox-api.polar.sh/v1/customer-portal/license-keys/deactivate';
// Baked-in org id so end users never have to provide it — they only set
// VEILGUARD_KEY. Env var stays as an override for testing.
// TODO: before publishing to npm, swap this default to the PRODUCTION org id
// (the value below is the sandbox org id, used while testing).
export const POLAR_ORG_ID = process.env.POLAR_ORG_ID || '584fa9eb-8905-43fa-8dfb-332ecc6037f7';
export const USE_POLAR_SANDBOX = process.env.VEILGUARD_SANDBOX === 'true';

// ── License cache ─────────────────────────────────────────────────────────────
// Validated tiers are cached in ~/.veilguard so we don't hit Polar on every
// startup. A stale cache is also our offline fallback when Polar is unreachable.
export const LICENSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const VEILGUARD_DIR = '.veilguard';
export const LICENSE_CACHE_FILE = 'license-cache.json';
export const AUDIT_USAGE_FILE = 'audit-usage.json';
// Per-machine activation: a stable machine id and the activation id Polar issues
// for this machine, so we reuse the same slot across runs instead of consuming a
// new one each time.
export const ACTIVATION_FILE = 'activation.json';
export const MACHINE_ID_FILE = 'machine-id';

export const VEILGUARD_HOME = join(homedir(), VEILGUARD_DIR);
export const LICENSE_CACHE_PATH = join(VEILGUARD_HOME, LICENSE_CACHE_FILE);
export const AUDIT_USAGE_PATH = join(VEILGUARD_HOME, AUDIT_USAGE_FILE);
export const ACTIVATION_PATH = join(VEILGUARD_HOME, ACTIVATION_FILE);
export const MACHINE_ID_PATH = join(VEILGUARD_HOME, MACHINE_ID_FILE);

// ── Tier limits ───────────────────────────────────────────────────────────────
export const PRO_MONTHLY_AUDIT_LIMIT = 3;
export const FREE_TIER_MAX_FINDINGS = 3;
