import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateLicense } from './license/license.js';
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
import { runFullAudit, runAllScanners, formatAuditReport, formatLockedAuditReport } from './scanners/full-audit.js';

export function createServer(): McpServer {
  const server = new McpServer({
    name: 'veilguard',
    version: '0.3.0',
  });

  // all scanners run at pro depth — only full_audit is gated
  const TIER = 'pro' as const;

  server.tool(
    'scan_secrets',
    'Scan project files for hardcoded API keys, tokens, and passwords. Supports 60+ providers including Stripe, Supabase, OpenAI, Paystack, Flutterwave, M-Pesa, AWS, and more.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await scanSecrets(directory, TIER);
      return { content: [{ type: 'text', text: formatSecretResults(result, TIER) }] };
    },
  );

  server.tool(
    'check_env',
    'Verify .env files are gitignored, check for secrets exposed via NEXT_PUBLIC_ prefix, and validate environment configuration.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await checkEnv(directory, TIER);
      return { content: [{ type: 'text', text: formatEnvResults(result, TIER) }] };
    },
  );

  server.tool(
    'scan_webhooks',
    'Find webhook endpoints missing signature verification. Checks Stripe constructEvent, Paystack HMAC, M-Pesa IP validation, GitHub signature.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await scanWebhooks(directory, TIER);
      return { content: [{ type: 'text', text: formatWebhookResults(result, TIER) }] };
    },
  );

  server.tool(
    'scan_injection',
    'Detect SQL injection via template literals, unsanitized req.body passed to database, and command injection via exec/eval.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await scanInjection(directory, TIER);
      return { content: [{ type: 'text', text: formatInjectionResults(result, TIER) }] };
    },
  );

  server.tool(
    'check_headers',
    'Verify security headers (CSP, HSTS, X-Frame-Options, etc.) on a deployed URL.',
    { url: z.string().url().describe('The deployed URL to check (e.g. https://myapp.vercel.app)') },
    async ({ url }) => {
      const result = await checkHeaders(url, TIER);
      return { content: [{ type: 'text', text: formatHeaderResults(result, TIER) }] };
    },
  );

  server.tool(
    'check_auth_config',
    'Validate authentication setup — Clerk, NextAuth, Supabase Auth. Checks email verification, session management, rate limiting, getSession vs getUser.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await checkAuthConfig(directory, TIER);
      return { content: [{ type: 'text', text: formatAuthResults(result, TIER) }] };
    },
  );

  server.tool(
    'check_git',
    'Check git security — secrets in history, exposed .git directory, .gitignore gaps, tracked .env files.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await checkGit(directory, TIER);
      return { content: [{ type: 'text', text: formatGitResults(result, TIER) }] };
    },
  );

  server.tool(
    'check_cors',
    "Detect CORS misconfigurations — wildcard origins, missing origin filtering, cors() with no options.",
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await checkCors(directory, TIER);
      return { content: [{ type: 'text', text: formatCorsResults(result, TIER) }] };
    },
  );

  server.tool(
    'check_supply_chain',
    'Detect malicious and typosquatted npm packages that AI tools sometimes suggest.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await checkSupplyChain(directory, TIER);
      return { content: [{ type: 'text', text: formatSupplyChainResults(result, TIER) }] };
    },
  );

  server.tool(
    'scan_dependencies',
    'Check npm packages for known CVEs via Google OSV.dev database.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await scanDependencies(directory, TIER);
      return { content: [{ type: 'text', text: formatDependencyResults(result, TIER) }] };
    },
  );

  server.tool(
    'check_supabase_rls',
    'Deep audit of Supabase Row Level Security policies. Catches USING(true), auth.role() misuse, auth.uid() IS NOT NULL bypass, missing policies, and select(*) without filters.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await analyzeRls(directory, TIER);
      return { content: [{ type: 'text', text: formatRlsResults(result, TIER) }] };
    },
  );

  server.tool(
    'check_firebase',
    'Analyze Firebase security rules for open access patterns, client-controlled auth checks, and missing restrictions.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await analyzeFirebase(directory, TIER);
      return { content: [{ type: 'text', text: formatFirebaseResults(result, TIER) }] };
    },
  );

  server.tool(
    'scan_app_security',
    'Detect application-layer security gaps: missing rate limiting, IDOR (Insecure Direct Object References), insecure password storage, unsafe file uploads, leaking error stack traces, sensitive data in logs, open redirects, and mass assignment via req.body.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await scanAppSecurity(directory, TIER);
      return { content: [{ type: 'text', text: formatAppSecurityResults(result, TIER) }] };
    },
  );

  server.tool(
    'scan_rules_files',
    'Scan AI rules files (.cursorrules, .windsurfrules, CLAUDE.md, etc.) for hidden Unicode backdoors, base64 payloads, suspicious URLs, and malicious instructions.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const result = await scanRulesFiles(directory, TIER);
      return { content: [{ type: 'text', text: formatRulesFileResults(result, TIER) }] };
    },
  );

  server.tool(
    'full_audit',
    'Run all 14 security scanners and produce a scored report (A+ to F) with an AI-ready fix prompt. Requires VEILGUARD_KEY for the grade; free users see findings with a locked grade.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();

      if (license.tier !== 'pro') {
        const report = await runAllScanners(directory, TIER);
        return { content: [{ type: 'text', text: formatLockedAuditReport(report) }] };
      }

      const result = await runFullAudit(directory, license.tier);
      if (typeof result === 'string') {
        return { content: [{ type: 'text', text: result }] };
      }
      return { content: [{ type: 'text', text: formatAuditReport(result) }] };
    },
  );

  return server;
}
