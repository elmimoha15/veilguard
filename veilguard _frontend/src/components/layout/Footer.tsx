import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-[#060C10] border-t border-[#94A3B8]/10 pt-20 pb-10">
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 lg:px-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#34D399]">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
              <span className="font-semibold text-[#F1F5F9] text-lg tracking-tight">veilguard</span>
            </Link>
            <p className="text-[#94A3B8] text-sm leading-relaxed max-w-xs">
              Silent security layer for your AI coding agent. Catch vulnerabilities as you vibe.
            </p>
          </div>
          
          <div>
            <h4 className="text-[#F1F5F9] font-medium mb-4 text-sm tracking-wide">Product</h4>
            <ul className="space-y-3">
              <li><Link href="/#how-it-works" className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors">How it works</Link></li>
              <li><Link href="/#features" className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors">Features</Link></li>
              <li><Link href="/#pricing" className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors">Pricing</Link></li>
              <li><span className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors cursor-pointer">Changelog</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[#F1F5F9] font-medium mb-4 text-sm tracking-wide">Resources</h4>
            <ul className="space-y-3">
              <li><a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors">GitHub</a></li>
              <li><a href="https://npmjs.com" target="_blank" rel="noopener noreferrer" className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors">npm</a></li>
              <li><Link href="/docs" className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors">Docs</Link></li>
              <li><a href="#" className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors">MCP Registry</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-[#F1F5F9] font-medium mb-4 text-sm tracking-wide">Legal</h4>
            <ul className="space-y-3">
              <li><span className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors cursor-pointer">Privacy</span></li>
              <li><span className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors cursor-pointer">Terms</span></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-[#94A3B8]/10 text-sm text-[#475569]">
          <p>© 2026 Veilguard. Made in Nairobi 🇰🇪</p>
          <div className="flex items-center gap-4 mt-4 md:mt-0">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#F1F5F9] transition-colors" aria-label="GitHub">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
            </a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#F1F5F9] transition-colors" aria-label="X (Twitter)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l11.733 16h4.267l-11.733 -16z"></path><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
