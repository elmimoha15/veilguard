import Link from 'next/link';
import FadeIn, { FadeInStagger, FadeInStaggerItem } from '@/components/ui/FadeIn';
import TerminalMockup from '@/components/ui/TerminalMockup';
import IDEInstallTabs from '@/components/ui/IDEInstallTabs';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Veilguard — Silent Security for Vibe Coders',
  description: 'Security that watches while you vibe. MCP scanner for Claude Code, Cursor, Windsurf, VS Code. Free.',
};

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative pt-[140px] pb-[100px] px-6 md:px-12 lg:px-16 max-w-[1200px] mx-auto text-center flex flex-col items-center justify-center">
        {/* Radial Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-accent-glow rounded-full blur-[120px] opacity-60 pointer-events-none -z-10"></div>
        
        <FadeIn delay={0}>
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-muted border border-accent/20">
            <div className="w-2h-2 h-2 w-2 rounded-full bg-accent animate-pulse"></div>
            <span className="text-sm font-medium text-accent">Now in public beta</span>
          </div>
        </FadeIn>
        
        <FadeIn delay={0.1}>
          <h1 className="max-w-4xl mx-auto mb-6 text-text-heading">
            Vibe without worry.
          </h1>
        </FadeIn>
        
        <FadeIn delay={0.2}>
          <p className="max-w-2xl mx-auto text-text-body text-lg md:text-xl mb-12">
            Veilguard is a silent security layer for your AI coding agent. It catches leaked secrets, broken database policies, and auth vulnerabilities — automatically, as you code. You never run a scan. You never read a report. You just vibe.
          </p>
        </FadeIn>
        
        <FadeIn delay={0.3}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 w-full sm:w-auto">
            <Link href="#install" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-accent text-[#080E12] font-semibold hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(52,211,153,0.3)]">
              Get started — it's free
            </Link>
            <Link href="/docs" className="w-full sm:w-auto px-8 py-4 rounded-xl border border-border text-text-heading hover:bg-background-card-hover font-medium transition-colors">
              Read the docs
            </Link>
          </div>
          <div className="text-sm text-text-muted">
            Works in Claude Code · Cursor · Windsurf · VS Code · JetBrains · Antigravity
          </div>
        </FadeIn>

        <FadeIn delay={0.6} className="w-full mt-20">
          <TerminalMockup />
        </FadeIn>
      </section>

      {/* Problem Stats Section */}
      <section className="py-[140px] px-6 md:px-12 lg:px-16 max-w-[1200px] mx-auto border-t border-border">
        <FadeIn>
          <div className="mb-4 caption text-accent">THE PROBLEM</div>
          <h2 className="mb-16 max-w-2xl">Your AI writes fast. It doesn't write safe.</h2>
        </FadeIn>
        
        <FadeInStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FadeInStaggerItem className="bg-background-card border border-border rounded-2xl p-8 hover:border-border-hover transition-colors">
            <div className="text-5xl font-semibold text-text-heading mb-4">196<span className="text-3xl text-text-muted">/198</span></div>
            <div className="text-sm text-text-body mb-6 min-h-[40px]">vibe-coded apps with vulnerabilities</div>
            <div className="text-xs text-text-muted">PainIndex</div>
          </FadeInStaggerItem>
          
          <FadeInStaggerItem className="bg-background-card border border-border rounded-2xl p-8 hover:border-border-hover transition-colors">
            <div className="text-5xl font-semibold text-text-heading mb-4">45%</div>
            <div className="text-sm text-text-body mb-6 min-h-[40px]">of AI code has OWASP Top 10 flaws</div>
            <div className="text-xs text-text-muted">Veracode 2025</div>
          </FadeInStaggerItem>
          
          <FadeInStaggerItem className="bg-background-card border border-border rounded-2xl p-8 hover:border-status-critical/50 transition-colors relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#EF4444]/50 to-transparent opacity-50"></div>
            <div className="text-5xl font-semibold text-status-critical mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">322%</div>
            <div className="text-sm text-text-body mb-6 min-h-[40px]">surge in hardcoded secrets</div>
            <div className="text-xs text-text-muted">GitGuardian 2026</div>
          </FadeInStaggerItem>
          
          <FadeInStaggerItem className="bg-background-card border border-border rounded-2xl p-8 hover:border-border-hover transition-colors">
            <div className="text-5xl font-semibold text-text-heading mb-4">2.74×</div>
            <div className="text-sm text-text-body mb-6 min-h-[40px]">more security issues vs human code</div>
            <div className="text-xs text-text-muted">CodeRabbit</div>
          </FadeInStaggerItem>
        </FadeInStagger>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-[140px] px-6 md:px-12 lg:px-16 max-w-[1200px] mx-auto border-t border-border">
        <FadeIn>
          <div className="mb-4 caption text-accent">HOW IT WORKS</div>
          <h2 className="mb-16 max-w-2xl">Three layers. Zero interruptions.</h2>
        </FadeIn>
        
        <FadeInStagger className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FadeInStaggerItem className="bg-background-card border border-border rounded-2xl p-8 flex flex-col h-full hover:-translate-y-1 transition-transform duration-300">
            <div className="mb-6 inline-block px-3 py-1 rounded bg-background text-text-muted text-xs font-medium border border-border">FREE</div>
            <h3 className="text-xl font-medium text-text-heading mb-4">Security-Aware AI</h3>
            <p className="text-text-body text-base flex-grow mb-8">
              Veilguard installs a rules file (.cursorrules, CLAUDE.md) that teaches your AI to write secure code from the start. No missing RLS, no hardcoded keys.
            </p>
            <div className="text-xs text-text-muted tracking-wider uppercase">CLAUDE.MD · .CURSORRULES · .WINDSURFRULES</div>
          </FadeInStaggerItem>

          <FadeInStaggerItem className="bg-background-card-hover border border-border-active rounded-2xl p-8 flex flex-col h-full -translate-y-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)] relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent"></div>
            <div className="absolute -top-[100px] left-1/2 -translate-x-1/2 w-full h-[150px] bg-accent-glow rounded-full blur-[60px] pointer-events-none"></div>
            
            <div className="mb-6 inline-block px-3 py-1 rounded bg-accent-muted text-accent border border-accent/20 text-xs font-medium">FREE</div>
            <h3 className="text-xl font-medium text-text-heading mb-4 relative z-10">Always-On Scanning</h3>
            <p className="text-text-body text-base flex-grow mb-8 relative z-10">
              Your AI agent calls 13 security scanners automatically — after file changes, before deploys, when you touch databases or routes. Clean = silence. Issue = calm nudge.
            </p>
            <div className="text-xs text-text-muted tracking-wider uppercase relative z-10">13 SCANNERS · AUTO-TRIGGERED</div>
          </FadeInStaggerItem>

          <FadeInStaggerItem className="bg-background-card border border-border rounded-2xl p-8 flex flex-col h-full hover:-translate-y-1 transition-transform duration-300">
            <div className="mb-6 inline-block px-3 py-1 rounded bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 text-xs font-medium">PRO $19/MO</div>
            <h3 className="text-xl font-medium text-text-heading mb-4">Pre-Deploy Audit</h3>
            <p className="text-text-body text-base flex-grow mb-8">
              Full security audit. Grade A+ to F. AI-ready fix prompt that patches everything at once. Supabase RLS deep audit and Firebase rules included.
            </p>
            <div className="text-xs text-text-muted tracking-wider uppercase">SCORED REPORT · 3/MONTH</div>
          </FadeInStaggerItem>
        </FadeInStagger>
      </section>

      {/* Feature Deep-Dives */}
      <section id="features" className="py-[140px] overflow-hidden border-t border-border">
        <div className="max-w-[1200px] mx-auto px-6 md:px-12 lg:px-16">
          
          {/* Row 1 */}
          <div className="flex flex-col lg:flex-row items-center gap-16 mb-[160px]">
            <FadeIn direction="right" className="lg:w-1/2 order-2 lg:order-1">
              <div className="mb-4 caption text-accent">SECRET SCANNING</div>
              <h3 className="mb-6 text-4xl">60+ patterns. Zero leaks.</h3>
              <p className="text-lg text-text-body mb-6">
                Native support for modern stacks. We detect live keys for Stripe, Supabase, OpenAI, Paystack, Flutterwave, M-Pesa, AWS, and MongoDB/Postgres URIs.
              </p>
              <p className="text-text-muted">
                Every file modification is checked in milliseconds. Before the commit even happens.
              </p>
            </FadeIn>
            <FadeIn direction="left" className="lg:w-1/2 w-full order-1 lg:order-2">
              <div className="bg-background-code rounded-2xl border border-border p-6 shadow-2xl relative">
                <div className="absolute top-0 right-10 w-[200px] h-[1px] bg-gradient-to-r from-transparent via-[#EF4444] to-transparent"></div>
                <div className="font-mono text-sm space-y-4">
                  <div className="text-status-critical flex gap-3">
                    <span className="shrink-0">[CRITICAL]</span>
                    <span className="text-[#94A3B8]">Stripe live key detected in <span className="text-[#F1F5F9]">src/lib/payments.ts:14</span></span>
                  </div>
                  <div className="text-text-muted">{'  '}Found: sk_live_51M******************</div>
                  <div className="text-status-warning flex gap-3 mt-6">
                    <span className="shrink-0">[WARNING]</span>
                    <span className="text-[#94A3B8]">Supabase service role key in <span className="text-[#F1F5F9]">.env.local</span> does not match standard ignore patterns.</span>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Row 2 */}
          <div className="flex flex-col lg:flex-row items-center gap-16 mb-[160px]">
            <FadeIn direction="right" className="lg:w-1/2 w-full">
              <div className="bg-background-code rounded-2xl border border-border p-6 shadow-2xl">
                <div className="absolute top-0 left-10 w-[200px] h-[1px] bg-gradient-to-r from-transparent via-status-secure to-transparent"></div>
                <div className="font-mono text-sm">
                  <div className="mb-4 text-text-muted">// Before: AI hallucinated policy</div>
                  <div className="text-[#EF4444] bg-[#EF4444]/10 p-2 rounded mb-6">
                    CREATE POLICY "Users can update" ON users<br/>
                    FOR UPDATE USING (<span className="font-bold underline">auth.uid() IS NOT NULL</span>);
                  </div>
                  <div className="mb-4 text-text-muted">// After: Veilguard fix applied</div>
                  <div className="text-status-secure bg-status-secure/10 p-2 rounded">
                    CREATE POLICY "Users can update" ON users<br/>
                    FOR UPDATE USING (<span className="font-bold underline">auth.uid() = id</span>);
                  </div>
                </div>
              </div>
            </FadeIn>
            <FadeIn direction="left" className="lg:w-1/2">
              <div className="mb-4 caption text-accent">SUPABASE SECURITY</div>
              <h3 className="mb-6 text-4xl">Catches the flaws behind real breaches.</h3>
              <p className="text-lg text-text-body mb-6">
                AI coding tools frequently hallucinate insecure Row Level Security (RLS) policies. <br/><code className="text-sm bg-background-card px-2 py-1 rounded">auth.uid() IS NOT NULL</code> is not the same as ownership.
              </p>
              <div className="mt-8 border-l-2 border-[#EF4444] pl-6 py-2">
                <p className="text-sm italic text-text-muted uppercase tracking-wide mb-1">Breach Context</p>
                <p className="text-sm text-[#F1F5F9]">This exact flaw caused the Moltbook breach in 2025, leading to 1.5M tokens leaked.</p>
              </div>
            </FadeIn>
          </div>

          {/* Row 3 */}
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <FadeIn direction="right" className="lg:w-1/2 order-2 lg:order-1">
              <div className="mb-4 caption text-accent">WEBHOOK SECURITY</div>
              <h3 className="mb-6 text-4xl">Unverified webhooks = free money for attackers.</h3>
              <p className="text-lg text-text-body mb-6">
                AI will happily write a Stripe webhook handler without <code className="text-sm">constructEvent</code>, or handle M-Pesa callbacks without IP validation. Veilguard ensures financial endpoints are cryptographically secure.
              </p>
            </FadeIn>
            <FadeIn direction="left" className="lg:w-1/2 w-full order-1 lg:order-2">
              <div className="bg-background-code rounded-2xl border border-border p-6 shadow-2xl relative">
                <div className="absolute top-0 right-10 w-[200px] h-[1px] bg-gradient-to-r from-transparent via-[#F59E0B] to-transparent"></div>
                <div className="font-mono text-sm space-y-4">
                  <div className="text-status-critical flex gap-3">
                    <span className="shrink-0">[CRITICAL]</span>
                    <span className="text-[#94A3B8]">Stripe webhook in <span className="text-[#F1F5F9]">app/api/webhooks/route.ts</span> missing constructEvent verification.</span>
                  </div>
                  <div className="text-status-warning flex gap-3 mt-6">
                    <span className="shrink-0">[WARNING]</span>
                    <span className="text-[#94A3B8]">M-Pesa callback handler lacks IP allowlist validation.</span>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

        </div>
      </section>

      {/* Scanner Grid */}
      <section className="py-[140px] px-6 md:px-12 lg:px-16 max-w-[1200px] mx-auto border-t border-border">
        <FadeIn>
          <div className="mb-4 caption text-accent">WHAT VEILGUARD CATCHES</div>
          <h2 className="mb-16 max-w-2xl">13 scanners. Every vulnerability AI introduces.</h2>
        </FadeIn>
        
        <FadeInStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { name: "Secret Scanner", desc: "60+ patterns. Stripe, Supabase, OpenAI, Paystack, and more.", pro: false },
            { name: "Dependency Checker", desc: "Checks npm CVEs instantly via OSV.dev API.", pro: false },
            { name: "Webhook Verifier", desc: "Ensures financial constructEvents and HMACs are present.", pro: false },
            { name: "Injection Scanner", desc: "Catches SQL template literals and unsanitized execs.", pro: false },
            { name: "CORS Checker", desc: "Blocks wildcard access-control-allow-origin.", pro: false },
            { name: "Supply Chain Checker", desc: "Flags known-malicious packages and typosquats.", pro: false },
            { name: "Env Checker", desc: "Prevents NEXT_PUBLIC_ misuse and .env tracking.", pro: false },
            { name: "Auth Config Checker", desc: "Verifies Clerk/NextAuth/Supabase configurations.", pro: false },
            { name: "Header Checker", desc: "Ensures CSP, HSTS, and X-Content-Type-Options are set.", pro: false },
            { name: "Git Security", desc: "Prevents secret commits to git history.", pro: false },
            { name: "Supabase RLS Audit", desc: "Catches USING(true) and disabled RLS bypasses.", pro: true },
            { name: "Firebase Rules Audit", desc: "Catches 'if true' and request.query bypasses.", pro: true },
            { name: "Full Security Audit", desc: "Scores your repo A+ to F with AI-ready fix prompts.", pro: true },
          ].map((scanner, i) => (
            <FadeInStaggerItem key={i} className={`p-6 rounded-xl border bg-background-card flex flex-col h-full hover:-translate-y-1 transition-transform ${scanner.pro ? 'border-accent/50 shadow-[0_0_15px_rgba(52,211,153,0.1)]' : 'border-border'}`}>
              <div className="flex items-center gap-3 mb-3">
                <svg className={`w-5 h-5 shrink-0 ${scanner.pro ? 'text-accent' : 'text-text-heading'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3 className="font-medium text-text-heading">{scanner.name}</h3>
                {scanner.pro && <span className="ml-auto bg-accent-muted text-accent border border-accent/20 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider">Pro</span>}
              </div>
              <p className="text-sm text-text-body">{scanner.desc}</p>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </section>

      {/* Real Breaches */}
      <section className="py-[140px] px-6 md:px-12 lg:px-16 max-w-[1200px] mx-auto border-t border-border">
        <FadeIn>
          <div className="mb-4 caption text-accent">REAL BREACHES</div>
          <h2 className="mb-16 max-w-2xl">These aren't hypothetical.</h2>
        </FadeIn>
        
        <FadeInStagger className="space-y-4">
          {[
            { name: "Moltbook", year: "2025", impact: "1.5M tokens leaked", flaw: "Broken Supabase RLS", tools: "check_supabase_rls" },
            { name: "Lovable", year: "2025", impact: "CVE-2025-48757", flaw: "Unsanitized API route", tools: "scan_injection" },
            { name: "Tea App", year: "2025", impact: "72K images exposed", flaw: "Misconfigured Storage Bucket", tools: "check_supabase_rls" },
            { name: "CurXecute", year: "2025", impact: "Remote Code Execution", flaw: "Supply Chain Malicious Dep", tools: "check_supply_chain" },
            { name: "Flutterwave", year: "2024", impact: "₦11B unauthorized transfers", flaw: "Webhook bypass", tools: "scan_webhooks" },
          ].map((breach, i) => (
            <FadeInStaggerItem key={i} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-background-card rounded-xl border border-border group hover:border-border-hover transition-colors">
              <div className="mb-4 md:mb-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-lg font-medium text-text-heading">{breach.name}</span>
                  <span className="text-xs text-text-muted bg-background px-2 py-0.5 rounded">{breach.year}</span>
                </div>
                <div className="text-[#EF4444] text-sm font-medium">{breach.impact}</div>
              </div>
              <div className="bg-[#080E12] border border-[#334155] rounded-lg px-4 py-3 text-sm text-text-body md:text-right">
                Veilguard catches this with: <span className="text-accent font-mono ml-1">{breach.tools}</span>
              </div>
            </FadeInStaggerItem>
          ))}
        </FadeInStagger>
      </section>

      {/* IDE Install */}
      <section id="install" className="py-[140px] px-6 md:px-12 lg:px-16 max-w-[1200px] mx-auto border-t border-border">
        <FadeIn className="text-center">
          <div className="mb-4 caption text-accent">INSTALLATION</div>
          <h2 className="mb-8 max-w-2xl mx-auto">One command. Every IDE.</h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <IDEInstallTabs />
        </FadeIn>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-[140px] px-6 md:px-12 lg:px-16 max-w-[1200px] mx-auto border-t border-border">
        <FadeIn className="text-center">
          <div className="mb-4 caption text-accent">PRICING</div>
          <h2 className="mb-16 max-w-2xl mx-auto">Free forever. Pro when you're ready.</h2>
        </FadeIn>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <FadeIn direction="up" delay={0.1}>
            <div className="bg-background-card border border-border rounded-2xl p-10 flex flex-col h-full hover:border-border-hover transition-colors">
              <h3 className="text-2xl font-medium text-text-heading mb-2">Free</h3>
              <div className="text-4xl font-semibold text-text-heading mb-8">$0<span className="text-lg text-text-muted font-normal">/mo</span></div>
              
              <ul className="space-y-4 mb-10 flex-grow text-text-body text-sm">
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>All 13 security scanners</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>First 3 findings per scan</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Critical CVEs only</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Top 20 dependencies scanned</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-[#475569] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg><span className="text-[#475569]">Fix suggestions hidden on critical vulnerabilities</span></li>
              </ul>
              
              <Link href="#install" className="block text-center w-full py-3 rounded-xl border border-border text-text-heading font-medium hover:bg-background-card-hover transition-colors">
                Get started
              </Link>
            </div>
          </FadeIn>

          <FadeIn direction="up" delay={0.2}>
            <div className="bg-background-code border border-border-active rounded-2xl p-10 flex flex-col h-full relative overflow-hidden shadow-[0_0_40px_rgba(52,211,153,0.1)]">
              <div className="absolute top-0 right-0 bg-accent text-[#080E12] text-xs font-bold px-4 py-1 rounded-bl-lg">RECOMMENDED</div>
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent"></div>
              
              <h3 className="text-2xl font-medium text-text-heading mb-2">Pro</h3>
              <div className="text-4xl font-semibold text-text-heading mb-8">$19<span className="text-lg text-text-muted font-normal">/mo</span></div>
              
              <ul className="space-y-4 mb-10 flex-grow text-text-body text-sm">
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Everything in Free</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-[#F1F5F9] font-medium">All findings revealed</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Full AI-ready fix prompts</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Supabase RLS & Firebase deep audits</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>All severities & breach context</span></li>
                <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Full audit report (3/month)</span></li>
              </ul>
              
              <Link href="/pro" className="block text-center w-full py-3 rounded-xl bg-accent text-[#080E12] font-semibold hover:scale-[1.02] transition-transform">
                Go Pro
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-[200px] px-6 text-center border-t border-border overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-glow rounded-full blur-[100px] pointer-events-none -z-10"></div>
        <FadeIn>
          <h2 className="mb-10 text-4xl md:text-5xl">Stop worrying.<br/>Start vibing safely.</h2>
          <div className="inline-block bg-background-code border border-border px-6 py-4 rounded-xl font-mono text-sm mb-10 shadow-2xl relative group">
            <span className="text-accent mr-2">npx</span>@veilguard/cli init
            <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="#install" className="w-full sm:w-auto px-8 py-3 rounded-xl bg-background-card border border-border text-text-heading hover:bg-background-card-hover font-medium transition-colors cursor-pointer">
              Get started — free
            </Link>
            <Link href="/pro" className="w-full sm:w-auto px-8 py-3 rounded-xl bg-accent text-[#080E12] font-semibold hover:scale-[1.02] transition-transform">
              Go Pro — $19/mo
            </Link>
          </div>
        </FadeIn>
      </section>
    </>
  );
}
