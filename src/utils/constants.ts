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
export const VEILGUARD_HOME = join(homedir(), '.veilguard');
export const LICENSE_CACHE_PATH = join(VEILGUARD_HOME, 'license-cache.json');
export const AUDIT_USAGE_PATH = join(VEILGUARD_HOME, 'usage.json');
export const LICENSE_API_URL = 'https://veilguard.dev/api/validate-license';
export const OSV_API_URL = 'https://api.osv.dev/v1/query';
export const LICENSE_CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
export const DEP_CACHE_DURATION_MS = 60 * 60 * 1000;
export const FREE_TIER_MAX_FINDINGS = 3;
export const PRO_AUDIT_LIMIT = 3;
export const HTTP_TIMEOUT_MS = 5000;
