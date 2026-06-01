export type Severity = 'critical' | 'warning' | 'info' | 'passed';
export type Tier = 'free' | 'pro';

export interface Finding {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  message: string;
  file?: string;
  line?: number;
  fix?: string;
  docs?: string;
  cwe?: string;
  breach_precedent?: string;
}

export interface ScanResult {
  scanner: string;
  timestamp: string;
  duration_ms: number;
  findings: Finding[];
}

export interface AuditReport {
  score: number;
  grade: string;
  timestamp: string;
  scans: ScanResult[];
  summary: {
    critical: number;
    warning: number;
    info: number;
    passed: number;
  };
  fix_prompt: string;
}

export interface SecretPattern {
  id: string;
  name: string;
  pattern: string;
  severity: Severity;
  fix: string;
  breach_precedent?: string;
  context_required?: string;
}

export interface WebhookRule {
  provider: string;
  endpoint_patterns: string[];
  required_verification: string[];
  severity: Severity;
  fix: string;
  breach_precedent?: string;
}

export interface InjectionPattern {
  id: string;
  name: string;
  pattern: string;
  severity: Severity;
  fix: string;
  cwe?: string;
  breach_precedent?: string;
}

export interface RlsRule {
  id: string;
  name: string;
  pattern: string;
  severity: Severity;
  fix: string;
  breach_precedent?: string;
}

export interface FirebaseRule {
  id: string;
  name: string;
  pattern: string;
  severity: Severity;
  fix: string;
}

export interface MaliciousPackageEntry {
  name: string;
  reason: string;
}

export interface MaliciousPackagesDB {
  known_malicious: MaliciousPackageEntry[];
  typosquats: Record<string, string[]>;
  suspicious_patterns: string[];
}

export interface LicenseResult {
  tier: Tier;
  valid: boolean;
  cached: boolean;
  expires_at?: string;
}

export type ScannerFn = (directory: string, tier: Tier) => Promise<ScanResult>;

export interface ToolRegistration {
  name: string;
  description: string;
  proOnly: boolean;
  scanner: ScannerFn;
}
