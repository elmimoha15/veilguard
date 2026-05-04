import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Security Scoring — A+ to F',
  description: 'How Veilguard grades your project. Score calculation, grade meanings, audit reports.',
};

export default function DocsScoringPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold mb-4">Security Scoring</h1>
      <p className="text-xl text-text-body mb-10">
        When triggering a <code className="text-accent bg-accent-muted px-1.5 py-0.5 rounded ml-1 text-base">full_audit</code> (Pro users), Veilguard evaluates your codebase and applies a strict penalty-based scoring model.
      </p>

      <h2 className="text-2xl font-medium mt-10 mb-4 border-b border-border pb-2">Calculation Model</h2>
      <p className="text-text-body mb-4">
        Every project begins with a perfect score of <strong>100</strong>. Penalties are deducted based on severity:
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 not-prose mb-12">
        <div className="p-6 bg-background-card border-l-4 border-status-critical rounded-r-xl">
          <div className="text-status-critical font-bold text-2xl mb-1">-15</div>
          <div className="text-sm font-medium text-text-heading">Critical</div>
          <div className="text-xs text-text-muted mt-2">Leaked secrets, injections, broken RLS.</div>
        </div>
        <div className="p-6 bg-background-card border-l-4 border-status-warning rounded-r-xl">
          <div className="text-status-warning font-bold text-2xl mb-1">-5</div>
          <div className="text-sm font-medium text-text-heading">Warning</div>
          <div className="text-xs text-text-muted mt-2">Missing hooks, open CORS, old CVEs.</div>
        </div>
        <div className="p-6 bg-background-card border-l-4 border-status-info rounded-r-xl">
          <div className="text-status-info font-bold text-2xl mb-1">-1</div>
          <div className="text-sm font-medium text-text-heading">Info</div>
          <div className="text-xs text-text-muted mt-2">Missing CSP headers, messy .env patterns.</div>
        </div>
      </div>

      <h2 className="text-2xl font-medium mt-10 mb-4 border-b border-border pb-2">Grades Overview</h2>
      <div className="overflow-x-auto not-prose">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-text-muted bg-background-code">
              <th className="py-3 px-4 font-medium w-1/4">Score</th>
              <th className="py-3 px-4 font-medium w-1/4">Grade</th>
              <th className="py-3 px-4 font-medium w-1/2">Meaning</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="hover:bg-background-card/50">
              <td className="py-3 px-4 text-text-body">95 - 100</td>
              <td className="py-3 px-4 font-bold text-status-secure text-lg">A+ to A-</td>
              <td className="py-3 px-4 text-text-muted">Production ready. Virtually impenetrable context.</td>
            </tr>
            <tr className="hover:bg-background-card/50">
              <td className="py-3 px-4 text-text-body">80 - 94</td>
              <td className="py-3 px-4 font-bold text-accent text-lg">B+ to B-</td>
              <td className="py-3 px-4 text-text-muted">Safe, but has structural weaknesses (e.g., loose CORS).</td>
            </tr>
            <tr className="hover:bg-background-card/50">
              <td className="py-3 px-4 text-text-body">60 - 79</td>
              <td className="py-3 px-4 font-bold text-status-warning text-lg">C+ to D-</td>
              <td className="py-3 px-4 text-text-muted">Do not deploy. Severe warnings accumulation.</td>
            </tr>
            <tr className="hover:bg-background-card/50">
              <td className="py-3 px-4 text-text-body">0 - 59</td>
              <td className="py-3 px-4 font-bold text-status-critical text-lg">F</td>
              <td className="py-3 px-4 text-text-muted">Immediate breach risk. Secrets leaked or RLS entirely broken.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
