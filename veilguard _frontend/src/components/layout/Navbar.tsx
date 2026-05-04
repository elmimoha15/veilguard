"use client";

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#080E12]/85 backdrop-blur-xl border-b border-[#94A3B8]/10 transition-all">
        <nav className="max-w-[1200px] mx-auto px-6 md:px-12 lg:px-16 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 relative z-50">
            {/* Custom Minimal Shield SVG */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#34D399]">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v4" />
              <path d="M12 16h.01" />
            </svg>
            <span className="font-semibold text-[#F1F5F9] text-lg tracking-tight">veilguard</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/#how-it-works" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition-colors">How it works</Link>
            <Link href="/#features" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition-colors">Features</Link>
            <Link href="/#pricing" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition-colors">Pricing</Link>
            <Link href="/docs" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition-colors">Docs</Link>
          </div>

          <div className="hidden md:flex items-center gap-6">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#94A3B8] hover:text-[#F1F5F9] transition-colors flex items-center gap-1">
              GitHub <span className="text-[10px]">↗</span>
            </a>
            <Link href="/#install" className="text-sm font-medium bg-[#34D399] text-[#080E12] px-5 py-2 rounded-xl hover:scale-[1.02] transition-transform duration-150">
              Get started
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button 
            className="md:hidden relative z-50 text-[#F1F5F9] p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {mobileMenuOpen ? (
                <>
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </>
              ) : (
                <>
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </>
              )}
            </svg>
          </button>
        </nav>
      </header>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-[#080E12]/95 backdrop-blur-2xl px-6 pt-24 pb-6 flex flex-col md:hidden"
          >
            <div className="flex flex-col gap-6 text-lg">
              <Link href="/#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-[#F1F5F9] font-medium border-b border-[#334155] pb-4">How it works</Link>
              <Link href="/#features" onClick={() => setMobileMenuOpen(false)} className="text-[#F1F5F9] font-medium border-b border-[#334155] pb-4">Features</Link>
              <Link href="/#pricing" onClick={() => setMobileMenuOpen(false)} className="text-[#F1F5F9] font-medium border-b border-[#334155] pb-4">Pricing</Link>
              <Link href="/docs" onClick={() => setMobileMenuOpen(false)} className="text-[#F1F5F9] font-medium border-b border-[#334155] pb-4">Docs</Link>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[#F1F5F9] font-medium border-b border-[#334155] pb-4">GitHub ↗</a>
            </div>
            <div className="mt-auto">
              <Link href="/#install" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center bg-[#34D399] text-[#080E12] px-6 py-4 rounded-xl font-medium tracking-wide">
                Get started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
