import { extname, basename, relative } from 'path';
import type { Finding } from '../types.js';

// ──────────────────────────────────────────────────────────────────────────────
// Match-context classifier
//
// The credibility problem this solves: a scanner regex that matches a dangerous
// pattern cannot, on its own, tell the difference between
//
//     app.use(cors({ origin: '*' }))            ← a real misconfiguration
//     desc: "Catches cors({ origin: '*' })"      ← marketing copy describing it
//
// Both contain the same characters. Only the *context* differs. Every scanner
// routes a candidate match through this module before emitting a finding so the
// two cases are treated differently.
//
// Design tradeoff — heuristics, not a full parser:
//   We deliberately avoid adding a JS/TS parser (e.g. @babel/parser, acorn) as a
//   dependency. A parser would give perfect string/comment/JSX boundaries, but it
//   is heavy, fails on partial/invalid files (which a security scanner must still
//   handle), and is overkill for a line-oriented scanner. Instead we use a small
//   single-pass lexer (`lexStateAt`) that tracks whether an offset sits inside a
//   string, line comment, or block comment, plus targeted heuristics for JSX text
//   and "display-copy" object keys. This is fast, dependency-free, and robust to
//   malformed input. The cost is occasional imprecision on pathological lines,
//   which we bias toward *suppression* (favouring a missed edge case over a false
//   alarm) for code-construct scanners and toward *entropy/placeholder* checks for
//   secrets.
// ──────────────────────────────────────────────────────────────────────────────

export type MatchKind =
  | 'code'
  | 'string-literal'
  | 'comment'
  | 'markdown'
  | 'jsx-text'
  | 'json-data'
  | 'doc-file'
  | 'test-fixture';

export interface MatchClassification {
  kind: MatchKind;
  /** The match looks like a placeholder/example value rather than a real one. */
  isLikelyExample: boolean;
  /** 0..1 — how confident we are this is a *real, exploitable* finding. */
  confidence: number;
  /** True when the match is documentation / display / comment / JSX text. */
  isProse: boolean;
}

/**
 * Whether a scanner is looking for a code construct (a `cors(` call, a `query(`,
 * a route handler) or a secret value (a token that is normally itself a string
 * literal). The two need opposite treatment of string-literal context.
 */
export type ClassifyMode = 'code-construct' | 'secret-value';

export interface ClassifyParams {
  filePath: string;
  content: string;
  /** 0-based line index of the match. */
  lineIndex: number;
  /** 0-based column of the match within the line. Derived from matchText if absent. */
  column?: number;
  /** The matched text (used for placeholder / entropy checks). */
  matchText?: string;
  /** The full line text (defaults to content split at lineIndex). */
  lineText?: string;
  /** Scan root, so path-based checks use the project-relative path. */
  rootDir?: string;
  mode?: ClassifyMode;
}

// Confidence thresholds shared by every scanner and the scorer.
export const CONFIDENCE = {
  /** At/above this, a critical may stay critical. */
  HIGH: 0.9,
  /** Below HIGH but at/above this, a critical is downgraded to a warning. */
  MEDIUM: 0.5,
  /** Below this, the finding is dropped entirely. */
  EMIT_FLOOR: 0.35,
} as const;

// Minimum Shannon entropy (bits/char) for the random portion of a secret. Real
// tokens are near-random (>3.5); placeholders like "xxxxxxxx" or "1234..." score
// far lower.
const SECRET_MIN_ENTROPY = 2.8;

// ── file-level classification ───────────────────────────────────────────────────

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.markdown', '.txt', '.rst', '.adoc']);
const DOC_FILENAME =
  /^(readme|changelog|contributing|license|notice|authors|code_of_conduct|security|history)\b/i;

export function isDocFile(filePath: string): boolean {
  const base = basename(filePath).toLowerCase();
  return DOC_EXTENSIONS.has(extname(base)) || DOC_FILENAME.test(base);
}

const TEST_EXAMPLE_SEGMENT =
  /(^|[\\/])(tests?|__tests__|__mocks__|fixtures?|examples?|samples?|mocks?|docs?|stories|e2e|cypress|spec|demo|playground)([\\/]|$)/i;
const TEST_EXAMPLE_FILENAME = /\.(test|spec|stories|fixture|mock|sample|example|e2e)\.[cm]?[tj]sx?$/i;

function relativePath(filePath: string, rootDir?: string): string {
  if (!rootDir) return filePath;
  const rel = relative(rootDir, filePath);
  if (!rel || rel.startsWith('..')) return basename(filePath);
  return rel;
}

export function isTestOrExampleFile(filePath: string, rootDir?: string): boolean {
  const rel = relativePath(filePath, rootDir);
  return TEST_EXAMPLE_SEGMENT.test(rel) || TEST_EXAMPLE_FILENAME.test(basename(filePath));
}

// ── value classification (placeholders & entropy) ────────────────────────────────

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /YOUR[_-]?[A-Z0-9]*/i,
  /<[^>\s]{2,}>/, // <your-token>
  /\b(example|placeholder|redacted|dummy|sample|changeme|change[_-]?me|fake|mock|test[_-]?key|todo|tbd|lorem|ipsum|insert[_-]?your)\b/i,
  /\b(foo|bar|baz|qux)\b/i,
  /\.{3,}/, // ellipsis: "sk_live_..."
  /(.)\1{5,}/, // 6+ repeated chars: "xxxxxxxx"
  /(0123456|1234567|abcdefg|abcdef0)/i, // trivial sequences
];

export function isPlaceholderValue(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((re) => re.test(value));
}

export function shannonEntropy(str: string): number {
  if (!str) return 0;
  const freq: Record<string, number> = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  let entropy = 0;
  for (const ch in freq) {
    const p = freq[ch] / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

// The random tail of a token, ignoring a known prefix like "sk_live_".
function secretEntropyPortion(value: string): string {
  const stripped = value.replace(/^[A-Za-z]+[-_]/, '').replace(/^[A-Za-z]{2,4}_/, '');
  return stripped.length >= 8 ? stripped : value;
}

function looksLikeFakeSecret(value: string): boolean {
  if (isPlaceholderValue(value)) return true;
  return shannonEntropy(secretEntropyPortion(value)) < SECRET_MIN_ENTROPY;
}

// ── lexical state (string / comment) ──────────────────────────────────────────────

interface LexState {
  inString: boolean;
  inLineComment: boolean;
  inBlockComment: boolean;
  /** The quote char if inString (', ", or `). */
  quote: string;
}

// Single-pass lexer: returns the lexical state at `offset` in `content`. Handles
// ', ", ` strings (with escapes), // line comments, and /* */ block comments.
function lexStateAt(content: string, offset: number): LexState {
  let inString = false;
  let quote = '';
  let inLineComment = false;
  let inBlockComment = false;
  const end = Math.min(offset, content.length);

  for (let i = 0; i < end; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        i++; // skip escaped char
        continue;
      }
      if (ch === quote) {
        inString = false;
        quote = '';
      } else if (ch === '\n' && quote !== '`') {
        // Unterminated ' or " string — recover at line end.
        inString = false;
        quote = '';
      }
      continue;
    }

    // Not in string/comment.
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = true;
      quote = ch;
      continue;
    }
  }

  return { inString, inLineComment, inBlockComment, quote };
}

function computeOffset(content: string, lineIndex: number, column: number): number {
  const lines = content.split('\n');
  let offset = 0;
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for the consumed '\n'
  }
  return offset + column;
}

// ── prose / display-copy heuristics ───────────────────────────────────────────────

// Object keys whose values are human-facing copy, not executable config.
const DISPLAY_COPY_KEY =
  /\b(desc|description|title|subtitle|heading|label|name|keywords?|text|content|caption|alt|tooltip|summary|tagline|placeholder|message|copy|blurb|excerpt|body|examples?|trigger|sample|hint|note)\s*:\s*$/i;

// Does the text immediately before the opening quote look like a display-copy key?
function precededByDisplayKey(lineText: string, quoteCol: number): boolean {
  const before = lineText.slice(0, quoteCol);
  return DISPLAY_COPY_KEY.test(before);
}

// A string value that reads like a sentence / phrase rather than a token.
function looksLikeProse(value: string): boolean {
  const t = value.trim();
  if (/[A-Za-z]{2,}\s+[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(t)) return true; // 3+ words
  if (/[A-Za-z]{3,}[.,;:!?]\s+[A-Za-z]/.test(t)) return true; // sentence punctuation
  return false;
}

// Find the string literal that encloses `column` on this line, returning its
// inner value and the column of its opening quote.
function enclosingString(
  lineText: string,
  column: number,
): { value: string; openCol: number } | null {
  let openCol = -1;
  let quote = '';
  for (let i = 0; i < column && i < lineText.length; i++) {
    const ch = lineText[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) {
        quote = '';
        openCol = -1;
      }
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      openCol = i;
    }
  }
  if (!quote || openCol < 0) return null;
  // Find the closing quote after column.
  let close = lineText.length;
  for (let i = column; i < lineText.length; i++) {
    if (lineText[i] === '\\') {
      i++;
      continue;
    }
    if (lineText[i] === quote) {
      close = i;
      break;
    }
  }
  return { value: lineText.slice(openCol + 1, close), openCol };
}

// Crude JSX text-node detection: the match sits between a `>` and a `<` on a line
// inside a .tsx/.jsx file, i.e. rendered text rather than code.
function isJsxTextNode(lineText: string, column: number, filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  if (ext !== '.tsx' && ext !== '.jsx') return false;
  const before = lineText.slice(0, column);
  const after = lineText.slice(column);
  const lastOpen = before.lastIndexOf('<');
  const lastClose = before.lastIndexOf('>');
  // We're after a '>' that closed a tag, and there's a '<' ahead (next tag).
  return lastClose > lastOpen && /</.test(after);
}

// ── the classifier ────────────────────────────────────────────────────────────────

function prose(kind: MatchKind, confidence = 0.05): MatchClassification {
  return { kind, isProse: true, isLikelyExample: true, confidence };
}

export function classifyMatch(p: ClassifyParams): MatchClassification {
  const mode: ClassifyMode = p.mode ?? 'code-construct';

  // 1. Whole-file gates.
  if (isDocFile(p.filePath)) return prose('doc-file');
  if (isTestOrExampleFile(p.filePath, p.rootDir)) return prose('test-fixture');

  const lines = p.content.split('\n');
  const lineText = p.lineText ?? lines[p.lineIndex] ?? '';
  const column =
    p.column ?? (p.matchText ? Math.max(0, lineText.indexOf(p.matchText)) : 0);
  const offset = computeOffset(p.content, p.lineIndex, column);
  const state = lexStateAt(p.content, offset);

  // 2. Comments never execute.
  if (state.inLineComment || state.inBlockComment) {
    return { kind: 'comment', isProse: true, isLikelyExample: false, confidence: 0.1 };
  }

  // 3. JSX text node — rendered copy, not code.
  if (isJsxTextNode(lineText, column, p.filePath)) {
    return prose('jsx-text');
  }

  // 4. Inside a string literal.
  if (state.inString) {
    const enclosed = enclosingString(lineText, column);
    const displayCopy =
      (enclosed && precededByDisplayKey(lineText, enclosed.openCol)) ||
      (enclosed != null && looksLikeProse(enclosed.value));

    if (mode === 'code-construct') {
      // A code construct quoted inside a string is, by definition, an example or
      // a description — not executable. Always suppress.
      return {
        kind: 'string-literal',
        isProse: !!displayCopy,
        isLikelyExample: true,
        confidence: 0.1,
      };
    }

    // mode === 'secret-value': a secret is normally itself a string literal.
    if (displayCopy) return prose('string-literal');
    if (p.matchText && looksLikeFakeSecret(p.matchText)) {
      return { kind: 'string-literal', isProse: false, isLikelyExample: true, confidence: 0.1 };
    }
    // A real-looking token assigned as a string value — the canonical leaked key.
    return { kind: 'string-literal', isProse: false, isLikelyExample: false, confidence: 0.95 };
  }

  // 5. Bare code with an obvious placeholder value.
  if (p.matchText && isPlaceholderValue(p.matchText)) {
    return { kind: 'code', isProse: false, isLikelyExample: true, confidence: 0.2 };
  }
  if (mode === 'secret-value' && p.matchText && looksLikeFakeSecret(p.matchText)) {
    return { kind: 'code', isProse: false, isLikelyExample: true, confidence: 0.2 };
  }

  // 6. Real, executable code.
  return { kind: 'code', isProse: false, isLikelyExample: false, confidence: 1 };
}

// Attach confidence and calibrate severity. Returns null when the match should be
// dropped. CRITICAL is only preserved at HIGH confidence; otherwise it steps down
// to warning, then info (an advisory), and finally to suppression.
export function calibrate(finding: Finding, c: MatchClassification): Finding | null {
  if (c.confidence < CONFIDENCE.EMIT_FLOOR) return null;

  const out: Finding = { ...finding, confidence: Math.round(c.confidence * 100) / 100 };

  if (out.severity === 'critical' && c.confidence < CONFIDENCE.HIGH) {
    out.severity = 'warning';
  }
  if (out.severity === 'warning' && c.confidence < CONFIDENCE.MEDIUM) {
    out.severity = 'info';
  }
  return out;
}

// Convenience: classify a candidate match and return a calibrated finding (or
// null to suppress). Used by every line-oriented scanner.
export function vetMatch(
  finding: Finding,
  params: ClassifyParams,
): Finding | null {
  return calibrate(finding, classifyMatch(params));
}

// ── .gitignore glob coverage ────────────────────────────────────────────────────

function gitignorePatternToRegex(pattern: string): RegExp {
  const p = pattern
    .trim()
    .replace(/\/$/, '') // trailing slash (dir marker)
    .replace(/^\//, ''); // leading anchor
  const escaped = p
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp('^' + escaped + '$');
}

// True if a .gitignore body covers `fileName`, honouring globs. So `.env*`
// correctly covers `.env`, `.env.local`, and `.env.production`.
export function gitignoreCovers(gitignoreContent: string, fileName: string): boolean {
  const name = fileName.replace(/^\.\//, '');
  const base = basename(name);
  for (const raw of gitignoreContent.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    try {
      const re = gitignorePatternToRegex(line);
      if (re.test(name) || re.test(base)) return true;
    } catch {
      // Malformed pattern — skip it.
    }
  }
  return false;
}
