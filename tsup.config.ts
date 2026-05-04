import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  platform: 'node',
  splitting: true,
  sourcemap: true,
  shims: false,
  external: [
    '@modelcontextprotocol/sdk',
  ],
});
