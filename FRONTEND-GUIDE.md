# Veilguard — Frontend Content Reference

Everything you need to build the website / dashboard around the `veilguard`
package: how it works, pricing, per-IDE install guides, the `init` command, and
the copy users see. Treat this as the single source of truth for frontend copy.

> For the deeper machine-readable contract (tool list, license API shape,
> constants), see **[MCP-INTEGRATION.md](MCP-INTEGRATION.md)**.

- **Package:** `veilguard` — <https://www.npmjs.com/package/veilguard>
- **Website:** veilguard.dev · **Docs:** veilguard.dev/docs · **Pro:** veilguard.dev/pro
- **Tagline:** *Silent security for AI-assisted development.*
- **License:** MIT © Mohamed Elmi

---

## Table of contents

1. [The 30-second pitch](#1-the-30-second-pitch)
2. [How it works](#2-how-it-works)
3. [Does it "just work"? The honest answer](#3-does-it-just-work-the-honest-answer)
4. [Installation — the `init` command (recommended)](#4-installation--the-init-command-recommended)
5. [Installation — manual, per IDE](#5-installation--manual-per-ide)
6. [The license key (Free vs Pro)](#6-the-license-key-free-vs-pro)
7. [Pricing](#7-pricing)
8. [What gets scanned (the 15 tools)](#8-what-gets-scanned-the-15-tools)
9. [Free vs Pro feature matrix](#9-free-vs-pro-feature-matrix)
10. [FAQ / troubleshooting](#10-faq--troubleshooting)
11. [Copy bank (exact strings)](#11-copy-bank-exact-strings)
12. [⚠️ Things to align before launch](#12-️-things-to-align-before-launch)

---

## 1. The 30-second pitch

Veilguard is an **MCP security scanner that runs inside your AI coding IDE**. It
catches the vulnerabilities AI-generated code introduces — leaked secrets, SQL
injection, broken database security (Supabase RLS / Firebase rules), unverified
webhooks, vulnerable dependencies, and more.

> **You never run a scan. You never read a report. You just code.**
> Your AI assistant calls Veilguard automatically. Clean code = silence.
> A problem = a plain-English explanation and a fix.

Works in **5 IDEs**: Cursor, VS Code, Windsurf, Claude Code, Antigravity.

---

## 2. How it works

1. You add Veilguard to your IDE once (via `init` or manual config).
2. Your IDE runs the Veilguard **MCP server** in the background (over stdio).
3. As you code, your AI agent **calls Veilguard's tools automatically**:

   | When you… | Veilguard runs |
   |-----------|----------------|
   | Write or modify files | `scan_secrets` |
   | Create API routes | `scan_webhooks` + `scan_injection` |
   | Change database schemas | `check_supabase_rls` |
   | Edit `package.json` | `check_supply_chain` + `scan_dependencies` |
   | Edit AI rules files | `scan_rules_files` |
   | Before deploying | `full_audit` |

4. **Clean scan → silence.** **Issue found → plain-English explanation + a fix.**

It's "MCP" (Model Context Protocol) — the open standard IDEs use to give AI
assistants extra tools. Veilguard is one of those tools.

---

## 3. Does it "just work"? The honest answer

**Yes** — run `init`, pick your IDE, restart, done. Specifically:

- The IDE is told to launch the server with `npx -y --package=veilguard veilguard-mcp`.
- On first use, `npx` downloads the package (a few seconds), then the tools are live.
- No global install, no build step, no account required for the free tier.

**One prerequisite:** **Node.js 18+** must be installed (the IDE uses `npx` to
run the server). Worth stating on the install page.

---

## 4. Installation — the `init` command (recommended)

### The command

```bash
npx -y --package=veilguard veilguard-cli init
```

Run it from the project root. (There's no bin literally named `veilguard`, so
the `--package=veilguard veilguard-cli` form is required — see §12.)

### What the user sees

```
🛡️  Veilguard — Silent security for vibe coders

Which IDE do you use? (enter number, or multiple separated by commas)

  1. Cursor
  2. VS Code
  3. Windsurf
  4. Claude Code
  5. Antigravity
  6. All of the above

>
```

The user types a number, several (e.g. `1,3,4`), or `6` for all, and presses Enter.

### What `init` does

For each selected IDE it writes **two kinds of files**:

| Kind | Location | In the repo? |
|------|----------|--------------|
| **MCP server config** | the IDE's **global** location (your home folder) | ❌ never |
| **AI rules file** (optional) | the project, then auto-added to `.gitignore` | ❌ not committed |

This is the **zero-footprint** design: the MCP config is global so it works
across all your projects, and nothing tracked is ever added to your repo.

Exact paths per IDE:

| IDE | Global MCP config written | Project rules file (gitignored) |
|-----|---------------------------|---------------------------------|
| Cursor | `~/.cursor/mcp.json` | `.cursorrules` |
| VS Code | user `mcp.json` (platform path, see §5) | — |
| Windsurf | `~/.windsurf/mcp.json` | `.windsurfrules` |
| Claude Code | `~/.claude.json` (via `claude mcp add … -s user`) | `CLAUDE.md`, `.claude/hooks.json` |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` | — |

- Existing config files are **merged** — other MCP servers you already have are preserved.
- A `.gitignore` is created if the project doesn't have one; entries are de-duplicated.
- For Claude Code, `init` also tries the `claude` CLI; if it isn't installed, that step is skipped silently (the `CLAUDE.md` and hooks are still written).

### After it runs

```
  ✓ Cursor: ~/.cursor/mcp.json (global) + .cursorrules created
  ✓ .gitignore: 2 entries added — these stay out of your repo

  Veilguard is ready. Restart your IDE to activate.
  Free: all 13 scanners active (depth-limited).
  Pro: add VEILGUARD_KEY → veilguard.dev/pro
```

Then the user **restarts their IDE** and Veilguard is active.

---

## 5. Installation — manual, per IDE

For users who'd rather not run `init`. All of these can also be done at the
project level (e.g. `.cursor/mcp.json`) instead of globally if they prefer.

### The standard config block

Most IDEs use this exact shape:

```json
{
  "mcpServers": {
    "veilguard": {
      "command": "npx",
      "args": ["-y", "--package=veilguard", "veilguard-mcp"],
      "env": {
        "VEILGUARD_KEY": ""
      }
    }
  }
}
```

`VEILGUARD_KEY` empty = Free. Add a Pro key to unlock graded audits.

### Cursor

- Global: `~/.cursor/mcp.json` · Project: `.cursor/mcp.json`
- Use the standard block above (`mcpServers`).

### VS Code

VS Code is the exception — it uses top-level **`servers`** and an explicit
**`"type": "stdio"`**:

```json
{
  "servers": {
    "veilguard": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "--package=veilguard", "veilguard-mcp"],
      "env": { "VEILGUARD_KEY": "" }
    }
  }
}
```

- Global (user) `mcp.json` — open via Command Palette → **"MCP: Open User Configuration"**. Paths:
  - macOS: `~/Library/Application Support/Code/User/mcp.json`
  - Linux: `~/.config/Code/User/mcp.json`
  - Windows: `%APPDATA%\Code\User\mcp.json`
- Project: `.vscode/mcp.json`

### Windsurf

- Global: `~/.windsurf/mcp.json` · Use the standard block (`mcpServers`).

### Claude Code

Run:

```bash
claude mcp add veilguard -s user -- npx -y --package=veilguard veilguard-mcp
```

(`-s user` = global, all projects. Drop it for project-only.)

### Antigravity

- Global: `~/.gemini/antigravity/mcp_config.json` · Use the standard block (`mcpServers`).

> After any manual setup, **restart the IDE**.

---

## 6. The license key (Free vs Pro)

- The key is the `VEILGUARD_KEY` value in the MCP config (or env var).
- **Free:** leave it empty (`""`). All scanners work in the IDE; only the graded
  `full_audit` is locked.
- **Pro:** paste the key from veilguard.dev/pro into `VEILGUARD_KEY`, restart.

**How validation works (backend you must provide):**
- The package calls `POST https://veilguard.dev/api/validate-license` with body
  `{ "key": "<the key>" }`.
- It expects `{ "tier": "free" | "pro", "valid": boolean }` back.
- The result is cached locally for 24h. If your API is unreachable, it falls
  back to the cached result, then to Free. (Validation never crashes the IDE.)

See [MCP-INTEGRATION.md §8](MCP-INTEGRATION.md#8-license--usage-api-frontend-contract)
for the full contract.

---

## 7. Pricing

- **Free** — $0. All scanners run in your IDE. The `full_audit` grade is locked.
- **Pro** — **$19/month** (or **$149/year**, ~35% off). Unlocks the graded
  full audit (A+–F), AI-ready fix prompts, all CVE severities, git-history
  deep scanning, and breach-precedent context.

> ⚠️ The codebase currently has conflicting pricing/limit strings (a `$15/mo`
> and a "3 audits/month" limit in some messages). Pick the canonical values and
> see §12 before publishing.

---

## 8. What gets scanned (the 15 tools)

14 scanners + a combined `full_audit` = 15 MCP tools.

| Tool | Detects |
|------|---------|
| `scan_secrets` | 60+ secret patterns, client-side AI API calls, `service_role` key in frontend, fallback-trap keys |
| `check_env` | `.env` not gitignored / committed, `NEXT_PUBLIC_` secret exposure |
| `scan_webhooks` | Unverified webhook signatures, missing payment-failure handlers |
| `scan_injection` | SQL / NoSQL / command injection, unsanitized `req.body` |
| `check_cors` | Wildcard origins, `cors()` with no options |
| `check_supply_chain` | Malicious & typosquatted npm packages, suspicious install scripts |
| `check_auth_config` | `getSession` vs `getUser`, localStorage sessions, weak/reusable reset tokens, missing rate limiting |
| `check_headers` | Missing security headers (CSP, HSTS, X-Frame-Options…) on a live URL |
| `check_git` | `.env` tracked, `.gitignore` gaps, secrets in history (Pro) |
| `scan_dependencies` | Known CVEs via Google OSV.dev |
| `check_supabase_rls` | `USING(true)`, `auth.role()` misuse, `auth.uid() IS NOT NULL` bypass, missing RLS, unfiltered `select('*')` |
| `check_firebase` | Open rules (`if true`), client-controlled auth, auth-only reads |
| `scan_app_security` | Rate limiting, IDOR, file uploads, error/stack exposure, sensitive logging, open redirects, mass assignment |
| `scan_rules_files` | Hidden-Unicode / base64 / malicious-instruction backdoors in AI rules files |
| `full_audit` | Runs all scanners → scored report A+–F + AI fix prompt (**grade is Pro-only**) |

> Marketing count: **14 scanners** (+ full audit). Note the `init` closing line
> currently says "13 scanners" (that's the number `full_audit` runs, since
> `check_headers` needs a live URL). Keep the public number consistent — see §12.

---

## 9. Free vs Pro feature matrix

| Feature | Free | Pro |
|---------|:----:|:---:|
| All 14 scanners in your IDE | ✅ | ✅ |
| Plain-English findings + fixes | ✅ | ✅ |
| Full audit **with grade** (A+–F) | 🔒 | ✅ |
| AI-ready fix prompt (paste-to-fix) | — | ✅ |
| All CVE severities (not just critical) | — | ✅ |
| Git-history deep scan | — | ✅ |
| Breach-precedent context | — | ✅ |

> Technical nuance for accuracy: inside the IDE (MCP mode) every individual
> scanner already returns full results regardless of key — only the `full_audit`
> *grade* is gated. The Free caps above apply on the CLI `quick-scan` path and
> the locked audit. Marketing can lead with the table; engineering should keep
> this in mind.

---

## 10. FAQ / troubleshooting

**Do I need an account to start?** No. Free works with an empty key.

**Do I need to install anything?** Just Node.js 18+. The IDE runs Veilguard via
`npx` on demand — no global install.

**Will it add files to my repo / commit secrets?** No. The MCP config lives in
your home folder (global). The optional rules files are written to the project
but auto-added to `.gitignore`. No secrets are stored — the key is a placeholder
you fill in yourself.

**It's not running after install.** Make sure you **restarted the IDE**, Node
18+ is installed, and (for Claude Code) the `claude` CLI is available if you
used `init`.

**Does it work in JetBrains / other IDEs?** No — only Cursor, VS Code, Windsurf,
Claude Code, and Antigravity.

**Is my code sent anywhere?** Scanning runs locally. The only network calls are:
license validation (`veilguard.dev`) and dependency CVE lookups (`api.osv.dev`).

---

## 11. Copy bank (exact strings)

Reusable copy that matches the package's voice:

- **Hero:** "Silent security for AI-assisted development."
- **Sub:** "You never run a scan. You never read a report. You just code."
- **Install one-liner:** `npx -y --package=veilguard veilguard-cli init`
- **Result line:** "Clean scan = silence. Issue found = plain-English explanation with a fix."
- **Free note:** "Free users: leave `VEILGUARD_KEY` empty — all scanners work out of the box."
- **Pro CTA:** "Add your license key from veilguard.dev/pro to unlock graded audits."
- **IDE list:** "Cursor · VS Code · Windsurf · Claude Code · Antigravity"

---

## 12. ⚠️ Things to align before launch

These are real inconsistencies in the current package. Decide the canonical
value and make the site + code agree:

1. **Pricing:** README says **$19/mo**; the locked-audit message in code says
   **$15/mo**. The upgrade message says **$19/mo or $149/yr**.
2. **Audit limit:** README says **unlimited** audits; code enforces **3/month**
   (`PRO_AUDIT_LIMIT = 3`) and several messages say "3/month".
3. **Scanner count:** site/README say **14 scanners / 15 tools**; the `init`
   closing line says **13 scanners**.
4. **`init` Free line** says scanners are "depth-limited," but in IDE/MCP mode
   they run at full depth (see §9 nuance).

Tell me which values are canonical and I'll fix the code + all copy to match in
one pass.
```
