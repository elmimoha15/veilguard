import { join } from 'path';
import { readdir } from 'fs/promises';
import { readFileSafe } from '../utils/file-reader.js';
import { renderFix } from '../license/license.js';
import type { Finding, ScanResult, Tier } from '../types.js';

const RULES_FILES = [
  '.cursorrules',
  '.windsurfrules',
  'CLAUDE.md',
  '.antigravityrules',
  '.claude',
  'claude.md',
];

const RULES_EXTENSIONS = ['.rules', '.mcp.json'];

const TRUSTED_DOMAINS = [
  'github.com',
  'npmjs.com',
  'supabase.com',
  'stripe.com',
  'vercel.com',
  'netlify.com',
  'cloudflare.com',
  'googleapis.com',
  'openai.com',
  'anthropic.com',
  'microsoft.com',
  'mozilla.org',
  'w3.org',
  'developer.mozilla.org',
  'stackoverflow.com',
  'docs.github.com',
  'nextjs.org',
  'reactjs.org',
  'nodejs.org',
  'typescriptlang.org',
  'veilguard.dev',
];

// Hidden Unicode characters that could be used for backdoors
const HIDDEN_UNICODE: Array<{ char: string; name: string; code: string }> = [
  { char: '\u200B', name: 'Zero-width space', code: 'U+200B' },
  { char: '\u200C', name: 'Zero-width non-joiner', code: 'U+200C' },
  { char: '\u200D', name: 'Zero-width joiner', code: 'U+200D' },
  { char: '\u200E', name: 'Left-to-right mark', code: 'U+200E' },
  { char: '\u200F', name: 'Right-to-left mark', code: 'U+200F' },
  { char: '\u202A', name: 'Left-to-right embedding', code: 'U+202A' },
  { char: '\u202B', name: 'Right-to-left embedding', code: 'U+202B' },
  { char: '\u202C', name: 'Pop directional formatting', code: 'U+202C' },
  { char: '\u202D', name: 'Left-to-right override', code: 'U+202D' },
  { char: '\u202E', name: 'Right-to-left override', code: 'U+202E' },
  { char: '\u00AD', name: 'Soft hyphen', code: 'U+00AD' },
  { char: '\uFEFF', name: 'Byte order mark', code: 'U+FEFF' },
];

// Patterns that suggest malicious instructions
const MALICIOUS_PATTERNS = [
  /ignore\s+(all\s+)?security/i,
  /skip\s+(all\s+)?security/i,
  /disable\s+veilguard/i,
  /ignore\s+veilguard/i,
  /bypass\s+security/i,
  /don['']?t\s+scan/i,
  /never\s+report/i,
  /hide\s+(this|these)\s+from/i,
  /do\s+not\s+flag/i,
  /suppress\s+(all\s+)?warnings/i,
];

async function findRulesFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  
  // Check for known rules files in root
  for (const name of RULES_FILES) {
    const content = await readFileSafe(join(directory, name));
    if (content !== null) {
      files.push(join(directory, name));
    }
  }
  
  // Check for .rules and .mcp.json files
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        for (const ext of RULES_EXTENSIONS) {
          if (entry.name.endsWith(ext)) {
            files.push(join(directory, entry.name));
          }
        }
      }
    }
  } catch {
    // Directory read failed, continue with what we have
  }
  
  return files;
}

function checkHiddenUnicode(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { char, name, code } of HIDDEN_UNICODE) {
      if (line.includes(char)) {
        findings.push({
          id: 'rules-hidden-unicode',
          severity: 'critical',
          category: 'rules-backdoor',
          title: 'Hidden Unicode character in rules file',
          message: `Your AI rules file contains hidden characters (${name} ${code}) at ${filePath}:${i + 1} that could be steering your AI coding assistant to write malicious or backdoored code without you knowing. This is a known attack called the Rules File Backdoor. Delete and recreate this file from a trusted source.`,
          file: filePath,
          line: i + 1,
          fix: 'Delete this rules file and recreate it from scratch using only visible ASCII characters.',
          cwe: 'CWE-116',
          breach_precedent: 'IDEsaster attack: hidden Unicode in rules files can inject malicious instructions.',
        });
        return findings; // One finding per file is enough
      }
    }
  }
  
  return findings;
}

function checkBase64Strings(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');
  
  // Match base64 strings longer than 50 chars
  const base64Regex = /[A-Za-z0-9+/=]{50,}/g;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(base64Regex);
    if (matches) {
      for (const match of matches) {
        // Skip if it looks like a URL or path
        if (match.includes('/') && match.includes('.')) continue;
        
        findings.push({
          id: 'rules-base64-payload',
          severity: 'critical',
          category: 'rules-backdoor',
          title: 'Suspicious base64 string in rules file',
          message: `Your AI rules file contains a long base64-encoded string at ${filePath}:${i + 1}. This could contain hidden malicious instructions. Decode and inspect it before keeping this file.`,
          file: filePath,
          line: i + 1,
          fix: 'Decode the base64 string and verify its contents. If you did not add it, delete the rules file.',
          cwe: 'CWE-506',
          breach_precedent: 'IDEsaster attack: base64-encoded payloads hide malicious instructions from human review.',
        });
        return findings;
      }
    }
  }
  
  return findings;
}

function checkSuspiciousUrls(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');
  
  // Match URLs
  const urlRegex = /https?:\/\/([a-zA-Z0-9.-]+)/g;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match;
    while ((match = urlRegex.exec(line)) !== null) {
      const domain = match[1].toLowerCase();
      const isTrusted = TRUSTED_DOMAINS.some(trusted => 
        domain === trusted || domain.endsWith('.' + trusted)
      );
      
      if (!isTrusted) {
        findings.push({
          id: 'rules-suspicious-url',
          severity: 'warning',
          category: 'rules-backdoor',
          title: 'Unknown URL in rules file',
          message: `Your AI rules file references an unknown domain (${domain}) at ${filePath}:${i + 1}. Verify this URL is legitimate and not a phishing or malware site.`,
          file: filePath,
          line: i + 1,
          fix: 'Verify this URL is from a trusted source. If unknown, remove it from your rules file.',
          cwe: 'CWE-601',
        });
        return findings; // One per file
      }
    }
  }
  
  return findings;
}

function checkMaliciousInstructions(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of MALICIOUS_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          id: 'rules-malicious-instruction',
          severity: 'critical',
          category: 'rules-backdoor',
          title: 'Malicious instruction in rules file',
          message: `Your AI rules file contains an instruction to bypass security scanning at ${filePath}:${i + 1}. This is a red flag for a compromised rules file.`,
          file: filePath,
          line: i + 1,
          fix: 'Remove this instruction. Legitimate rules files never tell AI to ignore security.',
          cwe: 'CWE-506',
          breach_precedent: 'IDEsaster attack: malicious rules files instruct AI to skip security checks.',
        });
        return findings;
      }
    }
  }
  
  return findings;
}

export async function scanRulesFiles(directory: string, _tier: Tier): Promise<ScanResult> {
  const start = Date.now();
  const findings: Finding[] = [];
  
  const rulesFiles = await findRulesFiles(directory);
  
  for (const filePath of rulesFiles) {
    const content = await readFileSafe(filePath);
    if (!content) continue;
    
    findings.push(...checkHiddenUnicode(filePath, content));
    findings.push(...checkBase64Strings(filePath, content));
    findings.push(...checkSuspiciousUrls(filePath, content));
    findings.push(...checkMaliciousInstructions(filePath, content));
  }
  
  return {
    scanner: 'scan_rules_files',
    timestamp: new Date().toISOString(),
    duration_ms: Date.now() - start,
    findings,
  };
}

export function formatRulesFileResults(result: ScanResult, tier: Tier): string {
  const { findings } = result;
  
  if (findings.length === 0) {
    return `~~ veilguard ~~ all clear ✓\n\nAI rules files look clean. (${result.duration_ms}ms)`;
  }
  
  const lines: string[] = [
    `~~ veilguard ~~ ${findings.length} rules file issue${findings.length > 1 ? 's' : ''} found`,
    '',
  ];
  
  for (const f of findings) {
    lines.push(`${f.severity.toUpperCase()}: ${f.title}`);
    lines.push(`  ${f.message}`);
    lines.push(...renderFix(f, tier));
    lines.push('');
  }
  
  return lines.join('\n');
}
