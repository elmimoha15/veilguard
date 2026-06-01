import { renderFix } from '../license/license.js';
import type { Finding, ScanResult, Tier } from '../types.js';

interface HeaderCheck {
  header: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  fix: string;
  docs: string;
}

const REQUIRED_HEADERS: HeaderCheck[] = [
  {
    header: 'content-security-policy',
    name: 'Content-Security-Policy',
    severity: 'warning',
    fix: "Add a Content-Security-Policy header. Start with: default-src 'self'; script-src 'self'",
    docs: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
  },
  {
    header: 'strict-transport-security',
    name: 'Strict-Transport-Security',
    severity: 'warning',
    fix: 'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security',
  },
  {
    header: 'x-content-type-options',
    name: 'X-Content-Type-Options',
    severity: 'warning',
    fix: 'Add: X-Content-Type-Options: nosniff',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options',
  },
  {
    header: 'x-frame-options',
    name: 'X-Frame-Options',
    severity: 'warning',
    fix: 'Add: X-Frame-Options: DENY (or SAMEORIGIN if you need iframes)',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options',
  },
  {
    header: 'referrer-policy',
    name: 'Referrer-Policy',
    severity: 'warning',
    fix: 'Add: Referrer-Policy: strict-origin-when-cross-origin',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy',
  },
  {
    header: 'permissions-policy',
    name: 'Permissions-Policy',
    severity: 'info',
    fix: 'Add: Permissions-Policy: camera=(), microphone=(), geolocation=()',
    docs: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Permissions-Policy',
  },
];

export async function checkHeaders(url: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const findings: Finding[] = [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);

    const headers = response.headers;

    for (const check of REQUIRED_HEADERS) {
      const value = headers.get(check.header);

      if (!value) {
        findings.push({
          id: `header-missing-${check.header}`,
          severity: check.severity,
          category: 'header',
          title: `Missing ${check.name} header`,
          message: `The deployed site at ${url} is missing the ${check.name} security header.`,
          fix: check.fix,
          docs: check.docs,
        });
      }
    }

    if (findings.length === 0) {
      findings.push({
        id: 'header-all-present',
        severity: 'passed',
        category: 'header',
        title: 'All security headers present',
        message: `All ${REQUIRED_HEADERS.length} recommended security headers found on ${url}.`,
      });
    }
  } catch (error) {
    findings.push({
      id: 'header-check-failed',
      severity: 'info',
      category: 'header',
      title: 'Header check failed',
      message: `Could not reach ${url}: ${(error as Error).message}. Make sure the URL is correct and the site is deployed.`,
    });
  }

  return {
    scanner: 'check_headers',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings,
  };
}

export function formatHeaderResults(result: ScanResult, tier: Tier): string {
  const { findings } = result;
  const issues = findings.filter((f) => f.severity !== 'passed');

  if (issues.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nAll security headers present. (${result.duration_ms}ms)`;
  }

  const lines: string[] = [
    `~~ veilguard ~~ ${issues.length} missing header${issues.length > 1 ? 's' : ''}`,
    '',
  ];

  for (const f of issues) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    lines.push(...renderFix(f, tier));
    lines.push('');
  }

  return lines.join('\n');
}
