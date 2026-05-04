/** Severity levels for security findings */
export type Severity = 'critical' | 'warning' | 'info' | 'passed';

/** License tier */
export type Tier = 'free' | 'pro';

/** A single security finding */
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

/** Result from a single scanner */
export interface ScanResult {
  scanner: string;
  timestamp: string;
  duration_ms: number;
  findings: Finding[];
}

/** Full audit report with scoring */
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

/** Secret pattern definition (loaded from patterns/secrets.json) */
export interface SecretPattern {
  id: string;
  name: string;
  pattern: string;
  severity: Severity;
  fix: string;
  breach_precedent?: string;
  context_required?: string;
}

/** Webhook verification rule */
export interface WebhookRule {
  provider: string;
  endpoint_patterns: string[];
  required_verification: string[];
  severity: Severity;
  fix: string;
  breach_precedent?: string;
}

/** Injection detection pattern */
export interface InjectionPattern {
  id: string;
  name: string;
  pattern: string;
  severity: Severity;
  fix: string;
  cwe?: string;
  breach_precedent?: string;
}

/** RLS rule definition */
export interface RlsRule {
  id: string;
  name: string;
  pattern: string;
  severity: Severity;
  fix: string;
  breach_precedent?: string;
}

/** Firebase rule definition */
export interface FirebaseRule {
  id: string;
  name: string;
  pattern: string;
  severity: Severity;
  fix: string;
}

/** Malicious package entry */
export interface MaliciousPackageEntry {
  name: string;
  reason: string;
}

/** Malicious packages database */
export interface MaliciousPackagesDB {
  known_malicious: MaliciousPackageEntry[];
  typosquats: Record<string, string[]>;
  suspicious_patterns: string[];
}

/** License validation result */
export interface LicenseResult {
  tier: Tier;
  valid: boolean;
  cached: boolean;
  expires_at?: string;
}

/** Audit usage tracking */
export interface AuditUsage {
  count: number;
  reset_date: string;
}

/** Scanner registration function signature */
export type ScannerFn = (directory: string, tier: Tier) => Promise<ScanResult>;

/** Tool registration info */
export interface ToolRegistration {
  name: string;
  description: string;
  proOnly: boolean;
  scanner: ScannerFn;
}
