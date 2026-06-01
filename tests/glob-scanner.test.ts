import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { scanDirectory } from '../src/utils/glob-scanner.js';

// Regression test for single-file scanning. The per-edit hook (and
// `quick-scan --file`) passes a file path where scanDirectory previously
// expected a directory — which threw ENOTDIR via readdir(). scanDirectory must
// now treat a file target as a one-element list, honoring the extension filter.
describe('scanDirectory with a single file target', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'veilguard-glob-'));
    await writeFile(join(dir, 'app.ts'), 'export const x = 1;\n');
    await writeFile(join(dir, 'notes.md'), '# notes\n');
    await writeFile(join(dir, '.env'), 'SECRET=abc\n');
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns the file itself when given an included file path', async () => {
    const files = await scanDirectory(join(dir, 'app.ts'));
    expect(files).toEqual([join(dir, 'app.ts')]);
  });

  it('returns empty when the file fails the extension filter', async () => {
    const files = await scanDirectory(join(dir, 'notes.md'));
    expect(files).toEqual([]);
  });

  it('honors an explicit extensions filter', async () => {
    expect(await scanDirectory(join(dir, 'app.ts'), ['.sql'])).toEqual([]);
    expect(await scanDirectory(join(dir, 'app.ts'), ['.ts'])).toEqual([join(dir, 'app.ts')]);
  });

  it('always includes .env files', async () => {
    const files = await scanDirectory(join(dir, '.env'));
    expect(files).toEqual([join(dir, '.env')]);
  });

  it('still walks directories', async () => {
    const files = await scanDirectory(dir);
    expect(files).toContain(join(dir, 'app.ts'));
    expect(files).toContain(join(dir, '.env'));
    expect(files).not.toContain(join(dir, 'notes.md'));
  });

  it('returns empty for a non-existent target instead of throwing', async () => {
    await expect(scanDirectory(join(dir, 'nope.ts'))).resolves.toEqual([]);
  });
});
