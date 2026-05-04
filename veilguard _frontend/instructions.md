LANDING-PAGE.md — Veilguard Website Backend & Content
This is a separate project from the Veilguard MCP server. The MCP server is an npm package. This project is the website backend (license validation), payment integration, and content source for the landing page.
The UI/frontend will be built by Lovable. This file covers only: Firebase backend, Polar payment integration, page content (text/copy for Lovable to render), IDE config data, SEO metadata, and deployment.
Hosted on: Firebase Hosting + Firebase Cloud Functions Payments: Polar (checkout, subscriptions, license key generation) Domain: veilguard.dev

Firebase Cloud Function — License Validation
This is the only backend code in the entire Veilguard ecosystem. One function, ~30 lines. Everything else is static.
Project structure (backend only):
veilguard-web/
├── functions/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       └── index.ts                 # License validation endpoint
│
├── firebase.json                    # Hosting rewrites + security headers
├── .firebaserc                      # Firebase project ID
└── package.json

Lovable will generate the public/ folder with the frontend. The functions/ folder is the only thing you build yourself.
firebase.json:
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/validate-license",
        "function": "validateLicense"
      }
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "X-Frame-Options", "value": "DENY" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
        ]
      },
      {
        "source": "**/*.@(css|js|svg|png|jpg|ico|woff2)",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      }
    ]
  },
  "functions": {
    "source": "functions",
    "runtime": "nodejs20"
  }
}

functions/src/index.ts:
import { onRequest } from "firebase-functions/v2/https";

const POLAR_API_URL = "https://api.polar.sh/v1/licenses/validate";
const POLAR_ACCESS_TOKEN = process.env.POLAR_ACCESS_TOKEN;

export const validateLicense = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { key } = req.body;

  if (!key || typeof key !== "string") {
    res.status(400).json({ tier: "free", error: "Missing license key" });
    return;
  }

  try {
    const response = await fetch(POLAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${POLAR_ACCESS_TOKEN}`
      },
      body: JSON.stringify({ key })
    });

    const data = await response.json();

    if (data.validated) {
      res.status(200).json({ tier: "pro", valid: true });
    } else {
      res.status(200).json({ tier: "free", valid: false });
    }
  } catch (error) {
    res.status(200).json({ tier: "free", valid: false, error: "Validation service unavailable" });
  }
});

How the MCP server calls this: POST to https://veilguard.dev/api/validate-license with { key: "vg_pro_..." }. Returns { tier: "pro" } or { tier: "free" }. MCP server caches result for 24 hours in ~/.veilguard/license-cache.json.
Environment variable setup:
firebase functions:secrets:set POLAR_ACCESS_TOKEN
# Paste your Polar access token when prompted


Polar Setup
Step 1: Create Polar Account
Go to https://polar.sh and create an account.
Step 2: Create Product
Name: Veilguard Pro
Description: Full security scanning for vibe coders. All findings, all fixes, Supabase RLS audit, Firebase audit, full security grade.
Pricing:
Recurring Monthly: $19/month
Recurring Yearly: $149/year
License Keys: Enable license key generation
Checkout Success URL: https://veilguard.dev/pro?success=true
Step 3: Get Checkout Links
Polar gives you checkout URLs for each pricing variant:
Monthly: https://polar.sh/checkout/your-org/veilguard-pro-monthly
Annual:  https://polar.sh/checkout/your-org/veilguard-pro-annual

Step 4: Get API Access Token
Polar dashboard → Settings → API → Create access token. Goes into Firebase Cloud Function as POLAR_ACCESS_TOKEN.

Page Content Data (for Lovable)
The website has 3 pages: homepage (/), pro checkout (/pro), docs (/docs). Below is all text content and structured data. No design instructions — Lovable handles UI.

Homepage Content
Hero:
Headline: "Silent security for vibe coders"
Subheadline: "Security that watches while you vibe. No scans to run. No reports to read. Just gentle nudges."
Primary CTA: "Get Started — Free" → scrolls to install section
Secondary CTA: "Go Pro — $19/mo" → links to /pro
IDE list: "Works in: Claude Code · Cursor · Windsurf · VS Code · JetBrains · Antigravity"
Problem stats:
"99% of vibe-coded apps have security vulnerabilities."
stat: "196/198 projects had vulnerabilities" — source: PainIndex
stat: "45% of AI code has OWASP Top 10 flaws" — source: Veracode 2025
stat: "2.74x more security issues than human code" — source: CodeRabbit
stat: "322% surge in hardcoded secrets" — source: GitGuardian 2026
How it works:
title: "Install (30 seconds)" — body: "One command. Works in every IDE." — code: npx @veilguard/cli init
title: "Code normally" — body: "Veilguard runs silently. Your AI agent calls security scans automatically — before deploys, after file changes, when you touch database schemas or API routes."
title: "Get nudged when it matters" — body: "If something's wrong, a calm message appears. If everything's clean, total silence. You never think about security. That's the point."
Scanner list (free — 10 tools):
id
name
description
scan_secrets
Secret Scanner
Catches leaked API keys — Stripe, Supabase, OpenAI, Paystack, Flutterwave, M-Pesa, AWS, and 60+ more patterns.
scan_dependencies
Dependency Checker
Finds known CVEs in your npm packages via Google's OSV database.
scan_webhooks
Webhook Verifier
Catches unverified Stripe, Paystack, and M-Pesa webhooks before attackers exploit them.
scan_injection
Injection Scanner
Finds SQL injection, unsanitized input, and command injection that AI generates constantly.
check_cors
CORS Checker
Catches cors({ origin: '*' }) and other misconfigurations.
check_supply_chain
Supply Chain Checker
Detects malicious and typosquatted npm packages that AI suggests.
check_env
Env Checker
Verifies .env files are gitignored and secrets aren't in client code.
check_auth_config
Auth Config Checker
Validates Clerk, NextAuth, Supabase Auth setup — email verification, session expiry, rate limiting.
check_headers
Header Checker
Verifies security headers — CSP, HSTS, X-Frame-Options.
check_git
Git Security
Checks for secrets in git history, exposed .git directories, missing .gitignore rules.

Scanner list (Pro — 3 tools):
id
name
description
check_supabase_rls
Supabase RLS Audit
Deep audit of your Row Level Security policies. Catches the exact patterns that caused the Moltbook and Lovable breaches.
check_firebase
Firebase Rules Audit
Analyzes your Firestore/Storage security rules for open access, missing auth checks, and client-controlled queries.
full_audit
Full Security Audit
Runs all 13 scanners. Gives you a grade (A+ to F). Generates an AI-ready fix prompt to patch everything at once. 3 audits per month.

Breach data:
name
year
impact
cause
veilguard_catches
Moltbook
2025
1.5M tokens + 35K emails exposed
Supabase service_role key in client JS, no RLS
scan_secrets, check_supabase_rls
Lovable
2025
170+ production apps exposed
CVE-2025-48757, missing RLS on all tables
check_supabase_rls
Tea App
2025
72,000 user images leaked
Public cloud storage bucket, no ACL
check_env, scan_secrets
CurXecute
2025
Remote code execution on dev machines
CVE-2025-54135, malicious MCP config
scan_secrets, check_supply_chain
Flutterwave
2024
₦11 billion stolen
Payment keys compromised
scan_secrets (FLWSECK_LIVE pattern)

IDE support data:
ide
setup_method
config_path
Claude Code
claude mcp add veilguard -- npx -y @veilguard/cli
.claude/mcp.json
Cursor
Add to config file
.cursor/mcp.json
Windsurf
Add to config file
~/.windsurf/mcp.json
VS Code
Add to config file
.vscode/mcp.json
JetBrains
Settings → Tools → MCP Server
IDE settings
Antigravity
MCP settings panel
IDE settings

Auto-detect: npx @veilguard/cli init
Pricing comparison:
feature
free
pro
All 13 scanner tools
Available
Available
Findings per scan
First 3 shown
All shown
Fix suggestions
Hidden on critical
All shown
Dependency scanning
Critical CVEs only
All severities
Git history deep scan
Current files only
Full history
Supply chain check
Top 20 deps
All deps
Breach precedent context
No
Yes
Supabase RLS deep audit
No
Unlimited
Firebase rules audit
No
Unlimited
Full audit with grade
No
3/month
AI-ready fix prompt
No
Yes
price
$0
$19/month or $149/year (save 35%)

MCP config JSON (universal — same for all IDEs):
{
  "mcpServers": {
    "veilguard": {
      "command": "npx",
      "args": ["-y", "@veilguard/cli"],
      "env": {
        "VEILGUARD_KEY": "your_key_here"
      }
    }
  }
}

Config file locations per IDE:
ide
path
notes
Claude Code
.claude/mcp.json
Also: claude mcp add veilguard -- npx -y @veilguard/cli
Cursor
.cursor/mcp.json
Project-level
Windsurf
~/.windsurf/mcp.json
Global
VS Code
.vscode/mcp.json
Project-level
JetBrains
Settings → Tools → MCP Server → Add
Name: veilguard, Command: npx, Args: -y @veilguard/cli, Env: VEILGUARD_KEY=your_key_here
Antigravity
MCP Settings Panel → Add Server
Name: veilguard, Command: npx -y @veilguard/cli, Env: VEILGUARD_KEY=your_key_here

Free users: leave VEILGUARD_KEY empty or remove the env line. Pro users: paste key from Polar confirmation email.
Auto-scanning explanation:
Rules file instructs AI agent to auto-call scans at key moments
Triggers: file create/modify → secrets, API routes → webhooks + injection, DB schemas → RLS, package.json → supply chain, deploy → full check
Claude Code: additional post-save hooks for true auto-scan
Clean = silence. Issue = calm nudge. Never nags twice.
Footer:
Product: Veilguard — Silent security for vibe coders
Links: GitHub, npm, MCP Registry, Smithery, PulseMCP
Credit: Built by [your name]. Made in Nairobi 🇰🇪
Legal: © 2026 Veilguard. MIT License (MCP server).

Pro Page Content (/pro)
Headline: "See everything. Fix everything." Subheadline: "Free users see 3 findings per scan. Pro users see all of them — plus the fixes, the full audit, and the breach context that tells you exactly why each issue matters."
Pricing cards:
plan
price
equivalent
badge
Monthly
$19/month
$19/month
—
Annual
$149/year
$12.42/month
"Save 35%"

Pro features list:
All findings shown (no caps)
Full fix suggestions for every issue
Supabase RLS deep audit (unlimited)
Firebase rules audit (unlimited)
Full security audit with grade (3/month)
Full git history secret scanning
Breach precedent context
All dependencies checked
AI-ready combined fix prompt
Checkout URLs (replace with actual Polar links):
Monthly button → https://polar.sh/checkout/your-org/veilguard-pro-monthly
Annual button → https://polar.sh/checkout/your-org/veilguard-pro-annual
Success state (URL has ?success=true):
Headline: "You're on Veilguard Pro!"
Body: "Your license key was sent to your email. Add it to your IDE config as VEILGUARD_KEY, then restart your IDE. Pro features are active immediately."
FAQ:
question
answer
How does the license key work?
Add it to your MCP config as an environment variable. Veilguard checks it once on startup, caches for 24 hours. Works offline. No account, no login, no dashboard.
What if I cancel?
Key deactivates at end of billing period. Drops to free tier silently. All tools still work. You keep rules files and auto-scan triggers.
Can I use it on multiple projects?
Yes. One key, all projects, all IDEs. No project limit.
Can I use it on multiple machines?
One key, one machine at a time. Move the key to switch machines.
Payment methods?
Polar handles payments. Credit/debit cards globally. Some regional methods depending on location.
Refunds?
Yes. 14 days, no questions. Email [your email].
Is the MCP server open source?
Yes. MIT licensed on GitHub. Pro features are gated by license key but code is visible.


Docs Page Content (/docs)
Single-page docs with anchored sections.
1. Getting Started
Description: "Veilguard is an MCP security scanner that runs inside your AI coding IDE. It catches vulnerabilities that AI-generated code introduces — leaked secrets, SQL injection, broken database security, unverified webhooks, and more."
Install: npx @veilguard/cli init
What init does: detects IDE, installs security rules file, adds MCP server config, sets up hooks for Claude Code
2. IDE Setup
Universal MCP config JSON (see above)
Per-IDE config paths table (see above)
Claude Code hooks: post-save hooks for auto-scanning on every file save
Adding Pro key: paste into env.VEILGUARD_KEY, restart IDE
3. Free vs Pro
Comparison table (see above)
Free example: 3 findings shown + "2 more found — upgrade"
Pro example: all 5 findings with fixes and breach context
4. Scanner Reference
scanner
checks
example_output
auto_trigger
scan_secrets
Hardcoded API keys, tokens, passwords. 60+ providers.
CRITICAL: Stripe live key in src/lib/payments.ts:14 — sk_live_51Mxyz... (masked) — Fix: Move to .env
After file create/modify
scan_dependencies
Known CVEs in npm packages via OSV.dev
CRITICAL: CVE-2024-34352 in next-auth@4.24.5 — Fix: Upgrade to 4.24.7
After package.json changes
scan_webhooks
Unverified webhook endpoints
CRITICAL: Stripe webhook at /api/webhook missing constructEvent
After API route changes
scan_injection
SQL injection, unsanitized input, command injection
CRITICAL: SQL injection in src/api/users.ts:23 — Template literal in db.query()
After API route changes
check_cors
CORS wildcard misconfigurations
CRITICAL: cors({ origin: '*' }) in src/middleware.ts
After config changes
check_supply_chain
Malicious and typosquatted npm packages
CRITICAL: Typosquatted package "lodahs" (did you mean "lodash"?)
After package.json changes
check_env
.env gitignore, NEXT_PUBLIC_ misuse
CRITICAL: .env not in .gitignore
After env/config changes
check_auth_config
Clerk/NextAuth/Supabase Auth config
WARNING: Email verification not required
After auth config changes
check_headers
HTTP security headers on deployed URL
WARNING: Missing Content-Security-Policy header
Before deploy
check_git
Git history secrets, exposed .git, gitignore gaps
CRITICAL: sk_live_ found in git history commit abc123
After git changes
check_supabase_rls [PRO]
Supabase RLS policy analysis, 6 bad patterns
CRITICAL: USING (auth.uid() IS NOT NULL) — logical bypass
After DB schema changes
check_firebase [PRO]
Firebase security rules analysis
CRITICAL: allow read, write: if true — completely open
After rules file changes
full_audit [PRO]
All 13 scanners, score 0-100, grade A+ to F, 3/month
Grade: C (68/100) — 4 critical, 3 warnings, 2 info
Before deploy

5. Auto-Scan Triggers
Trigger moments: file create/modify, DB schema changes, API route changes, dependency changes, env/config changes, before deploy, project start
Rules file approach: Cursor, Windsurf, VS Code, JetBrains, Antigravity
Hooks approach: Claude Code (post-save)
Behavior: clean = silence, issue = calm nudge, never nags twice
6. Scoring System
Base: 100 points
Critical: -15 each
Warning: -5 each
Info: -1 each
Min: 0
Grades: A+ (95-100), A (90-94), B+ (85-89), B (80-84), C+ (75-79), C (70-74), D (60-69), F (0-59)
7. African Fintech
Providers: Paystack (sk_live_, sk_test_), Flutterwave (FLWSECK_LIVE, FLWSECK_TEST), M-Pesa (consumer key/secret), Africa's Talking, Chipper Cash
Context: Flutterwave ₦11B breach (2024), Kenya DPA fines KSh 5M, Nigeria NDPR fines
Webhook verification: Paystack X-Paystack-Signature HMAC, M-Pesa callback IP validation, Flutterwave verifyTransactionHash
8. Troubleshooting
problem
solution
Not scanning automatically
Check rules file installed. Check MCP config. Restart IDE.
Pro key not working
Restart IDE. Check key format. Check internet (first validation needs network).
False positives
Add file/pattern to .veilguardignore (same format as .gitignore).
3/3 audits used
Resets 1st of each month. Individual scanners still unlimited.
Command not found
Check Node.js >= 18. Try: npx @veilguard/cli@latest init

9. Updating
Auto-updates via npx (fetches latest)
Pattern updates ship with npm versions
Check version: npx @veilguard/cli --version

SEO Metadata
Homepage:
title: "Veilguard — Silent Security for Vibe Coders"
description: "Security that watches while you vibe. MCP security scanner for Claude Code, Cursor, Windsurf, VS Code. Catches leaked secrets, SQL injection, broken RLS, and more. Free."
og:image: https://veilguard.dev/assets/images/og-image.png
Pro page:
title: "Veilguard Pro — See Everything. Fix Everything."
description: "Full security scanning for vibe coders. All findings, all fixes, Supabase RLS audit, Firebase audit, security grade. $19/month."
Docs page:
title: "Veilguard Docs — Install, Setup, Scanner Reference"
description: "How to install Veilguard, set up in any IDE, and use all 13 security scanners."
Target keywords: vibe coding security, MCP security scanner, Supabase RLS checker, AI code security, vibe coder vulnerabilities, cursor security scanner, claude code security

Deployment Checklist
First-time setup:
Buy domain: veilguard.dev
Create Firebase project in Firebase Console
Connect domain: Firebase Hosting → Custom domain → veilguard.dev
Create Polar account at polar.sh
Create Polar product: "Veilguard Pro" — Monthly ($19) + Annual ($149), license keys enabled
Copy Polar checkout URLs into /pro page buttons
Generate Polar API token: dashboard → Settings → API
Set Firebase secret: firebase functions:secrets:set POLAR_ACCESS_TOKEN
Build frontend with Lovable, drop generated files into public/
Deploy: firebase deploy
Test: buy subscription with Polar test mode, verify license validation end-to-end
Ongoing:
Frontend updates: firebase deploy --only hosting
Function updates: firebase deploy --only functions
Monitor: Firebase Console → Functions → Logs

Cost Breakdown
Item
Cost
Firebase Hosting
Free (10GB bandwidth/month)
Firebase Cloud Functions
Free (2M invocations/month)
Custom domain
~$12/year
Polar
5% of revenue (no monthly fee)
Total fixed cost
~$1/month


