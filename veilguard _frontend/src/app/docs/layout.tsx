import { ReactNode } from 'react';
import Link from 'next/link';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[1200px] mx-auto px-6 md:px-12 lg:px-16 pt-[100px] pb-[140px] flex flex-col md:flex-row gap-12">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 shrink-0 md:sticky md:top-24 h-max py-4 border-r border-border pr-6">
        <h3 className="text-sm font-semibold text-text-heading mb-4 tracking-wider uppercase">Documentation</h3>
        <ul className="space-y-3 text-sm">
          <li>
            <Link href="/docs" className="text-text-muted hover:text-text-heading transition-colors block">
              Overview
            </Link>
          </li>
          <li>
            <Link href="/docs/install" className="text-text-muted hover:text-text-heading transition-colors block">
              Installation Guide
            </Link>
          </li>
          <li>
            <Link href="/docs/scanners" className="text-text-muted hover:text-text-heading transition-colors block">
              Scanner Reference
            </Link>
          </li>
          <li>
            <Link href="/docs/autoscan" className="text-text-muted hover:text-text-heading transition-colors block">
              Auto-Scan Triggers
            </Link>
          </li>
          <li>
            <Link href="/docs/scoring" className="text-text-muted hover:text-text-heading transition-colors block">
              Security Scoring
            </Link>
          </li>
          <li>
            <Link href="/docs/fintech" className="text-text-muted hover:text-text-heading transition-colors block">
              African Fintech Security
            </Link>
          </li>
          <li>
            <Link href="/docs/faq" className="text-text-muted hover:text-text-heading transition-colors block">
              FAQ & Troubleshooting
            </Link>
          </li>
        </ul>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 prose prose-invert prose-headings:text-text-heading prose-a:text-accent hover:prose-a:text-accent-hover prose-p:text-text-body prose-li:text-text-body max-w-none">
        {children}
      </main>
    </div>
  );
}
