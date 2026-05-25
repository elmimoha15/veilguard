import { readdir, readFile } from 'fs/promises';
import { join, relative, extname } from 'path';
import { SKIP_DIRS, CODE_EXTENSIONS } from './constants.js';
import { logger } from './logger.js';

async function loadGitignore(rootDir: string): Promise<Set<string>> {
  const ignored = new Set<string>();
  try {
    const content = await readFile(join(rootDir, '.gitignore'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        ignored.add(trimmed.replace(/\/$/, ''));
      }
    }
  } catch {
    // No .gitignore — that's fine
  }
  return ignored;
}

function shouldSkipDir(dirName: string, gitignored: Set<string>): boolean {
  if (dirName.startsWith('.') && dirName !== '.env') return true;
  if (SKIP_DIRS.includes(dirName)) return true;
  if (gitignored.has(dirName)) return true;
  return false;
}

function shouldIncludeFile(
  fileName: string,
  relPath: string,
  gitignored: Set<string>,
  extensions?: string[],
): boolean {
  if (gitignored.has(fileName) || gitignored.has(relPath)) return false;
  const ext = extname(fileName).toLowerCase();
  const allowedExts = extensions ?? CODE_EXTENSIONS;
  // Include .env files always (important for env-checker)
  if (fileName.startsWith('.env')) return true;
  return allowedExts.includes(ext);
}

export async function scanDirectory(
  rootDir: string,
  extensions?: string[],
): Promise<string[]> {
  const files: string[] = [];
  const gitignored = await loadGitignore(rootDir);

  async function walk(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relative(rootDir, fullPath);

        if (entry.isDirectory()) {
          if (!shouldSkipDir(entry.name, gitignored)) {
            await walk(fullPath);
          }
        } else if (entry.isFile()) {
          if (shouldIncludeFile(entry.name, relPath, gitignored, extensions)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      logger.debug(`Cannot read directory: ${dir} — ${(error as Error).message}`);
    }
  }

  await walk(rootDir);
  logger.debug(`Found ${files.length} files in ${rootDir}`);
  return files;
}
