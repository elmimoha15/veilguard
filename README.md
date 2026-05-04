# 🛡️ Veilguard

**Silent security for vibe coders.**

Veilguard is an MCP security scanner that runs inside your AI coding IDE. It catches vulnerabilities that AI-generated code introduces — leaked secrets, SQL injection, broken database security, unverified webhooks, and more.

You never run a scan. You never read a report. You just vibe.

## Install

```bash
npx @veilguard/cli init
```

This auto-detects your IDE, installs security rules, and adds the MCP server config. Takes 30 seconds.

## IDE Support

| IDE | Config |
|-----|--------|
| Claude Code | `claude mcp add veilguard -- npx -y @veilguard/cli` |
| Cursor | `.cursor/mcp.json` |
| Windsurf | `~/.windsurf/mcp.json` |
| VS Code | `.vscode/mcp.json` |
| JetBrains | Settings → Tools → MCP Server |
| Antigravity | MCP Settings Panel |

**MCP config (all IDEs):**

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

Free users: leave `VEILGUARD_KEY` empty. Pro users: add your key from [veilguard.dev/pro](https://veilguard.dev/pro).

## What It Catches

**13 scanners. Every vulnerability AI introduces.**

### Free (all users)

| Scanner | What it checks |
|---------|---------------|
| `scan_secrets` | 50+ secret patterns: Stripe, Supabase, OpenAI, Paystack, Flutterwave, M-Pesa, AWS, and more |
| `scan_dependencies` | Known CVEs in npm packages via Google OSV.dev |
| `scan_webhooks` | Unverified Stripe, Paystack, M-Pesa, GitHub webhooks |
| `scan_injection` | SQL injection, unsanitized input, command injection |
| `check_cors` | CORS wildcard misconfigurations |
| `check_supply_chain` | Malicious and typosquatted npm packages |
| `check_env` | .env gitignore, NEXT_PUBLIC_ misuse |
| `check_auth_config` | Clerk, NextAuth, Supabase Auth validation |
| `check_headers` | Security headers (CSP, HSTS, X-Frame-Options) |
| `check_git` | Secrets in git history, exposed .git, gitignore gaps |

### Pro ($19/month)

| Scanner | What it checks |
|---------|---------------|
| `check_supabase_rls` | Deep RLS audit — catches the patterns behind Moltbook and Lovable breaches |
| `check_firebase` | Firebase security rules analysis |
| `full_audit` | All 13 scanners + grade (A+ to F) + AI-ready fix prompt. 3/month. |

## Free vs Pro

| Feature | Free | Pro |
|---------|------|-----|
| All 13 scanners | ✅ | ✅ |
| Findings per scan | First 3 | All |
| Fix suggestions | Hidden on critical | All shown |
| Dependency scanning | Critical CVEs only | All severities |
| Git history scan | Current files | Full history |
| Supply chain check | Top 20 deps | All deps |
| Supabase RLS audit | ❌ | ✅ |
| Firebase audit | ❌ | ✅ |
| Full audit with grade | ❌ | 3/month |

## How Auto-Scanning Works

Veilguard installs a security rules file that tells your AI agent when to scan:

- After writing/modifying files → `scan_secrets`
- After creating API routes → `scan_webhooks` + `scan_injection`
- After changing DB schemas → `check_supabase_rls`
- After modifying package.json → `check_supply_chain`
- Before deploying → `full_audit`

Clean scan = total silence. Issue found = calm nudge.

## License

MIT

## Links

- [Website](https://veilguard.dev)
- [Documentation](https://veilguard.dev/docs)
- [Go Pro](https://veilguard.dev/pro)
# veilguard
# veilguard
# veilguard
