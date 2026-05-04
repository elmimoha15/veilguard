"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IDE_TABS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'windsurf', label: 'Windsurf' },
  { id: 'vscode', label: 'VS Code' },
  { id: 'jetbrains', label: 'JetBrains' },
  { id: 'antigravity', label: 'Antigravity' }
];

const IDE_PATHS: Record<string, string> = {
  claude: '.claude/mcp.json (also: claude mcp add veilguard -- npx -y @veilguard/cli)',
  cursor: '.cursor/mcp.json',
  windsurf: '~/.windsurf/mcp.json',
  vscode: '.vscode/mcp.json',
  jetbrains: 'Settings → Tools → MCP Server',
  antigravity: 'MCP Settings Panel'
};

const JSON_CONFIG = `{
  "mcpServers": {
    "veilguard": {
      "command": "npx",
      "args": ["-y", "@veilguard/cli"],
      "env": { "VEILGUARD_KEY": "your_key_here" }
    }
  }
}`;

export default function IDEInstallTabs() {
  const [activeTab, setActiveTab] = useState('claude');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON_CONFIG);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-12 bg-background-card border border-border rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.5)]">
      <div className="flex overflow-x-auto hide-scrollbar border-b border-border">
        {IDE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap transition-colors relative ${activeTab === tab.id ? 'text-text-heading' : 'text-text-muted hover:text-text-body'}`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="activeTabBadge" 
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" 
              />
            )}
          </button>
        ))}
      </div>
      
      <div className="p-6 md:p-8 bg-background-code relative">
        <div className="mb-4 text-sm font-mono text-text-muted">
          Path: <span className="text-accent">{IDE_PATHS[activeTab]}</span>
        </div>
        
        <div className="relative group">
          <pre className="text-sm font-mono text-text-body overflow-x-auto p-4 rounded-xl border border-border/50 bg-[#04080A]">
            <code>{JSON_CONFIG}</code>
          </pre>
          <button 
            onClick={handleCopy}
            className="absolute top-3 right-3 p-2 bg-background-card rounded-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background-card-hover text-text-muted hover:text-text-heading"
          >
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-status-secure"><polyline points="20 6 9 17 4 12"></polyline></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            )}
          </button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="text-sm text-text-body">
            Or auto-detect everything:
            <code className="ml-2 font-mono text-accent bg-accent-muted px-2 py-1 rounded">npx @veilguard/cli init</code>
          </div>
          <div className="text-[12px] text-text-muted">
            Free: leave VEILGUARD_KEY empty. Pro: paste key from email.
          </div>
        </div>
      </div>
    </div>
  );
}
