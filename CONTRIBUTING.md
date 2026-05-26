# Contributing to Veilguard

Thank you for your interest in contributing to Veilguard! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

### Installation

```bash
git clone https://github.com/elmimoha15/veilguard.git
cd veilguard
npm install
npm run build
npm test
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build the project |
| `npm run dev` | Build with watch mode |
| `npm run test` | Run tests |
| `npm run typecheck` | Type check without emitting |
| `npm run lint` | Lint source files |
| `npm run format` | Format with Prettier |

## Project Structure

```
veilguard/
├── src/
│   ├── index.ts          # MCP server entry (stdio transport)
│   ├── cli.ts            # CLI commands
│   ├── server.ts         # Tool registrations
│   ├── types.ts          # TypeScript types
│   ├── scanners/         # Security scanners (one file per scanner)
│   ├── license/          # License validation
│   └── utils/            # Shared utilities
├── patterns/             # JSON detection rule databases
├── templates/            # IDE rules file templates
└── dist/                 # Compiled output
```

## Running Locally

```bash
# Start the MCP server (stdio mode)
node dist/index.js

# Run a quick scan via CLI
node dist/cli.js quick-scan --dir /path/to/project
```

> **Note:** The MCP server communicates via stdio. You won't see output unless connected through an IDE.

## Adding a New Scanner

1. **Create the scanner file**
   ```
   src/scanners/your-scanner.ts
   ```

2. **Export the scanner function**
   ```typescript
   export async function yourScanner(directory: string, tier: Tier): Promise<ScanResult> {
     // Implementation
   }
   
   export function formatYourScannerResults(result: ScanResult, tier: Tier): string {
     // Format output
   }
   ```

3. **Register in `server.ts`**
   ```typescript
   server.tool('your_scanner', 'Description', { ... }, async ({ directory }) => {
     const result = await yourScanner(directory, TIER);
     return { content: [{ type: 'text', text: formatYourScannerResults(result, TIER) }] };
   });
   ```

4. **Add to `full-audit.ts`** (if applicable)

5. **Add patterns** to `patterns/*.json` if needed

## Pattern Files

Detection rules are stored in `patterns/*.json`. Each pattern object includes:

```json
{
  "id": "unique-id",
  "name": "Human-readable name",
  "pattern": "regex-pattern",
  "severity": "critical|warning|info",
  "fix": "How to fix this issue",
  "breach_precedent": "Optional: real-world breach example"
}
```

## Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- No AI-style verbose comments
- Keep functions focused and small

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run tests and linting (`npm test && npm run lint`)
5. Commit with clear messages
6. Push and open a Pull Request

## Questions?

Open an issue or reach out at [veilguard.dev](https://veilguard.dev).
