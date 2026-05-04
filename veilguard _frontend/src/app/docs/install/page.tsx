import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Installation Guide — Every IDE',
  description: 'Set up Veilguard in Claude Code, Cursor, Windsurf, VS Code, JetBrains, Antigravity. One command.',
};

export default function DocsInstallPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold mb-4">Installation Guide</h1>
      <p className="text-xl text-text-body mb-10">
        Veilguard installs directly into your AI coding tool using the Model Context Protocol (MCP). It requires Node.js v18+.
      </p>

      <h2 className="text-2xl font-medium mt-10 mb-4 border-b border-border pb-2">Global Configuration</h2>
      <p className="text-text-body mb-4">
        The base MCP configuration is identical across all tools. Only the configuration file location changes.
      </p>
      <div className="bg-background-code border border-border rounded-xl p-6 mb-8 not-prose">
        <pre className="text-sm font-mono text-text-body overflow-x-auto">
{`{
  "mcpServers": {
    "veilguard": {
      "command": "npx",
      "args": ["-y", "@veilguard/cli"],
      "env": { "VEILGUARD_KEY": "your_key_here" }
    }
  }
}`}
        </pre>
      </div>

      <div className="space-y-12 not-prose">
        <div>
          <h3 className="text-xl font-medium text-text-heading mb-2">Claude Code</h3>
          <p className="text-sm text-text-muted mb-4">File: <code className="text-accent bg-accent-muted px-1.5 py-0.5 rounded">.claude/mcp.json</code></p>
          <p className="text-text-body text-sm mb-2">You can configure this manually, or run the following command directly in your repo:</p>
          <code className="block w-full p-4 bg-background-code border border-border rounded-lg text-sm font-mono text-text-body">
            claude mcp add veilguard -- npx -y @veilguard/cli
          </code>
          <p className="text-text-body text-sm mt-2"><strong>Note:</strong> Claude Code uses custom hooks that we inject automatically on setup.</p>
        </div>

        <div>
          <h3 className="text-xl font-medium text-text-heading mb-2">Cursor</h3>
          <p className="text-sm text-text-muted mb-4">File: <code className="text-accent bg-accent-muted px-1.5 py-0.5 rounded">.cursor/mcp.json</code></p>
          <p className="text-text-body text-sm">Add the JSON snippet above to your workspace MCP file. Once added, Cursor will prompt you to restart the extension host. Veilguard will generate a customized <code className="text-accent bg-accent-muted px-1.5 py-0.5 rounded">.cursorrules</code> file specifically for Cursor's Composer.</p>
        </div>

        <div>
          <h3 className="text-xl font-medium text-text-heading mb-2">Windsurf</h3>
          <p className="text-sm text-text-muted mb-4">File: <code className="text-accent bg-accent-muted px-1.5 py-0.5 rounded">~/.windsurf/mcp.json</code> (Global) or Workspace config</p>
          <p className="text-text-body text-sm">Add the JSON snippet above. We automatically inject a <code className="text-accent bg-accent-muted px-1.5 py-0.5 rounded">.windsurfrules</code> configuration to optimize Cascade's behavior.</p>
        </div>

        <div>
          <h3 className="text-xl font-medium text-text-heading mb-2">VS Code (via Cline/Roo)</h3>
          <p className="text-sm text-text-muted mb-4">File: <code className="text-accent bg-accent-muted px-1.5 py-0.5 rounded">.vscode/mcp.json</code></p>
          <p className="text-text-body text-sm">Depends on your specific AI extension. If using Roo Code or Cline, supply the MCP config in their settings panel or settings file.</p>
        </div>
      </div>
    </>
  );
}
