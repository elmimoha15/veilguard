import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { validateLicense, getProOnlyMessage } from './license/license.js';
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
import { runFullAudit, formatAuditReport } from './scanners/full-audit.js';
import { logger } from './utils/logger.js';

/** Create and configure the Veilguard MCP server */
export function createServer(): McpServer {
  const server = new McpServer({
    name: 'veilguard',
    version: '0.1.0',
  });

  // ─── FREE TOOLS ───────────────────────────────────────────

  server.tool(
    'scan_secrets',
    'Scan project files for hardcoded API keys, tokens, and passwords. Supports 60+ providers including Stripe, Supabase, OpenAI, Paystack, Flutterwave, M-Pesa, AWS, and more.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      const result = await scanSecrets(directory, license.tier);
      return { content: [{ type: 'text', text: formatSecretResults(result, license.tier) }] };
    },
  );

  server.tool(
    'check_env',
    'Verify .env files are gitignored, check for secrets exposed via NEXT_PUBLIC_ prefix, and validate environment configuration.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      const result = await checkEnv(directory, license.tier);
      return { content: [{ type: 'text', text: formatEnvResults(result, license.tier) }] };
    },
  );

  server.tool(
    'scan_webhooks',
    'Find webhook endpoints missing signature verification. Checks Stripe constructEvent, Paystack HMAC, M-Pesa IP validation, GitHub signature.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      const result = await scanWebhooks(directory, license.tier);
      return { content: [{ type: 'text', text: formatWebhookResults(result, license.tier) }] };
    },
  );

  server.tool(
    'scan_injection',
    'Detect SQL injection via template literals, unsanitized req.body passed to database, and command injection via exec/eval.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      const result = await scanInjection(directory, license.tier);
      return { content: [{ type: 'text', text: formatInjectionResults(result, license.tier) }] };
    },
  );

  server.tool(
    'check_headers',
    'Verify security headers (CSP, HSTS, X-Frame-Options, etc.) on a deployed URL.',
    { url: z.string().url().describe('The deployed URL to check (e.g. https://myapp.vercel.app)') },
    async ({ url }) => {
      const license = await validateLicense();
      const result = await checkHeaders(url, license.tier);
      return { content: [{ type: 'text', text: formatHeaderResults(result, license.tier) }] };
    },
  );

  server.tool(
    'check_auth_config',
    'Validate authentication setup — Clerk, NextAuth, Supabase Auth. Checks email verification, session management, rate limiting, getSession vs getUser.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      const result = await checkAuthConfig(directory, license.tier);
      return { content: [{ type: 'text', text: formatAuthResults(result, license.tier) }] };
    },
  );

  server.tool(
    'check_git',
    'Check git security — secrets in history, exposed .git directory, .gitignore gaps, tracked .env files.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      const result = await checkGit(directory, license.tier);
      return { content: [{ type: 'text', text: formatGitResults(result, license.tier) }] };
    },
  );

  server.tool(
    'check_cors',
    "Detect CORS misconfigurations — wildcard origins, missing origin filtering, cors() with no options.",
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      const result = await checkCors(directory, license.tier);
      return { content: [{ type: 'text', text: formatCorsResults(result, license.tier) }] };
    },
  );

  server.tool(
    'check_supply_chain',
    'Detect malicious and typosquatted npm packages that AI tools sometimes suggest.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      const result = await checkSupplyChain(directory, license.tier);
      return { content: [{ type: 'text', text: formatSupplyChainResults(result, license.tier) }] };
    },
  );

  server.tool(
    'scan_dependencies',
    'Check npm packages for known CVEs via Google OSV.dev database.',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      const result = await scanDependencies(directory, license.tier);
      return { content: [{ type: 'text', text: formatDependencyResults(result, license.tier) }] };
    },
  );

  // ─── PRO TOOLS ────────────────────────────────────────────

  server.tool(
    'check_supabase_rls',
    'Deep audit of Supabase Row Level Security policies. Catches USING(true), auth.role() misuse, auth.uid() IS NOT NULL bypass, missing policies, and select(*) without filters. [PRO]',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      if (license.tier !== 'pro') {
        return { content: [{ type: 'text', text: getProOnlyMessage('Supabase RLS deep audit') }] };
      }
      const result = await analyzeRls(directory, license.tier);
      return { content: [{ type: 'text', text: formatRlsResults(result, license.tier) }] };
    },
  );

  server.tool(
    'check_firebase',
    'Analyze Firebase security rules for open access patterns, client-controlled auth checks, and missing restrictions. [PRO]',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      if (license.tier !== 'pro') {
        return { content: [{ type: 'text', text: getProOnlyMessage('Firebase rules audit') }] };
      }
      const result = await analyzeFirebase(directory, license.tier);
      return { content: [{ type: 'text', text: formatFirebaseResults(result, license.tier) }] };
    },
  );

  server.tool(
    'full_audit',
    'Run all 13 security scanners and produce a scored report (A+ to F) with an AI-ready fix prompt. 3 audits per month. [PRO]',
    { directory: z.string().describe('Absolute path to the project root directory') },
    async ({ directory }) => {
      const license = await validateLicense();
      if (license.tier !== 'pro') {
        return { content: [{ type: 'text', text: getProOnlyMessage('Full security audit') }] };
      }
      const result = await runFullAudit(directory, license.tier);
      if (typeof result === 'string') {
        return { content: [{ type: 'text', text: result }] };
      }
      return { content: [{ type: 'text', text: formatAuditReport(result) }] };
    },
  );

  logger.info('Veilguard MCP server initialized with 13 tools (10 free + 3 pro)');
  return server;
}
