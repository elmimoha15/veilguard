import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

/**
 * Get the path to the patterns/ directory.
 * Works whether running from src/ (dev) or dist/ (built with tsup).
 */
export function getPatternsDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  // Try multiple candidate paths since tsup bundling and vitest can change directory depth
  const candidates = [
    join(process.cwd(), 'patterns'),                  // Running from project root (vitest, dev)
    join(__dirname, '..', 'patterns'),                 // dist/xxx.js → patterns/
    join(__dirname, '..', '..', 'patterns'),           // dist/scanners/xxx.js or src/utils/xxx.js → patterns/
    join(__dirname, '..', '..', '..', 'patterns'),     // deeper nesting
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  // Last resort
  return join(__dirname, '..', 'patterns');
}

/**
 * Get the path to the templates/ directory.
 */
export function getTemplatesDir(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const candidates = [
    join(process.cwd(), 'templates'),
    join(__dirname, '..', 'templates'),
    join(__dirname, '..', '..', 'templates'),
    join(__dirname, '..', '..', '..', 'templates'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return join(__dirname, '..', 'templates');
}

