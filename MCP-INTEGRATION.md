# Veilguard MCP — Integration Reference

Single source of truth for anything that consumes Veilguard from the outside
(the website, docs, dashboard, install flows). Use this to verify the frontend
matches what the package actually ships.

Package: **`veilguard`** on npm — <https://www.npmjs.com/package/veilguard>
Version at time of writing: **0.2.0**

---

## 1. Binaries

The package publishes **two** bin entries (see `package.json`):

| Bin | Entry | Purpose |
|-----|-------|---------|
| `veilguard-mcp` | `dist/index.js` | Starts the MCP server over stdio. This is what IDEs run. |
| `veilguard-cli` | `dist/cli.js` | Command-line tool: `init`, `quick-scan`, and (default) start the server. |

There is **no** bin literally named `veilguard`. Because the package has
multiple bins and none matches the package name, you must tell `npx` both the
package and the binary:

```
npx -y --package=veilguard veilguard-mcp     # run the MCP server
npx -y --package=veilguard veilguard-cli …    # run a CLI command
```

`npx -y veilguard` alone does **not** work — do not document it anywhere.

---

## 2. Canonical MCP server config

This is the exact block published on npm and shown in the README. Cursor,
Windsurf, and Antigravity all use this shape:

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

**VS Code is the exception** — it uses top-level `servers` and an explicit
`type: "stdio"`:

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

`VEILGUARD_KEY` is the license key. Empty string = free tier.

---

## 3. Supported IDEs (exactly 5)

Cursor, VS Code, Windsurf, Claude Code, Antigravity. **No JetBrains, no others.**

`init` writes the MCP config to each IDE's **global** location (in the user's
HOME) so it applies to every project and never enters any repo. Each IDE also
supports a project-level equivalent if a user prefers to scope it manually.

| IDE | Global MCP config location | Shape |
|-----|----------------------------|-------|
| Cursor | `~/.cursor/mcp.json` | `mcpServers` |
| VS Code | user `mcp.json` (platform path below) | `servers` + `type: "stdio"` |
| Windsurf | `~/.windsurf/mcp.json` | `mcpServers` |
| Claude Code | `~/.claude.json`, written by `claude mcp add … -s user` | — |
| Antigravity | `~/.gemini/antigravity/mcp_config.json` | `mcpServers` |

VS Code user `mcp.json` path by platform:
- macOS: `~/Library/Application Support/Code/User/mcp.json`
- Linux: `~/.config/Code/User/mcp.json`
- Windows: `%APPDATA%\Code\User\mcp.json`

All global config files are **merged**: an existing config keeps its other
servers; only the `veilguard` entry is added/updated.

---

## 4. CLI commands

`veilguard-cli <command>` (default command is `start`).

| Command | Behavior |
|---------|----------|
| `init` | Interactive setup wizard (see §5). |
| `quick-scan --file <path>` | Runs secrets + env + injection + webhook scanners on one file. Prints only `critical`/`warning` findings; **silent if clean**. Tier = pro if `VEILGUARD_KEY` set, else free. |
| `quick-scan --dir <path>` | Same, for a directory. |
| `start` *(default)* | Starts the MCP server on stdio (same as `veilguard-mcp`). |

`quick-scan` is what the Claude Code hooks call (see §5.4).

---

## 5. The `init` command

Invocation:

```
npx -y --package=veilguard veilguard-cli init
```

### 5.1 Prompt

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

- Input is read from stdin with Node's `readline` (no extra deps).
- Accepts a single number or comma-separated list, e.g. `1,3,4`.
- `6` selects all five.
- Unknown tokens are ignored. If nothing valid is selected it prints
  `No valid selection. Run \`veilguard init\` again and pick 1–6.` and exits.

### 5.2 Files written per IDE

MCP config → **global (HOME)**, merged. Rules files → **project**, gitignored.

| Choice | Global MCP config (HOME) | Project files |
|--------|---------------------------|---------------|
| **1. Cursor** | `~/.cursor/mcp.json` (`mcpServers`) | `.cursorrules` |
| **2. VS Code** | user `mcp.json` (`servers` + `type: stdio`) | *(none)* |
| **3. Windsurf** | `~/.windsurf/mcp.json` (`mcpServers`) | `.windsurfrules` |
| **4. Claude Code** | `~/.claude.json` via `claude mcp add veilguard -s user -- npx -y --package=veilguard veilguard-mcp` (skipped silently if the Claude CLI isn't installed) | `CLAUDE.md`, `.claude/hooks.json` |
| **5. Antigravity** | `~/.gemini/antigravity/mcp_config.json` (`mcpServers`) | *(none)* |

All generated MCP configs use the canonical args from §2, including the empty
`VEILGUARD_KEY` placeholder. Because the configs are global, **nothing tracked
ends up in the repo** — only the optional rules files, which are gitignored.

### 5.3 `.gitignore` (keeps generated files out of the repo)

`init` adds every file it writes **into the project** to `.gitignore`, so a
user never accidentally commits their local IDE setup. Files written to HOME
(`~/.windsurf`, `~/.gemini`) are never in the repo, so they're not listed.

- If the project has no `.gitignore`, one is **created**.
- Existing entries are de-duplicated (nothing added twice).
- Entries are grouped under a comment header:
  `# Veilguard — local IDE setup (generated by \`veilguard init\`, not committed)`

Entries added, by IDE selected (only project files exist now — MCP configs are
global, so they don't need ignoring):

| IDE | gitignore entries |
|-----|-------------------|
| (always) | `.veilguard/` |
| Cursor | `.cursorrules` |
| VS Code | *(none)* |
| Windsurf | `.windsurfrules` |
| Claude Code | `CLAUDE.md`, `.claude/hooks.json` |
| Antigravity | *(none)* |

> Design note: Veilguard treats `init` as a **per-developer, local** setup
> step — nothing it generates is meant to be committed. That's why even the
> rules files (`.cursorrules`, `CLAUDE.md`, …), which are conventionally
> shared, are gitignored here. Each developer runs `init` themselves.

### 5.4 Per-IDE success lines + closing message

```
  ✓ Cursor: ~/.cursor/mcp.json (global) + .cursorrules created
  ✓ VS Code: ~/Library/Application Support/Code/User/mcp.json (global) created
  ✓ Windsurf: ~/.windsurf/mcp.json (global) + .windsurfrules created
  ✓ Claude Code: global MCP (user scope) + CLAUDE.md + .claude/hooks.json created
  ✓ Antigravity: ~/.gemini/antigravity/mcp_config.json (global) created
  ✓ .gitignore: 5 entries added — these stay out of your repo

  Veilguard is ready. Restart your IDE to activate.
  Free: all 13 scanners active (depth-limited).
  Pro: add VEILGUARD_KEY → veilguard.dev/pro
```

The generated Claude hooks call:
`npx -y --package=veilguard veilguard-cli quick-scan --file $FILE` (on save)
and `… --dir .` (pre-deploy).

---

## 6. MCP tools exposed by the server

15 tools total: 14 scanners + `full_audit`. All take a `directory` (absolute
path) argument except `check_headers` (takes a `url`).

| Tool | Argument | What it detects |
|------|----------|-----------------|
| `scan_secrets` | `directory` | 60+ secret patterns, client-side AI calls, service_role key in frontend, fallback-trap keys |
| `check_env` | `directory` | `.env` not gitignored / tracked, `NEXT_PUBLIC_` secret exposure |
| `scan_webhooks` | `directory` | Unverified webhook signatures, missing payment-failure handlers |
| `scan_injection` | `directory` | SQL/NoSQL/command injection, unsanitized `req.body` |
| `check_headers` | `url` | Missing security headers (CSP, HSTS, X-Frame-Options, …) on a live URL |
| `check_auth_config` | `directory` | `getSession` vs `getUser`, localStorage sessions, weak/ reusable reset tokens, missing rate limiting |
| `check_git` | `directory` | `.env` tracked, `.gitignore` gaps, secrets in history (pro) |
| `check_cors` | `directory` | Wildcard origins, `cors()` with no options, manual `*` headers |
| `check_supply_chain` | `directory` | Known-malicious + typosquatted npm packages, suspicious install scripts |
| `scan_dependencies` | `directory` | Known CVEs via Google OSV.dev |
| `check_supabase_rls` | `directory` | `USING(true)`, `auth.role()` misuse, `auth.uid() IS NOT NULL` bypass, missing RLS, unfiltered `select('*')` |
| `check_firebase` | `directory` | Open rules (`if true`), client-controlled auth, auth-only reads |
| `scan_app_security` | `directory` | Rate limiting, IDOR, uploads, error/stack exposure, sensitive logging, open redirects, mass assignment |
| `scan_rules_files` | `directory` | Hidden-Unicode / base64 / malicious-instruction backdoors in AI rules files |
| `full_audit` | `directory` | Runs all scanners, returns a graded report (A+–F). **Grade gated by Pro.** |

> Note on counts: there are **14 scanner tools** + `full_audit` = **15 MCP
> tools**. `full_audit` internally runs **13** code scanners (every scanner
> except `check_headers`, which needs a live URL). The README markets "14
> scanners"; the `init` closing line says "13 scanners." See §9.

---

## 7. Free vs Pro behavior

| | Free (`VEILGUARD_KEY` empty) | Pro (valid key) |
|--|------------------------------|-----------------|
| Individual scanner tools (MCP) | Run at full depth* | Run at full depth |
| `full_audit` grade (A+–F) | 🔒 Locked (findings shown, grade hidden) | ✅ Shown |
| `full_audit` AI fix prompt | 🔒 Locked | ✅ Shown |
| `full_audit` runs/month | — | **3 / month** (`PRO_AUDIT_LIMIT`) |
| Git history deep scan (`check_git`) | Info-only upsell | ✅ Scans history |
| `quick-scan` CLI tier | free | pro |

\* In the MCP server (`server.ts`) every individual tool is invoked with
`TIER = 'pro'`, so IDE users get full results from all 14 scanners regardless
of key — only `full_audit`'s grade is gated. The free finding caps
(`FREE_TIER_MAX_FINDINGS = 3`) and the "[Upgrade to Pro]" fix text only appear
on the `free` code path (used by the CLI `quick-scan` without a key, and the
locked audit). Keep frontend copy consistent with this.

---

## 8. License & usage API (frontend contract)

The package talks to your backend. The frontend/backend must implement these.

### 8.1 License validation

- **Endpoint:** `POST https://veilguard.dev/api/validate-license`
- **Request body:** `{ "key": "<VEILGUARD_KEY>" }`
- **Expected response:** `{ "tier": "free" | "pro", "valid": boolean }`
- A response with `valid: true` is treated as **pro**.
- Result cached locally for **24h** at `~/.veilguard/license-cache.json`.
- Network failures fall back to (stale) cache, then to free. Validation never throws.

### 8.2 Audit usage (client-side, local)

- Tracked locally at `~/.veilguard/usage.json` as `{ count, reset_date }`.
- Limit: **3 full audits/month** (`PRO_AUDIT_LIMIT`). Resets the 1st of each month.
- This is enforced client-side only; the backend does not currently see audit counts.

### 8.3 Other external calls

- **OSV.dev:** `POST https://api.osv.dev/v1/query` (dependency CVE lookups). No auth.

---

## 9. Constants the frontend should mirror

From `src/utils/constants.ts` and license code:

| Constant | Value |
|----------|-------|
| License API | `https://veilguard.dev/api/validate-license` |
| OSV API | `https://api.osv.dev/v1/query` |
| License cache TTL | 24h |
| Free finding cap | 3 (`FREE_TIER_MAX_FINDINGS`) |
| Pro full-audits / month | 3 (`PRO_AUDIT_LIMIT`) |
| Local state dir | `~/.veilguard/` |

### Known inconsistencies to reconcile (not yet fixed)

These exist in the current code/copy and may not match the frontend — decide
on the canonical value and align both sides:

1. **Pricing:** the upgrade message says **$19/mo or $149/yr**, but the locked
   full-audit report says **$15/month**. Pick one.
2. **Scanner count wording:** README says "14 scanners" / "15 tools"; the
   `init` closing line says "13 scanners." All are defensible (see §6) but the
   marketing number should be consistent across site + package.
3. **`init` free-tier line** says scanners are "depth-limited," but in MCP mode
   they actually run at full depth (§7). Reword if you want it precise.
