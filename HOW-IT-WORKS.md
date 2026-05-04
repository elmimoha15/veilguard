# Veilguard — How It Works, How to Run, How to Use

## What Is Veilguard?

Veilguard is an MCP (Model Context Protocol) security scanner that runs inside AI coding IDEs. It provides 13 security tools that your AI agent calls automatically while you code. It catches leaked API keys, SQL injection, broken database policies, unverified webhooks, malicious packages, and more.

It runs 100% locally on your machine. Nothing leaves your laptop. The only outbound calls are to Google's OSV.dev (free, for dependency CVEs) and veilguard.dev (for license validation if you're on Pro).

---

## How to Build & Run (Developer Setup)

### Prerequisites

- Node.js >= 18
- npm

### Build from source

```bash
# Extract the archive
tar -xzf veilguard.tar.gz
cd veilguard

# Install dependencies
npm install

# Build
npm run build

# Verify build succeeded
ls dist/
# Should see: index.js, cli.js, and their .d.ts files
```

### Test locally

```bash
# Run the test suite
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

### Run the MCP server manually (for testing)

```bash
# Start the MCP server on stdio
node dist/index.js
```

The server communicates via stdin/stdout (MCP stdio transport). You won't see output — it's waiting for MCP protocol messages from an IDE.

### Run the CLI

```bash
# Initialize Veilguard in a project
node dist/cli.js init

# Quick scan a file (for Claude Code hooks)
node dist/cli.js quick-scan --file /path/to/file.ts

# Quick scan a directory
node dist/cli.js quick-scan --dir /path/to/project
```

---

## How to Install as an End User

### One-command setup

```bash
npx @veilguard/cli init
```

This auto-detects your IDE and sets up:
1. MCP server config (so the IDE knows about Veilguard)
2. Security rules file (.cursorrules, .windsurfrules, or CLAUDE.md)
3. Claude Code hooks (if Claude Code is detected)
4. Adds `.veilguard/` to your .gitignore

### Manual setup per IDE

All IDEs use the same MCP config JSON. Only the file location differs.

**The config:**

```json
{
  "mcpServers": {
    "veilguard": {
      "command": "npx",
      "args": ["-y", "@veilguard/cli"],
      "env": {
        "VEILGUARD_KEY": ""
      }
    }
  }
}
```

**Where to put it:**

| IDE | File | Notes |
|-----|------|-------|
| **Claude Code** | `.claude/mcp.json` | Or run: `claude mcp add veilguard -- npx -y @veilguard/cli` |
| **Cursor** | `.cursor/mcp.json` | Project-level config |
| **Windsurf** | `~/.windsurf/mcp.json` | Global config |
| **VS Code** | `.vscode/mcp.json` | Project-level config |
| **JetBrains** | Settings → Tools → MCP Server → Add | Name: veilguard, Command: npx, Args: -y @veilguard/cli |
| **Antigravity** | MCP Settings Panel → Add Server | Name: veilguard, Command: npx -y @veilguard/cli |

**Free users:** Leave `VEILGUARD_KEY` empty or remove the env line.
**Pro users:** Paste your license key from the Polar confirmation email.

Then restart your IDE. Veilguard is now active.

---

## How It Works (Architecture)

```
┌─────────────┐     stdio      ┌─────────────────────┐
│  Your IDE    │ ◄────────────► │  Veilguard MCP      │
│  (Cursor,    │   MCP protocol │  Server              │
│  Claude Code │                │                     │
│  etc.)       │                │  13 security tools   │
└─────────────┘                └──────────┬──────────┘
                                          │
                         ┌────────────────┼────────────────┐
                         │                │                │
                    Local scans      OSV.dev API     License API
                    (your files)     (free, for       (veilguard.dev
                                     dependency       optional,
                                     CVEs)            Pro only)
```

1. Your IDE starts Veilguard as a local process via `npx @veilguard/cli`
2. The IDE communicates with Veilguard using the MCP protocol over stdio
3. Your AI agent (Claude, GPT, etc.) calls Veilguard's tools when it detects relevant moments
4. Veilguard scans your local files, matches patterns, and returns findings
5. The AI presents findings to you and offers to fix them

**Everything runs locally.** Veilguard reads your files on your machine. It never uploads code, never sends file contents anywhere, never modifies your files or database.

---

## The 13 Tools

### Free Tools (all users, depth-limited)

| Tool | What it does | When auto-triggered |
|------|-------------|-------------------|
| `scan_secrets` | Scans for 42+ hardcoded API key patterns (Stripe, Supabase, OpenAI, Paystack, Flutterwave, M-Pesa, AWS, etc.) | After file create/modify |
| `scan_dependencies` | Checks npm packages for known CVEs via Google OSV.dev | After package.json changes |
| `scan_webhooks` | Finds webhook endpoints missing signature verification (Stripe, Paystack, M-Pesa, GitHub, Flutterwave) | After API route changes |
| `scan_injection` | Detects SQL injection via template literals, unsanitized req.body, command injection | After API route changes |
| `check_env` | Verifies .env is gitignored, detects NEXT_PUBLIC_ secret exposure, checks git tracking | After env/config changes |
| `check_auth_config` | Validates Clerk/NextAuth/Supabase Auth — getSession vs getUser, localStorage sessions, rate limiting | After auth config changes |
| `check_headers` | Checks security headers (CSP, HSTS, X-Frame-Options, etc.) on a deployed URL | Before deploy |
| `check_git` | Checks .gitignore gaps, tracked .env files, node_modules committed | After git changes |
| `check_cors` | Detects cors({ origin: '*' }), missing origin filtering | After config changes |
| `check_supply_chain` | Finds malicious and typosquatted npm packages | After package.json changes |

### Pro Tools ($19/month)

| Tool | What it does | When auto-triggered |
|------|-------------|-------------------|
| `check_supabase_rls` | Deep audit of Supabase RLS policies — catches USING(true), auth.uid() IS NOT NULL bypass, missing policies, select(*) without filters | After DB schema changes |
| `check_firebase` | Analyzes Firebase security rules for open access, client-controlled auth, missing restrictions | After rules file changes |
| `full_audit` | Runs all 13 scanners, calculates score (0-100), assigns grade (A+ to F), generates AI-ready fix prompt. 3/month. | Before deploy |

### Free vs Pro depth limits

Free users can run every tool, but see limited output:

| What | Free | Pro |
|------|------|-----|
| Findings per scan | First 3 shown | All shown |
| Fix suggestions | Hidden on critical findings | All shown |
| Dependencies | Critical CVEs only | All severities |
| Git history | Current files only | Full history scan |
| Supply chain | Top 20 deps | All deps |
| Breach context | Hidden | Shown (which real breach each pattern caused) |

---

## Auto-Scanning

Veilguard installs a security rules file in your project that tells your AI agent when to auto-call scans:

| Moment | What runs |
|--------|----------|
| After creating/modifying any file | `scan_secrets` |
| After creating API routes | `scan_webhooks` + `scan_injection` |
| After changing database schemas | `check_supabase_rls` (Pro) |
| After modifying package.json | `check_supply_chain` + `scan_dependencies` |
| After changing env/config files | `check_env` |
| Before deploying | `full_audit` (Pro) or all free scanners |
| First time on a project | `scan_secrets` + `check_env` |

**Clean scan = total silence.** You never know it ran.
**Issue found = calm nudge.** One line, with a fix suggestion.
**Never nags.** If you already know about an issue, Veilguard doesn't repeat it.

### Claude Code special: hooks

Claude Code gets an extra layer — post-save hooks that fire on every file save, regardless of what the AI decides. This is true auto-scanning. The hooks config is at `.claude/hooks.json`.

---

## Scoring System (full_audit)

The full audit runs all 13 scanners and calculates a security score:

- Start at **100 points**
- Each **critical** finding: **-15 points**
- Each **warning**: **-5 points**
- Each **info**: **-1 point**
- Minimum: **0**

| Grade | Score | Meaning |
|-------|-------|---------|
| A+ | 95-100 | Excellent — ship with confidence |
| A | 90-94 | Great — minor improvements possible |
| B+ | 85-89 | Good — a few things to tighten |
| B | 80-84 | Decent — some warnings to address |
| C+ | 75-79 | Fair — multiple issues found |
| C | 70-74 | Needs work |
| D | 60-69 | Poor — critical issues present |
| F | 0-59 | Failing — do not deploy |

The audit also generates an **AI-ready fix prompt** — a single block of text you can paste into your AI agent to fix all issues at once.

---

## License & Pricing

| | Free | Pro |
|---|---|---|
| Price | $0 | $19/month or $149/year (save 35%) |
| All 13 tools | ✅ (depth-limited) | ✅ (full) |
| Supabase RLS audit | ❌ | ✅ |
| Firebase audit | ❌ | ✅ |
| Full audit with grade | ❌ | ✅ (3/month) |

**How licensing works:**
1. Buy Pro at veilguard.dev/pro (Polar checkout)
2. Get a license key via email
3. Add `VEILGUARD_KEY=your_key` to your MCP config
4. Restart IDE — Pro features active immediately
5. Key is validated once on startup, cached for 24 hours
6. Works offline after first validation

---

## Project Structure

```
veilguard/
├── package.json              # npm config, scripts, dependencies
├── tsconfig.json             # TypeScript strict mode, ESM
├── tsup.config.ts            # Build configuration
├── .eslintrc.json            # Lint rules
├── .prettierrc               # Formatting
├── vitest.config.ts          # Test runner config
├── LICENSE                   # MIT
├── README.md                 # npm package docs
│
├── src/
│   ├── index.ts              # MCP server entry (stdio transport)
│   ├── cli.ts                # CLI: init, quick-scan, start
│   ├── server.ts             # MCP tool registrations (13 tools)
│   ├── types.ts              # All TypeScript type definitions
│   │
│   ├── scanners/             # One file per scanner
│   │   ├── secret-scanner.ts
│   │   ├── dependency-checker.ts
│   │   ├── webhook-scanner.ts
│   │   ├── injection-scanner.ts
│   │   ├── header-checker.ts
│   │   ├── auth-config-checker.ts
│   │   ├── env-checker.ts
│   │   ├── git-checker.ts
│   │   ├── cors-scanner.ts
│   │   ├── supply-chain-checker.ts
│   │   ├── rls-analyzer.ts       # [PRO]
│   │   ├── firebase-analyzer.ts  # [PRO]
│   │   ├── full-audit.ts         # [PRO] orchestrator
│   │   └── scoring.ts            # grade calculation
│   │
│   ├── license/
│   │   └── license.ts        # Polar validation, caching, audit limits
│   │
│   └── utils/
│       ├── constants.ts      # Config values, limits, URLs
│       ├── file-reader.ts    # Safe file reading
│       ├── glob-scanner.ts   # Directory walker
│       ├── http.ts           # Fetch with timeout/retry
│       ├── logger.ts         # Structured logging
│       └── paths.ts          # Pattern/template path resolution
│
├── patterns/                 # Detection pattern databases
│   ├── secrets.json          # 42 secret patterns
│   ├── webhook-rules.json    # 5 webhook providers
│   ├── injection-rules.json  # 8 injection patterns
│   ├── rls-rules.json        # 5 RLS bad patterns
│   ├── firebase-rules.json   # 3 Firebase bad patterns
│   └── malicious-packages.json # known malicious + typosquats
│
├── templates/                # IDE setup templates
│   ├── cursorrules.txt       # Cursor rules + auto-scan triggers
│   ├── windsurfrules.txt     # Windsurf rules
│   ├── claude-md.txt         # Claude Code CLAUDE.md
│   ├── claude-hooks.json     # Claude Code post-save hooks
│   └── mcp-config.json       # Universal MCP config
│
└── tests/
    ├── fixtures/
    │   ├── vulnerable-app/   # Intentionally vulnerable (for testing)
    │   └── secure-app/       # Properly secured (for testing)
    └── scanners/             # Test files
        ├── secret-scanner.test.ts
        ├── rls-analyzer.test.ts
        ├── webhook-scanner.test.ts
        ├── injection-scanner.test.ts
        ├── supply-chain-checker.test.ts
        └── full-audit.test.ts
```

---

## Publishing to npm

```bash
# Build
npm run build

# Test
npm test

# Publish (you need an npm account)
npm publish --access public
```

After publishing, anyone can use Veilguard with:
```bash
npx @veilguard/cli init
```

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `VEILGUARD_KEY` | Pro license key | No (free tier works without it) |
| `VEILGUARD_LOG_LEVEL` | Log verbosity: debug, info, warn, error | No (default: info) |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `npm run build` fails | Check Node.js >= 18. Run `npm install` first. |
| Veilguard not scanning automatically | Check rules file exists (.cursorrules, CLAUDE.md). Check MCP config. Restart IDE. |
| Pro key not working | Restart IDE. Check key format. Internet needed for first validation. |
| Scanner finds false positives | Create `.veilguardignore` in project root (same format as .gitignore). |
| full_audit says 3/3 used | Resets on 1st of each month. Individual scanners still work. |
| Pattern files not loading | Check that `patterns/` directory is next to `dist/`. If using npm, check `"files"` in package.json includes `"patterns"`. |
