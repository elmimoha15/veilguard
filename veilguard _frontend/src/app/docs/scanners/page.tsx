import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scanner Reference — 13 Security Tools',
  description: 'All 13 Veilguard scanners: secrets, RLS, webhooks, injection, CORS, supply chain, and more.',
};

export default function DocsScannersPage() {
  const scanners = [
    {
      id: 'scan_secrets',
      name: 'Secret Scanner',
      pro: false,
      desc: '60+ secret patterns. Stripe, Supabase, OpenAI, Paystack, Flutterwave, M-Pesa, AWS, Firebase, GitHub, Twilio, SendGrid, Resend, MongoDB/Postgres/Redis URIs.',
      trigger: 'After file changes',
      example: 'CRITICAL: Stripe live key in src/lib/payments.ts:14.'
    },
    {
      id: 'scan_dependencies',
      name: 'Dependency Checker',
      pro: false,
      desc: 'npm CVEs via OSV.dev API.',
      trigger: 'After package.json changes',
      example: 'WARNING: CVE-2024-34352 in next-auth@4.24.5 — upgrade to 4.24.7.'
    },
    {
      id: 'scan_webhooks',
      name: 'Webhook Verifier',
      pro: false,
      desc: 'Stripe constructEvent, Paystack HMAC, M-Pesa IP, GitHub signature.',
      trigger: 'After API route changes',
      example: 'CRITICAL: Stripe webhook missing constructEvent.'
    },
    {
      id: 'scan_injection',
      name: 'Injection Scanner',
      pro: false,
      desc: 'SQL template literals, unsanitized req.body, exec() with user input.',
      trigger: 'After route changes',
      example: 'CRITICAL: SQL injection in db.query().'
    },
    {
      id: 'check_supabase_rls',
      name: 'Supabase RLS Audit',
      pro: true,
      desc: 'Queries pg_policies. Catches: USING(true), disabled RLS, auth.role()=\'authenticated\', auth.uid() IS NOT NULL bypass, missing policies, storage bucket issues.',
      trigger: 'After DB schema changes',
      example: 'CRITICAL: Missing Row Level Security on "users" table.'
    },
    {
      id: 'check_firebase',
      name: 'Firebase Rules Audit',
      pro: true,
      desc: 'Reads rules file. Catches: if true, request.query bypass, missing auth.',
      trigger: 'After rules changes',
      example: 'WARNING: Insecure "if true" detected in Firestore rules.'
    },
    {
      id: 'full_audit',
      name: 'Full Security Audit',
      pro: true,
      desc: 'Runs all 13 scanners, generates score 0-100, assigns grade A+ to F, creates AI-ready fix prompt. (3/month context limit)',
      trigger: 'Before deploy or manual trigger',
      example: 'GRADE B-: 11 Issues Found. Run fix prompt.'
    }
  ];

  return (
    <>
      <h1 className="text-4xl font-semibold mb-4">Scanner Reference</h1>
      <p className="text-xl text-text-body mb-10">
        Review all 13 security constraints enforced by the engine. Pro scanners are marked.
      </p>

      <div className="space-y-8 not-prose">
        {scanners.map((s) => (
          <div key={s.id} className={`p-6 rounded-xl border bg-background-card ${s.pro ? 'border-accent/40 shadow-[0_0_20px_rgba(52,211,153,0.05)]' : 'border-border'}`}>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-mono text-text-heading">{s.id}</h3>
              {s.pro && <span className="bg-accent-muted text-accent border border-accent/20 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider">Pro</span>}
            </div>
            <p className="text-sm font-medium text-text-body mb-4">{s.name}</p>
            
            <div className="text-sm text-text-muted mb-4 border-l-2 border-[#334155] pl-4">
              {s.desc}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-background-code rounded-lg p-4 border border-[#334155]">
                <div className="text-xs text-text-muted mb-1 uppercase tracking-wider">Example Output</div>
                <div className="font-mono text-sm text-status-warning truncate" title={s.example}>{s.example}</div>
              </div>
              <div className="bg-background-code rounded-lg p-4 border border-[#334155]">
                <div className="text-xs text-text-muted mb-1 uppercase tracking-wider">Trigger Moment</div>
                <div className="font-mono text-sm text-text-heading">{s.trigger}</div>
              </div>
            </div>
          </div>
        ))}

        <div className="p-6 rounded-xl border border-border bg-background-card">
          <p className="text-sm text-text-muted text-center italic">
            Plus 6 more Free scanners: check_cors, check_supply_chain, check_env, check_auth_config, check_headers, check_git.
          </p>
        </div>
      </div>
    </>
  );
}
