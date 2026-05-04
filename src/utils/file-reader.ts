import { readFile, stat } from 'fs/promises';
import { MAX_FILE_SIZE } from './constants.js';
import { logger } from './logger.js';

/**
 * Safely reads a file's content. Returns null on any error.
 * Skips binary files and files exceeding MAX_FILE_SIZE.
 */
export async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    const fileStat = await stat(filePath);
    if (fileStat.size > MAX_FILE_SIZE) {
      logger.debug(`Skipping large file: ${filePath} (${fileStat.size} bytes)`);
      return null;
    }
    if (fileStat.size === 0) {
      return '';
    }

    const buffer = await readFile(filePath);

    // Detect binary files by checking for null bytes in first 8KB
    const sample = buffer.subarray(0, 8192);
    if (sample.includes(0)) {
      logger.debug(`Skipping binary file: ${filePath}`);
      return null;
    }

    return buffer.toString('utf-8');
  } catch (error) {
    logger.debug(`Cannot read file: ${filePath} — ${(error as Error).message}`);
    return null;
  }
}

/**
 * Reads a JSON file and parses it. Returns null on error.
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  const content = await readFileSafe(filePath);
  if (content === null) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    logger.debug(`Invalid JSON: ${filePath}`);
    return null;
  }
}
