import { join } from 'path';
import { homedir } from 'os';

/** Directories to always skip when scanning */
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

/** File extensions to scan for code issues */
export const CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.toml',
  '.sql', '.graphql', '.gql',
  '.env', '.env.local', '.env.production', '.env.development',
  '.py', '.rb', '.go', '.java', '.cs',
  '.html', '.vue', '.svelte',
];

/** Max file size to scan (5MB) */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Veilguard config directory */
export const VEILGUARD_HOME = join(homedir(), '.veilguard');

/** License cache file */
export const LICENSE_CACHE_PATH = join(VEILGUARD_HOME, 'license-cache.json');

/** Audit usage tracking file */
export const AUDIT_USAGE_PATH = join(VEILGUARD_HOME, 'usage.json');

/** License validation endpoint */
export const LICENSE_API_URL = 'https://veilguard.dev/api/validate-license';

/** OSV.dev API endpoint */
export const OSV_API_URL = 'https://api.osv.dev/v1/query';

/** Cache duration for license validation (24 hours) */
export const LICENSE_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

/** Cache duration for dependency checks (1 hour) */
export const DEP_CACHE_DURATION_MS = 60 * 60 * 1000;

/** Max findings shown to free users */
export const FREE_TIER_MAX_FINDINGS = 3;

/** Max full audits per month for Pro users */
export const PRO_AUDIT_LIMIT = 3;

/** Header check timeout (5 seconds) */
export const HTTP_TIMEOUT_MS = 5000;
