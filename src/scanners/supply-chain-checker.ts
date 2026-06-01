import { readFile } from 'fs/promises';
import { join } from 'path';
import { readJsonFile } from '../utils/file-reader.js';
import { logger } from '../utils/logger.js';
import { getPatternsDir } from '../utils/paths.js';
import { renderFix } from '../license/license.js';
import type { Finding, ScanResult, MaliciousPackagesDB, Tier } from '../types.js';

let dbCache: MaliciousPackagesDB | null = null;

async function loadDB(): Promise<MaliciousPackagesDB> {
  if (dbCache) return dbCache;
  try {
    const dbPath = join(getPatternsDir(), 'malicious-packages.json');
    const raw = await readFile(dbPath, 'utf-8');
    dbCache = JSON.parse(raw) as MaliciousPackagesDB;
    return dbCache;
  } catch {
    logger.error('Failed to load malicious packages DB');
    return { known_malicious: [], typosquats: {}, suspicious_patterns: [] };
  }
}

export async function checkSupplyChain(directory: string, tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  const db = await loadDB();

  const pkgJson = await readJsonFile<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(
    join(directory, 'package.json'),
  );

  if (!pkgJson) {
    return {
      scanner: 'check_supply_chain',
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - start,
      findings: [{
        id: 'supply-chain-no-package-json',
        severity: 'info',
        category: 'supply-chain',
        title: 'No package.json found',
        message: 'Could not find package.json in the project root. Supply chain check skipped.',
      }],
    };
  }

  const allDeps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  const depNames = Object.keys(allDeps);

  // Free: check top 20 deps only. Pro: check all.
  const depsToCheck = tier === 'pro' ? depNames : depNames.slice(0, 20);

  for (const dep of depsToCheck) {
    // Check known malicious
    const malicious = db.known_malicious.find((m) => m.name === dep);
    if (malicious) {
      findings.push({
        id: `supply-chain-malicious-${dep}`,
        severity: 'critical',
        category: 'supply-chain',
        title: `Known malicious package: ${dep}`,
        message: `${dep} is a known malicious package. Reason: ${malicious.reason}`,
        file: join(directory, 'package.json'),
        fix: `Remove ${dep} from your dependencies immediately: npm uninstall ${dep}`,
        cwe: 'CWE-829',
        breach_precedent: 'ClawHub Skills (2026): 20% of AI agent skills were malicious, exfiltrating .env files.',
      });
    }

    // Check typosquats
    for (const [legitimate, squats] of Object.entries(db.typosquats)) {
      if (squats.includes(dep)) {
        findings.push({
          id: `supply-chain-typosquat-${dep}`,
          severity: 'critical',
          category: 'supply-chain',
          title: `Typosquatted package: ${dep}`,
          message: `"${dep}" looks like a typosquat of "${legitimate}". AI tools sometimes suggest non-existent packages that hackers register.`,
          file: join(directory, 'package.json'),
          fix: `Replace "${dep}" with "${legitimate}": npm uninstall ${dep} && npm install ${legitimate}`,
          cwe: 'CWE-829',
        });
      }
    }
  }

  // Check for suspicious install scripts in package.json
  if (pkgJson.dependencies) {
    const pkgContent = await readFile(join(directory, 'package.json'), 'utf-8');
    for (const pattern of db.suspicious_patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(pkgContent)) {
        findings.push({
          id: 'supply-chain-suspicious-script',
          severity: 'warning',
          category: 'supply-chain',
          title: 'Suspicious install script in package.json',
          message: `package.json contains a suspicious pattern: ${pattern}. This could exfiltrate data during npm install.`,
          file: join(directory, 'package.json'),
          fix: 'Review all preinstall/postinstall scripts carefully. Remove any that run curl, wget, or node -e with unknown code.',
          cwe: 'CWE-829',
        });
        break;
      }
    }
  }

  if (tier === 'free' && depNames.length > 20) {
    findings.push({
      id: 'supply-chain-limit',
      severity: 'info',
      category: 'supply-chain',
      title: `Checked 20 of ${depNames.length} dependencies`,
      message: `Free tier checks the first 20 dependencies. Upgrade to Pro to check all ${depNames.length}.`,
    });
  }

  return {
    scanner: 'check_supply_chain',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings,
  };
}

export function formatSupplyChainResults(result: ScanResult, tier: Tier): string {
  const { findings } = result;
  const issues = findings.filter((f) => f.severity !== 'info' && f.severity !== 'passed');

  if (issues.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nNo malicious or typosquatted packages found. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [`~~ veilguard ~~ ${issues.length} supply chain issue${issues.length > 1 ? 's' : ''} found`, ''];
  for (const f of findings) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    lines.push(...renderFix(f, tier));
    lines.push('');
  }
  return lines.join('\n');
}
