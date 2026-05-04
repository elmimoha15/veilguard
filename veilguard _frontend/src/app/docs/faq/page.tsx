import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ & Troubleshooting',
  description: 'Common issues, license keys, false positives, audit limits.',
};

export default function DocsFaqPage() {
  return (
    <>
      <h1 className="text-4xl font-semibold mb-4">FAQ & Troubleshooting</h1>
      <p className="text-xl text-text-body mb-10">
        Solutions for common issues and answers to technical questions.
      </p>

      <h2 className="text-2xl font-medium mt-10 mb-4 border-b border-border pb-2">Troubleshooting Setup</h2>
      <div className="overflow-x-auto not-prose mb-12">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-border text-text-muted bg-background-code">
              <th className="py-3 px-4 font-medium w-1/3">Issue</th>
              <th className="py-3 px-4 font-medium w-2/3">Resolution</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="hover:bg-background-card/50">
              <td className="py-3 px-4 text-text-heading font-medium">Scanners not triggering</td>
              <td className="py-3 px-4 text-text-body">Ensure your MCP configuration file has no JSON syntax errors. Refresh the MCP host or restart your IDE entirely. Verify that the agent rules file was downloaded into your project root.</td>
            </tr>
            <tr className="hover:bg-background-card/50">
              <td className="py-3 px-4 text-text-heading font-medium">Command not found</td>
              <td className="py-3 px-4 text-text-body">Veilguard requires <code className="text-accent bg-accent-muted px-1 rounded">Node &gt;=18</code> accessible in the PATH that your IDE extension uses to spawn MCP processes.</td>
            </tr>
            <tr className="hover:bg-background-card/50">
              <td className="py-3 px-4 text-text-heading font-medium">Pro key not recognized</td>
              <td className="py-3 px-4 text-text-body">Ensure you used the correct <code className="text-accent bg-accent-muted px-1 rounded">vg_live_...</code> prefix. Ensure there are no spaces. Restart the extension.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-medium mt-10 mb-4 border-b border-border pb-2">Scanners & Audits</h2>
      <div className="space-y-6">
        <div>
          <h3 className="text-xl font-medium text-text-heading mb-2">How do I ignore false positives?</h3>
          <p className="text-text-body text-sm mb-4">
            If Veilguard identifies a mock secret, you can add a <code className="text-accent bg-accent-muted px-1.5 py-0.5 rounded text-sm">.veilguardignore</code> file in the root of your project:
          </p>
          <pre className="text-sm font-mono text-text-body bg-background-code border border-border rounded-xl p-4 not-prose">
{`# .veilguardignore
# Ignore specific files
src/tests/mocks.ts
# Ignore specific scanner rules across everything
- scan_secrets: stripe_test_key`}
          </pre>
        </div>

        <div>
          <h3 className="text-xl font-medium text-text-heading mb-2">When do my Pro audits reset?</h3>
          <p className="text-text-body text-sm">
            Pro accounts get 3 Full Audits per month. The quota resets on the 1st day of the calendar month (UTC).
          </p>
        </div>
      </div>
    </>
  );
}
