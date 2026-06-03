# False-positive elimination

Veilguard had a credibility bug: it flagged *descriptions* of vulnerabilities as
if they were *real* vulnerabilities. Running `full_audit` on our own static
marketing site produced **Grade F, 0/100, 23 "criticals"** — every one of them a
false alarm (SEO copy, feature descriptions, JSON-LD, code examples in strings).

This document explains the classification model that fixes it and the measured
before/after results.

## Core principle

A finding is real only when the dangerous pattern is **live, reachable,
executable code**. The same characters appearing as documentation, a string
literal, marketing copy, a placeholder, or a test fixture are *not* findings.

```
app.use(cors({ origin: '*' }))           ← real misconfiguration  → flag
desc: "Catches cors({ origin: '*' })"    ← marketing copy          → ignore
```

Both lines contain `cors({ origin: '*' })`. Only the **context** differs.

## The classifier — `src/utils/match-context.ts`

Every scanner routes a candidate match through `classifyMatch()` **before**
emitting a finding. It returns:

| field            | meaning                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `kind`           | `code · string-literal · comment · markdown · jsx-text · json-data · doc-file · test-fixture` |
| `isProse`        | the match is documentation / display / comment / JSX text          |
| `isLikelyExample`| the value looks like a placeholder/example rather than a real one  |
| `confidence`     | `0..1` — how likely this is a real, exploitable finding            |

### How the context is determined

1. **File level.** `.md/.mdx/.txt/README*/CHANGELOG*` are doc files; any path
   segment like `tests/`, `__tests__`, `fixtures/`, `examples/`, `mocks/`,
   `docs/`, `stories/` (evaluated **relative to the scan root**, so a real
   `project/docs/` is caught while the scanner's own test corpus isn't) marks a
   test/example file. Both suppress security findings outright.

2. **Lexical level (the heart of it).** A single-pass lexer, `lexStateAt()`,
   walks the file once and reports whether a given offset sits inside a **string
   literal**, a **`//` line comment**, or a **`/* */` block comment** — handling
   escapes and template literals.

3. **JSX text** between a `>` and a `<` in `.tsx/.jsx` is treated as rendered
   copy, not code.

4. **Display-copy keys.** A string that is the value of `desc:`, `description:`,
   `title:`, `label:`, `name:`, `keywords:`, `content:`, `alt:`, … or that reads
   like a sentence (3+ words / sentence punctuation) is prose.

5. **Placeholders & entropy.** `isPlaceholderValue()` catches `YOUR_KEY`,
   `<your-token>`, `example`, `placeholder`, `xxxxxxxx`, `foo/bar`, ellipses, and
   trivial sequences. For secrets, `shannonEntropy()` requires the random portion
   of a token to score ≥ 2.8 bits/char — real keys are near-random; `sk_live_xxxx`
   and `sk_live_…EXAMPLE` are not.

### Why heuristics, not a parser

We deliberately **did not add a JS/TS parser** (acorn, `@babel/parser`). A parser
gives perfect boundaries but is heavy, fails on partial/invalid files (which a
security scanner must still process), and is overkill for a line-oriented tool.
The single-pass lexer is dependency-free, fast, and robust to malformed input.
The tradeoff — occasional imprecision on pathological lines — is biased toward
**suppression** for code-construct scanners and toward **entropy/placeholder**
checks for secrets, i.e. we prefer a rare missed edge case over a false alarm.
No new dependencies were added.

### Two modes

- **`code-construct`** (CORS, injection, webhook, app-security): the finding is a
  *code construct* (`cors(`, `query(`, a route). If that token sits inside a
  string or comment, it is by definition an example → suppressed.
- **`secret-value`** (secret scanner): a secret is *normally itself* a string
  literal, so a plain string value is high-confidence; only prose, display-copy,
  placeholders, and low entropy suppress it.

## Confidence & severity calibration

`calibrate()` attaches `confidence` to the finding and steps severity down:

```
confidence ≥ 0.90  → critical stays critical
0.50 ≤ c < 0.90    → critical → warning
0.35 ≤ c < 0.50    → warning  → info (advisory)
c < 0.35           → dropped entirely
```

`scoring.ts` then multiplies each finding's penalty by its confidence. Findings
with no confidence (the scanners we didn't touch) default to `1`, so existing
behaviour is preserved. The net effect: a contextual/low-confidence match can no
longer drag a clean site to an F.

## Scanner-specific fixes

| Scanner                 | Fix |
| ----------------------- | --- |
| `secret-scanner.ts`     | Skips doc/test files; vets every match in `secret-value` mode; entropy + placeholder gating. `sk_live_` named in copy is not a secret. |
| `git-checker.ts`        | History scan now uses an extended-regex pickaxe requiring the full key shape (`sk_live_[A-Za-z0-9]{20,}`), so a bare prefix in a committed doc is not a "leaked secret". `.gitignore` membership is glob-aware. |
| `cors-scanner.ts`       | Only flags `cors({...})` / header calls in executable code, never a quoted example. |
| `webhook-scanner.ts`    | File-level gate: only real request handlers are scanned, so SEO copy naming providers is ignored. Route-path strings inside handlers are still flagged. |
| `injection-scanner.ts`  | Template-literal/concat matches must be real code. `dangerouslySetInnerHTML` fed `JSON.stringify(...)` / JSON-LD is downgraded to **info**. |
| `app-security-scanner.ts` | Skips doc/test/example files in addition to its existing route-file gating. |
| `env-checker.ts`        | `.gitignore` glob coverage — `.env*` correctly covers `.env.local`/`.env.production`; covered files are no longer reported "missing". |

## Before / after (measured)

Measured on two corpora generated at test runtime (in `tests/false-positives.test.ts`):
a **clean marketing site** reproducing the exact patterns from the bug report, and
a **genuinely insecure API**, by running the scanners with the fix reverted vs.
applied. The corpora are written to temp dirs rather than committed — a real,
contiguous `sk_live_…` key in the repo would (rightly) be blocked by GitHub secret
push protection, so the test assembles the token by concatenation at runtime.

### Clean marketing site — *must NOT flag*

| Scanner                         | Before (criticals) | After |
| ------------------------------- | ------------------ | ----- |
| Secrets (`sk_live_`/`FLWSECK_` in copy) | 2          | **0** |
| CORS (`cors({origin:'*'})` in a desc)   | 1          | **0** |
| Injection (`db.query` example)          | 1          | **0** |
| Webhook (SEO naming providers)          | 4          | **0** |
| `dangerouslySetInnerHTML` (JSON-LD)     | warning    | **info** |
| **Full audit**                          | **Grade F, 0/100, 8 criticals** | **Grade A+, 96/100, 0 criticals** |

(The production site reported 23 false criticals; the fixture reproduces the same
classes at smaller scale. All are eliminated.)

### Vulnerable app — *must still flag* (no loss of true positives)

| Issue                                   | Before | After |
| --------------------------------------- | ------ | ----- |
| Hardcoded `sk_live_` (high entropy)     | critical | **critical** |
| Real `cors({ origin: '*' })`            | critical | **critical** |
| Real `db.query(\`…${userId}\`)`         | critical | **critical** |
| Unverified Stripe webhook handler       | critical | **critical** |
| **Full audit**                          | Grade F | **Grade F (0/100)** |

## Regression tests

`tests/false-positives.test.ts` enforces both directions permanently (corpora are
generated into temp dirs at runtime):

- the clean corpus produces **zero criticals** and grades **A/B**;
- the vulnerable corpus still flags every issue and grades **F**;
- `NEXT_PUBLIC_…` named in display copy is not flagged;
- `.env*` covers `.env.local` (and a gitignore with no env entry still flags it).

Run with `npm test`.
