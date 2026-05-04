import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Docs — Install, Setup & Scanner Reference',
  description: 'Install Veilguard in Claude Code, Cursor, Windsurf, VS Code, JetBrains. Full scanner docs.',
};

export default function DocsOverviewPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold mb-4">Documentation Hub</h1>
      <p className="text-xl text-text-body mb-12">
        Learn how to install Veilguard, configure your scanners, and understand the secure-by-default features of the platform.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 not-prose">
        <Link href="/docs/install" className="block p-6 bg-background-card border border-border rounded-xl hover:border-border-hover transition-colors">
          <h3 className="text-lg font-medium text-text-heading mb-2">Installation</h3>
          <p className="text-sm text-text-muted">Per-IDE setup for Claude Code, Cursor, Windsurf, VS Code, and JetBrains.</p>
        </Link>
        <Link href="/docs/scanners" className="block p-6 bg-background-card border border-border rounded-xl hover:border-border-hover transition-colors">
          <h3 className="text-lg font-medium text-text-heading mb-2">Scanner Reference</h3>
          <p className="text-sm text-text-muted">All 13 scanners explained, including Secret Scanning, Webhook Verification, and RLS.</p>
        </Link>
        <Link href="/docs/autoscan" className="block p-6 bg-background-card border border-border rounded-xl hover:border-border-hover transition-colors">
          <h3 className="text-lg font-medium text-text-heading mb-2">Auto-Scan Triggers</h3>
          <p className="text-sm text-text-muted">How Veilguard knows exactly when to scan your changes automatically.</p>
        </Link>
        <Link href="/docs/scoring" className="block p-6 bg-background-card border border-border rounded-xl hover:border-border-hover transition-colors">
          <h3 className="text-lg font-medium text-text-heading mb-2">Security Scoring</h3>
          <p className="text-sm text-text-muted">How the Pre-Deploy audit grades your project from A+ to F.</p>
        </Link>
        <Link href="/docs/fintech" className="block p-6 bg-background-card border border-border rounded-xl hover:border-border-hover transition-colors">
          <h3 className="text-lg font-medium text-text-heading mb-2">African Fintech Security</h3>
          <p className="text-sm text-text-muted">Specialized patterns for Paystack, Flutterwave, and M-Pesa integrators.</p>
        </Link>
        <Link href="/docs/faq" className="block p-6 bg-background-card border border-border rounded-xl hover:border-border-hover transition-colors">
          <h3 className="text-lg font-medium text-text-heading mb-2">FAQ & Troubleshooting</h3>
          <p className="text-sm text-text-muted">Common issues, license keys, and false positives.</p>
        </Link>
      </div>
    </>
  );
}
