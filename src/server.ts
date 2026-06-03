import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  getFullAuditMessage,
  getAuditLimitMessage,
  canRunAudit,
  recordAuditUsage,
} from './license/license.js';
import { scanSecrets, formatSecretResults } from './scanners/secret-scanner.js';
import { checkEnv, formatEnvResults } from './scanners/env-checker.js';
import { scanWebhooks, formatWebhookResults } from './scanners/webhook-scanner.js';
import { scanInjection, formatInjectionResults } from './scanners/injection-scanner.js';
import { checkHeaders, formatHeaderResults } from './scanners/header-checker.js';
import { checkAuthConfig, formatAuthResults } from './scanners/auth-config-checker.js';
import { checkGit, formatGitResults } from './scanners/git-checker.js';
import { checkCors, formatCorsResults } from './scanners/cors-scanner.js';
import { checkSupplyChain, formatSupplyChainResults } from './scanners/supply-chain-checker.js';
import { scanDependencies, formatDependencyResults } from './scanners/dependency-checker.js';
import { analyzeRls, formatRlsResults } from './scanners/rls-analyzer.js';
import { analyzeFirebase, formatFirebaseResults } from './scanners/firebase-analyzer.js';
import { scanAppSecurity, formatAppSecurityResults } from './scanners/app-security-scanner.js';
import { scanRulesFiles, formatRulesFileResults } from './scanners/rules-file-scanner.js';
import { runAllScanners, formatAuditReport } from './scanners/full-audit.js';
import type { ScanResult, Tier } from './types.js';

const DIR_ARG = {
  directory: z.string().describe('Absolute path to the project root directory'),
};

// The 13 directory-based scanner tools. Each resolves the caller's real tier
// (free vs pro) so the formatter can gate fixes/breach context — free users see
// the alert, Pro users see the solution.
const DIR_TOOLS: Array<{
  name: string;
  description: string;
  scanner: (dir: string, tier: Tier) => Promise<ScanResult>;
  formatter: (result: ScanResult, tier: Tier) => string;
}> = [
  {
    name: 'scan_secrets',
    description:
      'Scan project files for hardcoded API keys, tokens, and passwords. Supports 60+ providers including Stripe, Supabase, OpenAI, Paystack, Flutterwave, M-Pesa, AWS, and more.',
    scanner: scanSecrets,
    formatter: formatSecretResults,
  },
  {
    name: 'check_env',
    description:
      'Verify .env files are gitignored, check for secrets exposed via NEXT_PUBLIC_ prefix, and validate environment configuration.',
    scanner: checkEnv,
    formatter: formatEnvResults,
  },
  {
    name: 'scan_webhooks',
    description:
      'Find webhook endpoints missing signature verification. Checks Stripe constructEvent, Paystack HMAC, M-Pesa IP validation, GitHub signature.',
    scanner: scanWebhooks,
    formatter: formatWebhookResults,
  },
  {
    name: 'scan_injection',
    description:
      'Detect SQL injection via template literals, unsanitized req.body passed to database, and command injection via exec/eval.',
    scanner: scanInjection,
    formatter: formatInjectionResults,
  },
  {
    name: 'check_auth_config',
    description:
      'Validate authentication setup — Clerk, NextAuth, Supabase Auth. Checks email verification, session management, rate limiting, getSession vs getUser.',
    scanner: checkAuthConfig,
    formatter: formatAuthResults,
  },
  {
    name: 'check_git',
    description:
      'Check git security — secrets in history, exposed .git directory, .gitignore gaps, tracked .env files.',
    scanner: checkGit,
    formatter: formatGitResults,
  },
  {
    name: 'check_cors',
    description:
      'Detect CORS misconfigurations — wildcard origins, missing origin filtering, cors() with no options.',
    scanner: checkCors,
    formatter: formatCorsResults,
  },
  {
    name: 'check_supply_chain',
    description: 'Detect malicious and typosquatted npm packages that AI tools sometimes suggest.',
    scanner: checkSupplyChain,
    formatter: formatSupplyChainResults,
  },
  {
    name: 'scan_dependencies',
    description: 'Check npm packages for known CVEs via Google OSV.dev database.',
    scanner: scanDependencies,
    formatter: formatDependencyResults,
  },
  {
    name: 'check_supabase_rls',
    description:
      'Deep audit of Supabase Row Level Security policies. Catches USING(true), auth.role() misuse, auth.uid() IS NOT NULL bypass, missing policies, and select(*) without filters.',
    scanner: analyzeRls,
    formatter: formatRlsResults,
  },
  {
    name: 'check_firebase',
    description:
      'Analyze Firebase security rules for open access patterns, client-controlled auth checks, and missing restrictions.',
    scanner: analyzeFirebase,
    formatter: formatFirebaseResults,
  },
  {
    name: 'scan_app_security',
    description:
      'Detect application-layer security gaps: missing rate limiting, IDOR (Insecure Direct Object References), insecure password storage, unsafe file uploads, leaking error stack traces, sensitive data in logs, open redirects, and mass assignment via req.body.',
    scanner: scanAppSecurity,
    formatter: formatAppSecurityResults,
  },
  {
    name: 'scan_rules_files',
    description:
      'Scan AI rules files (.cursorrules, .windsurfrules, CLAUDE.md, etc.) for hidden Unicode backdoors, base64 payloads, suspicious URLs, and malicious instructions.',
    scanner: scanRulesFiles,
    formatter: formatRulesFileResults,
  },
];

// The session tier is resolved once at startup (in index.ts) and passed in here,
// so we validate against Polar a single time per server lifetime rather than on
// every scan.
export function createServer(tier: Tier): McpServer {
  const server = new McpServer({
    name: 'veilguard',
    version: '0.3.0',
  });

  for (const tool of DIR_TOOLS) {
    server.tool(tool.name, tool.description, DIR_ARG, async ({ directory }) => {
      const result = await tool.scanner(directory, tier);
      return { content: [{ type: 'text', text: tool.formatter(result, tier) }] };
    });
  }

  server.tool(
    'check_headers',
    'Verify security headers (CSP, HSTS, X-Frame-Options, etc.) on a deployed URL.',
    { url: z.string().url().describe('The deployed URL to check (e.g. https://myapp.vercel.app)') },
    async ({ url }) => {
      const result = await checkHeaders(url, tier);
      return { content: [{ type: 'text', text: formatHeaderResults(result, tier) }] };
    },
  );

  server.tool(
    'full_audit',
    'Run all security scanners and produce a scored report (A+ to F) with an AI-ready fix prompt. Pro only — unlimited. Free users get an upgrade prompt (no audit).',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      // Full audit is Pro-only. Free gets no audit at all — just the upsell.
      if (tier !== 'pro') {
        return { content: [{ type: 'text', text: getFullAuditMessage() }] };
      }

      // Pro gets a generous monthly allotment of full audits. Once it's used up,
      // show the limit message instead of running the (expensive) full scan.
      if (!(await canRunAudit())) {
        return { content: [{ type: 'text', text: getAuditLimitMessage() }] };
      }

      const report = await runAllScanners(directory, tier);
      await recordAuditUsage();
      return { content: [{ type: 'text', text: formatAuditReport(report) }] };
    },
  );

  return server;
}
