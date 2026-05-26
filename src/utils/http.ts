import { HTTP_TIMEOUT_MS } from './constants.js';
import { logger } from './logger.js';

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

// returns null on failure, never throws
export async function fetchSafe<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T | null> {
  const { method = 'GET', headers = {}, body, timeoutMs = HTTP_TIMEOUT_MS } = options;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        logger.debug(`HTTP ${response.status} from ${url}`);
        if (attempt === 0) continue;
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      const msg = (error as Error).message;
      logger.debug(`Fetch failed (attempt ${attempt + 1}): ${url} — ${msg}`);
      if (attempt === 0) continue;
      return null;
    }
  }

  return null;
}
