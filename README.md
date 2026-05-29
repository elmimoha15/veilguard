<div align="center">

# 🛡️ Veilguard

**Silent security for AI-assisted development**

[![npm version](https://img.shields.io/npm/v/veilguard.svg)](https://www.npmjs.com/package/veilguard)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

[Website](https://veilguard.dev) · [Documentation](https://veilguard.dev/docs) · [Get Pro](https://veilguard.dev/pro)

</div>

---

Veilguard is an MCP security scanner that runs inside your AI coding IDE. It catches vulnerabilities that AI-generated code introduces — leaked secrets, SQL injection, broken database security, unverified webhooks, and more.

You never run a scan. You never read a report. You just code.

## Quick Start

### Option A — One command (recommended)

From your project root, run:

```bash
npx -y --package=veilguard veilguard-cli init
```

Veilguard asks which IDE(s) you use, then sets each one up. The MCP server config is written to the IDE's **global** location (in your home folder), so it works across all your projects and **nothing is added to your repo**. The optional AI rules file (`.cursorrules`, `.windsurfrules`, `CLAUDE.md`, …) is written to the project and auto-added to `.gitignore`. Pick one or several (e.g. `1,3,4`). Then restart your IDE.

### Option B — Manual setup

Copy this JSON into your IDE's MCP config file:

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

<details>
<summary><strong>📍 Config file locations by IDE</strong></summary>

| IDE | Config file | Config key |
|-----|-------------|------------|
| **Cursor** | `.cursor/mcp.json` (project) | `mcpServers` |
| **VS Code** | `.vscode/mcp.json` (project) | `servers` + `"type": "stdio"` — see below |
| **Windsurf** | `~/.windsurf/mcp.json` (global) | `mcpServers` |
| **Claude Code** | run `claude mcp add veilguard -- npx -y --package=veilguard veilguard-mcp` | — |
| **Antigravity** | `~/.gemini/antigravity/mcp_config.json` (global) | `mcpServers` |

**VS Code** uses a slightly different shape — top-level `servers` and an explicit `type`:

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

</details>

### Restart your IDE

Close and reopen your IDE. Veilguard starts automatically.

> **Free users:** Leave `VEILGUARD_KEY` empty — all 14 scanners work out of the box.  
> **Pro users:** Add your license key from [veilguard.dev/pro](https://veilguard.dev/pro) to unlock graded audits.

📚 **Full setup guides:** [veilguard.dev/docs](https://veilguard.dev/docs)

## Security Scanners

Veilguard includes **15 specialized security tools** that catch every vulnerability AI-generated code introduces:

| Scanner | What It Detects |
|---------|-----------------|
| `scan_secrets` | 60+ secret patterns, client-side AI API calls, service_role key exposure |
| `check_env` | Unprotected .env files, NEXT_PUBLIC_ secret exposure |
| `scan_webhooks` | Unverified webhooks, missing payment failure handlers |
| `scan_injection` | SQL/NoSQL/command injection, IDOR, mass assignment |
| `check_cors` | CORS wildcard misconfigurations |
| `check_supply_chain` | Malicious and typosquatted npm packages |
| `check_auth_config` | Auth misconfigurations, insecure password reset flows |
| `check_headers` | Missing security headers (CSP, HSTS, X-Frame-Options) |
| `check_git` | Secrets in git history, .gitignore gaps |
| `scan_dependencies` | Known CVEs via Google OSV.dev |
| `check_supabase_rls` | Row Level Security misconfigurations |
| `check_firebase` | Firebase security rules analysis |
| `scan_app_security` | Rate limiting, file uploads, error exposure, open redirects |
| `scan_rules_files` | Hidden Unicode backdoors in AI rules files |
| `full_audit` | All scanners + security grade (A+ to F) |

## How It Works

Your AI agent calls Veilguard tools **automatically** while you code:

| Trigger | Scanner |
|---------|---------|
| Writing/modifying files | `scan_secrets` |
| Creating API routes | `scan_webhooks` + `scan_injection` |
| Changing database schemas | `check_supabase_rls` |
| Modifying package.json | `check_supply_chain` + `scan_dependencies` |
| Modifying AI rules files | `scan_rules_files` |
| Before deploying | `full_audit` |

**Clean scan = silence.** Issue found = plain-English explanation with a fix.

## Free vs Pro

| Feature | Free | Pro |
|---------|:----:|:---:|
| All 14 scanners | ✅ | ✅ |
| Full audit with grade | 🔒 | ✅ |
| AI-ready fix prompts | — | ✅ |
| All CVE severities | — | ✅ |
| Git history scanning | — | ✅ |

**Pro:** $19/month · unlimited audits/month · [Get Pro →](https://veilguard.dev/pro)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE) © Mohamed Elmi

---

<div align="center">

**[Website](https://veilguard.dev)** · **[Documentation](https://veilguard.dev/docs)** · **[Get Pro](https://veilguard.dev/pro)**

Made with 🛡️ for developers who ship fast

</div>
