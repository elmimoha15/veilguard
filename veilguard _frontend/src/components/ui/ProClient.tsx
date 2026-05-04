"use client";

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import FadeIn, { FadeInStagger, FadeInStaggerItem } from '@/components/ui/FadeIn';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const isSuccess = searchParams?.get('success') === 'true';
  const [isAnnual, setIsAnnual] = useState(true);

  if (isSuccess) {
    return (
      <FadeIn className="text-center max-w-2xl mx-auto mt-20">
        <div className="w-20 h-20 bg-status-secure/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-status-secure/30 shadow-[0_0_40px_rgba(52,211,153,0.3)]">
          <svg className="w-10 h-10 text-status-secure" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-4xl mb-6">You're on Veilguard Pro!</h1>
        <p className="text-lg text-text-body mb-8">
          Welcome to absolute security. Check your email for your Polar receipt and license key.
        </p>
        <div className="bg-background-code border border-border p-6 rounded-xl text-left mb-8">
          <div className="text-sm text-text-muted mb-2">1. Copy your VEILGUARD_KEY</div>
          <div className="text-sm text-text-muted mb-6">2. Add it to your IDE configuration:</div>
          <pre className="text-sm font-mono text-text-body overflow-x-auto">
{`"env": { "VEILGUARD_KEY": "vg_live_..." }`}
          </pre>
        </div>
        <a href="/docs/install" className="inline-block px-8 py-3 rounded-xl bg-accent text-[#080E12] font-semibold hover:scale-[1.02] transition-transform">
          View installation guide
        </a>
      </FadeIn>
    );
  }

  return (
    <>
      <FadeIn className="text-center mb-16">
        <h1 className="text-5xl md:text-6xl mb-6 max-w-3xl mx-auto">See everything.<br/>Fix everything.</h1>
        <p className="text-lg text-text-body max-w-2xl mx-auto">
          Free users see 3 findings per scan. Pro users see all of them — plus fixes, full audit, and breach context.
        </p>
      </FadeIn>

      <FadeIn className="flex justify-center mb-12">
        <div className="bg-background-code border border-border rounded-full p-1 flex">
          <button 
            onClick={() => setIsAnnual(false)} 
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${!isAnnual ? 'bg-background-card text-text-heading border border-border shadow-sm' : 'text-text-muted hover:text-text-heading'}`}
          >
            Monthly
          </button>
          <button 
            onClick={() => setIsAnnual(true)} 
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${isAnnual ? 'bg-background-card text-text-heading border border-border shadow-sm' : 'text-text-muted hover:text-text-heading'}`}
          >
            Annual
            <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">Save 35%</span>
          </button>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-32">
        <FadeIn delay={0.1}>
          <div className="bg-background-card border border-border rounded-2xl p-10 flex flex-col h-full hover:border-border-hover transition-colors">
            <h3 className="text-2xl font-medium text-text-heading mb-2">Monthly</h3>
            <div className="text-4xl font-semibold text-text-heading mb-2">$19<span className="text-lg text-text-muted font-normal">/mo</span></div>
            <div className="text-sm text-text-muted mb-8">Billed monthly</div>
            
            <ul className="space-y-4 mb-10 flex-grow text-text-body text-sm">
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Everything in Free</span></li>
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>All findings revealed</span></li>
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Full AI-ready fix prompts</span></li>
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Supabase RLS & Firebase audits</span></li>
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>All severities & breach context</span></li>
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Full audit report (3/month)</span></li>
            </ul>
            
            <a href="https://polar.sh/checkout/veilguard-pro-monthly" className="block text-center w-full py-3 rounded-xl border border-border text-text-heading font-medium hover:bg-background-card-hover transition-colors">
              Subscribe — $19/mo
            </a>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className={`bg-background-code border ${isAnnual ? 'border-border-active shadow-[0_0_40px_rgba(52,211,153,0.1)]' : 'border-border'} rounded-2xl p-10 flex flex-col h-full relative overflow-hidden transition-all duration-300`}>
            {isAnnual && (
              <>
                <div className="absolute top-0 right-0 bg-accent text-[#080E12] text-xs font-bold px-4 py-1 rounded-bl-lg z-10">RECOMMENDED</div>
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-accent to-transparent"></div>
              </>
            )}
            
            <h3 className="text-2xl font-medium text-text-heading mb-2">Annual</h3>
            <div className="flex items-baseline gap-2 mb-2">
              <div className="text-4xl font-semibold text-text-heading">$149<span className="text-lg text-text-muted font-normal">/yr</span></div>
            </div>
            <div className="text-sm text-text-muted mb-8">Works out to $12.42/mo (billed annually)</div>
            
            <ul className="space-y-4 mb-10 flex-grow text-text-body text-sm">
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Everything in Free</span></li>
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span className="text-[#F1F5F9] font-medium">All findings revealed</span></li>
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Full AI-ready fix prompts</span></li>
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Supabase RLS & Firebase audits</span></li>
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>All severities & breach context</span></li>
              <li className="flex items-start gap-3"><svg className="w-5 h-5 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Full audit report (3/month)</span></li>
            </ul>
            
            <a href="https://polar.sh/checkout/veilguard-pro-annual" className={`block text-center w-full py-3 rounded-xl font-semibold transition-transform ${isAnnual ? 'bg-accent text-[#080E12] hover:scale-[1.02]' : 'border border-border text-text-heading hover:bg-background-card-hover'}`}>
              Subscribe — $149/yr
            </a>
          </div>
        </FadeIn>
      </div>

      {/* Comparison Table */}
      <FadeIn className="max-w-4xl mx-auto mb-32">
        <h2 className="text-3xl mb-10 text-center">Compare features</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-4 px-6 font-medium text-text-heading w-1/2">Feature</th>
                <th className="py-4 px-6 font-medium text-text-heading w-1/4 text-center">Free</th>
                <th className="py-4 px-6 font-medium text-accent w-1/4 text-center">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { name: 'Number of scanners', free: '10', pro: '13' },
                { name: 'Findings per scan', free: 'First 3', pro: 'Unlimited' },
                { name: 'Severity covered', free: 'Critical only', pro: 'All severities' },
                { name: 'Dependency checks', free: 'Top 20 deps', pro: 'Unlimited deps' },
                { name: 'AI-ready fix prompts', free: 'Hidden', pro: 'Included' },
                { name: 'Breach context', free: 'Hidden', pro: 'Included' },
                { name: 'Supabase RLS Deep Audit', free: 'No', pro: 'Yes' },
                { name: 'Firebase Rules Audit', free: 'No', pro: 'Yes' },
                { name: 'Full scored audit report', free: 'None', pro: '3 per month' },
              ].map((row, i) => (
                <tr key={i} className="hover:bg-background-card/50 transition-colors">
                  <td className="py-4 px-6 text-text-body">{row.name}</td>
                  <td className="py-4 px-6 text-text-muted text-center align-middle">{row.free === 'No' ? '—' : row.free === 'Yes' ? <span className="text-accent inline-block">✓</span> : row.free}</td>
                  <td className="py-4 px-6 text-text-heading text-center align-middle">{row.pro === 'Yes' ? <span className="text-accent inline-block">✓</span> : row.pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FadeIn>

      {/* FAQ */}
      <FadeIn className="max-w-3xl mx-auto mb-20">
        <h2 className="text-3xl mb-10 text-center">Frequently asked questions</h2>
        <div className="space-y-4 text-left">
          {[
            { q: "How does the license key work?", a: "After subscribing, you'll receive a VEILGUARD_KEY via email. Simply add this to your MCP configuration's env mapping as detailed in the installation docs." },
            { q: "What if I cancel?", a: "You will retain your Pro license until the end of your billing cycle. Afterwards, Veilguard will automatically downgrade to the Free tier functionality." },
            { q: "Can I use it on multiple projects?", a: "Yes, currently the license is per user rather per project. One license covers your personal projects on a single machine." },
            { q: "What happens if I exceed 3 audits/month?", a: "The Full Audit scanner is limited to 3 runs per month to save computational cost. All other scanners continue to run unlimited." },
            { q: "Are you open source?", a: "The Veilguard CLI and core scanners are source-available, allowing you to verify what runs on your machine. The backend grading and telemetry parsing are proprietary." }
          ].map((faq, i) => (
            <details key={i} className="group bg-background-card border border-border rounded-xl mb-4 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
              <summary className="px-6 py-4 font-medium text-text-heading cursor-pointer flex justify-between items-center outline-none">
                {faq.q}
                <span className="transition group-open:rotate-180">
                  <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
                </span>
              </summary>
              <div className="px-6 pb-4 pt-2 text-text-body text-sm leading-relaxed border-t border-border/50">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </FadeIn>
    </>
  );
}

export default function ProClient() {
  return (
    <Suspense fallback={<div className="h-96 flex items-center justify-center">Loading...</div>}>
      <CheckoutContent />
    </Suspense>
  );
}
