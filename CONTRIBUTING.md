# Contributing

## Setup

```bash
npm install
npm run build
npm test
```

Node.js 18+ required.

## Project layout

```
src/
  index.ts          # MCP server entry (stdio transport)
  cli.ts            # CLI: quick-scan, start
  server.ts         # Tool registrations
  types.ts          # Shared types
  scanners/         # One file per scanner
  license/          # License validation + usage tracking
  utils/            # Shared helpers

patterns/           # JSON detection rule databases
templates/          # IDE rules file templates
```

## Running locally

```bash
# Start the MCP server
node dist/index.js

# Quick scan
node dist/cli.js quick-scan --dir /path/to/project
```

The MCP server speaks stdio — you won't see output unless an IDE is connected to it.

## Adding a scanner

1. Create `src/scanners/your-scanner.ts` — export `yourScanner(dir, tier)` returning a `ScanResult`
2. Add a `format*` function for output
3. Register the tool in `server.ts`
4. Add patterns to `patterns/` if needed

## Patterns

Detection rules live in `patterns/*.json`. Each file is a plain JSON array of pattern objects with `id`, `name`, `pattern` (regex string), `severity`, and `fix`.

## Publishing

```bash
npm version patch
npm publish
```
