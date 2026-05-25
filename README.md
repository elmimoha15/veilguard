# 🛡️ Veilguard

**Silent security for vibe coders.**

Veilguard is an MCP security scanner that runs inside your AI coding IDE. It catches vulnerabilities that AI-generated code introduces — leaked secrets, SQL injection, broken database security, unverified webhooks, and more.

You never run a scan. You never read a report. You just vibe.

## Setup

Add the Veilguard MCP server to your IDE. Two steps: paste the config, restart.

### Step 1 — Add the MCP config

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

**Where to paste it:**

| IDE | Config location |
|-----|----------------|
| **Cursor** | `.cursor/mcp.json` in your project folder |
| **Windsurf** | `~/.windsurf/mcp.json` (global) |
| **VS Code** | Settings → search "MCP" → Edit in settings.json |
| **Claude Code** | Run: `claude mcp add veilguard -- npx -y --package=veilguard veilguard-mcp` |
| **Antigravity** | `.gemini/mcp.json` in your project folder |

### Step 2 — Restart your IDE

Close and reopen your IDE. Veilguard starts automatically.

> **Free users:** leave `VEILGUARD_KEY` empty.
> **Pro users:** paste your license key from [veilguard.dev/pro](https://veilguard.dev/pro).

Full per-IDE setup guides: [veilguard.dev/docs](https://veilguard.dev/docs)

## What It Catches

**14 tools. Every vulnerability AI introduces.**

| Scanner | What it checks |
|---------|---------------|
| `scan_secrets` | 60+ secret patterns: Stripe, Supabase, OpenAI, Paystack, Flutterwave, M-Pesa, AWS, and more |
| `check_env` | .env gitignore, NEXT_PUBLIC_ secret exposure |
| `scan_webhooks` | Unverified Stripe, Paystack, M-Pesa, GitHub webhooks |
| `scan_injection` | SQL injection, NoSQL injection, command injection, IDOR, mass assignment |
| `check_cors` | CORS wildcard misconfigurations |
| `check_supply_chain` | Malicious and typosquatted npm packages |
| `check_auth_config` | Clerk, NextAuth, Supabase Auth validation |
| `check_headers` | Security headers (CSP, HSTS, X-Frame-Options) |
| `check_git` | Secrets in git history, .gitignore gaps |
| `scan_dependencies` | Known CVEs in npm packages via Google OSV.dev |
| `check_supabase_rls` | Deep RLS audit — catches the patterns behind real breaches |
| `check_firebase` | Firebase security rules analysis |
| `scan_app_security` | Rate limiting, IDOR, password storage, file uploads, error exposure, open redirects |
| `full_audit` | All 13 scanners + grade (A+ to F) + AI-ready fix prompt (**Pro**) |

## How It Works

Your AI agent calls Veilguard tools automatically while you code:

- After writing/modifying files → `scan_secrets`
- After creating API routes → `scan_webhooks` + `scan_injection`
- After changing DB schemas → `check_supabase_rls`
- After modifying package.json → `check_supply_chain` + `scan_dependencies`
- Before deploying → `full_audit`

Clean scan = total silence. Issue found = plain-English nudge with a fix.

## Free vs Pro

| Feature | Free | Pro ($19/month) |
|---------|------|-----------------|
| All 13 scanners | ✅ | ✅ |
| Full audit with grade | 🔒 Grade locked | ✅ 3/month |
| AI-ready fix prompt | ❌ | ✅ |
| Dependency scanning | Critical CVEs only | All severities |
| Git history scan | Current files | Full history |

## License

MIT

## Links

- [Website](https://veilguard.dev)
- [Documentation](https://veilguard.dev/docs)
- [Go Pro](https://veilguard.dev/pro)
