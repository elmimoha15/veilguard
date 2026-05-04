import { join } from 'path';
import { readJsonFile } from '../utils/file-reader.js';
import { fetchSafe } from '../utils/http.js';
import { OSV_API_URL, FREE_TIER_MAX_FINDINGS } from '../utils/constants.js';
import { logger } from '../utils/logger.js';
import { getUpgradeMessage } from '../license/license.js';
import type { Finding, ScanResult, Tier } from '../types.js';

interface OsvVuln {
  id: string;
  summary?: string;
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{ ranges?: Array<{ events?: Array<{ fixed?: string }> }> }>;
}

interface OsvResponse {
  vulns?: OsvVuln[];
}

/** Query OSV.dev for vulnerabilities in a package */
async function queryOsv(packageName: string, version: string): Promise<OsvVuln[]> {
  const response = await fetchSafe<OsvResponse>(OSV_API_URL, {
    method: 'POST',
    body: JSON.stringify({
      package: { name: packageName, ecosystem: 'npm' },
      version,
    }),
    timeoutMs: 10000,
  });

  return response?.vulns ?? [];
}

/** Extract fix version from OSV vulnerability data */
function getFixVersion(vuln: OsvVuln): string | null {
  const affected = vuln.affected?.[0];
  const ranges = affected?.ranges?.[0];
  const fixEvent = ranges?.events?.find((e) => e.fixed);
  return fixEvent?.fixed ?? null;
}

/** Get severity from OSV data */
function getSeverity(vuln: OsvVuln): 'critical' | 'warning' | 'info' {
  const score = vuln.severity?.[0]?.score;
  if (!score) return 'warning';
  const numScore = parseFloat(score);
  if (numScore >= 9.0) return 'critical';
  if (numScore >= 7.0) return 'critical';
  if (numScore >= 4.0) return 'warning';
  return 'info';
}

/** Clean version string (remove ^ ~ >= etc.) */
function cleanVersion(version: string): string {
  return version.replace(/^[\^~>=<]+/, '').split(' ')[0];
}

/** Run the dependency checker */
export async function scanDependencies(directory: string, tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const findings: Finding[] = [];

  const pkgJson = await readJsonFile<{ dependencies?: Record<string, string> }>(
    join(directory, 'package.json'),
  );

  if (!pkgJson || !pkgJson.dependencies) {
    return {
      scanner: 'scan_dependencies',
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - start,
      findings: [{
        id: 'deps-no-package-json',
        severity: 'info',
        category: 'dependency',
        title: 'No dependencies found',
        message: 'No package.json or no dependencies listed.',
      }],
    };
  }

  const deps = Object.entries(pkgJson.dependencies);
  logger.debug(`Checking ${deps.length} dependencies against OSV.dev`);

  for (const [name, versionSpec] of deps) {
    const version = cleanVersion(versionSpec);
    if (!version || version === '*' || version === 'latest') continue;

    try {
      const vulns = await queryOsv(name, version);

      for (const vuln of vulns) {
        const severity = getSeverity(vuln);

        // Free tier: only show critical CVEs
        if (tier === 'free' && severity !== 'critical') continue;

        const fixVersion = getFixVersion(vuln);
        findings.push({
          id: `dep-${vuln.id}`,
          severity,
          category: 'dependency',
          title: `${vuln.id} in ${name}@${version}`,
          message: vuln.summary ?? `Known vulnerability in ${name}@${version}`,
          file: join(directory, 'package.json'),
          fix: fixVersion ? `Upgrade ${name} to ${fixVersion}: npm install ${name}@${fixVersion}` : `Check ${vuln.id} for remediation.`,
          docs: `https://osv.dev/vulnerability/${vuln.id}`,
        });
      }
    } catch (error) {
      logger.debug(`OSV query failed for ${name}@${version}: ${(error as Error).message}`);
    }
  }

  return {
    scanner: 'scan_dependencies',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings,
  };
}

export function formatDependencyResults(result: ScanResult, tier: Tier): string {
  const { findings } = result;
  const issues = findings.filter((f) => f.severity !== 'info');

  if (issues.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nNo known vulnerabilities in dependencies. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [`~~ veilguard ~~ ${issues.length} vulnerable dependenc${issues.length > 1 ? 'ies' : 'y'} found`, ''];

  const visible = tier === 'pro' ? issues : issues.slice(0, FREE_TIER_MAX_FINDINGS);
  const hidden = issues.length - visible.length;

  for (const f of visible) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    if (f.fix) lines.push(`  Fix: ${f.fix}`);
    lines.push('');
  }

  if (hidden > 0) lines.push(getUpgradeMessage(hidden));
  if (tier === 'free') {
    lines.push('Note: Free tier shows critical CVEs only. Pro shows all severities.');
  }
  return lines.join('\n');
}
