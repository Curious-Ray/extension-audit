# Verdikt — Chrome Web Store Rejection Predictor

**Status:** Design approved (pending spec review)
**Date:** 2026-05-20

## 1. Purpose

Verdikt takes a Chrome extension and predicts whether the Chrome Web Store
will reject or remove it — *before* the developer submits. It maps the
extension against the official Chrome Web Store violation categories (each
identified by its human-readable notification ID, e.g. `Blue Argon`,
`Purple Potassium`, `Yellow Zinc`) and returns a verdict with per-category
findings, evidence, the relevant policy quote, and how-to-fix guidance.

### Why this is different from the source repos

Two reference repos were provided:

- **ChromeAudit** — Nuclei YAML templates: regex-based *security* checks.
- **tarnish** — a Python (Celery/redis/S3) static-analysis *security* tool that
  pulls extensions from Web Store URLs.

Both are security scanners. But the official violations doc
(`Troubleshooting Chrome Web Store violations.md`) shows most real rejections
are **policy** failures, not security bugs: excessive permissions, remotely
hosted code, missing/misleading metadata, missing privacy policy,
single-purpose violations, obfuscation. Verdikt is therefore organized **by the
official notification IDs**, and the repos become *inputs to specific checkers*
rather than the structure of the tool. Where the repos' techniques apply, we
reimplement them natively with real JS AST parsing (fewer false positives than
the original regex) and optionally invoke the real Nuclei binary as a bonus
module.

## 2. Form factor & stack

- **Full web app**, server-side scanning (so Web Store URLs can be fetched
  directly).
- **TypeScript full-stack monorepo**, three packages:
  - `packages/engine` — pure, I/O-free analysis core. Input: `Bundle`.
    Output: `Report`. Fully unit-testable, no network/filesystem.
  - `packages/server` — Fastify. Owns all I/O: accepts uploads / URL /
    metadata, normalizes into a `Bundle`, calls the engine, optionally shells
    out to Nuclei, optionally calls Claude, persists reports. Returns `Report`
    JSON.
  - `packages/web` — React + Vite. Upload zone (zip/crx + drag-drop folder),
    Web Store URL box, optional listing-metadata form, report dashboard.
- **Persistence:** SQLite. Every scan gets a stable `/report/:id` URL
  (tarnish-style linkable reports). Results are cached by bundle content hash,
  so re-scanning an unchanged bundle is instant.

Complexity is explicitly *not* a constraint for this project. The tarnish
deployment stack (Celery/redis/S3/ElasticBeanstalk auto-scaling) is still
omitted — not for effort reasons but because a single Fastify process with
SQLite fully serves the use case; distributed job queuing adds operational
surface with no benefit here.

## 3. Inputs — the `Bundle` abstraction

All four input types normalize into one shape consumed by the engine:

```ts
type FileKind = 'background' | 'content' | 'popup' | 'options' | 'other';

interface Bundle {
  manifest: ParsedManifest;          // parsed + validated manifest.json
  files: Array<{
    path: string;
    bytes: Uint8Array;
    text?: string;                   // decoded if textual
    kind: FileKind;                  // derived from manifest references
  }>;
  listing?: {                        // present for webstore-url, or user-supplied
    title?: string;
    description?: string;
    screenshots?: string[];          // urls or count
    privacyPolicyUrl?: string;
    category?: string;
  };
  source: 'folder' | 'zip' | 'crx' | 'webstore-url';
}
```

Normalization per input type (all server-side):

- **Folder** (drag-drop directory upload) → read files in memory.
- **Zip** → unzip in memory.
- **CRX** → strip the CRX header, then treat the remainder as a zip.
- **Web Store URL** → derive the extension ID, download the CRX via Google's
  CRX download endpoint, unzip → same path as above. Additionally scrape the
  listing page for `listing` metadata (title, description, screenshot count,
  privacy-policy link) that local inputs lack.

## 4. Checker model

Every checker is a pure function `(bundle: Bundle) => Finding[]`, registered in
a catalog. The engine runs all registered checkers (each wrapped in try/catch),
then aggregates.

```ts
type Severity = 'blocker' | 'warning' | 'manual';

interface Finding {
  notificationId: string;      // e.g. 'Blue Argon'
  category: string;            // human label, e.g. 'Remote code (MV3)'
  severity: Severity;
  title: string;
  evidence?: Array<{ path: string; line?: number; snippet?: string }>;
  policyQuote: string;         // verbatim from the violations doc
  howToFix: string;            // actionable remediation
  source: 'native' | 'nuclei' | 'llm';
}
```

### Verdict aggregation

- **Likely Rejected** — at least one `blocker` finding.
- **At Risk** — only `warning` findings (no blockers).
- **Looks Clear (pending manual review)** — only `manual` findings remain.

The report also presents a **per-category breakdown** so the developer sees
exactly which policy each issue maps to, with counts by severity.

## 5. Checker catalog (initial set)

Grouped by how they run. Each maps to one or more notification IDs from the
violations doc.

### 5a. Code/manifest — deterministic, AST-based

- **Remote code / `eval` / `new Function`** (`Blue Argon`): detect
  `<script src="http…">`, `eval()`, `new Function(...)`, and execution of
  remotely fetched strings. AST + manifest scan. Severity: blocker.
- **Excessive & unused permissions** (`Purple Potassium`): parse
  `permissions` / `optional_permissions` / `host_permissions`; cross-reference
  against actual API usage in code; flag declared-but-unused permissions and
  map each to its install-time permission warning (tarnish concept). Severity:
  blocker for clearly-unused, warning for broad host wildcards.
- **Obfuscation** (`Red Titanium`): detect large base64 blobs, heavy
  `\u`/`\x` character-encoding, and decode-then-eval patterns. Severity:
  blocker.
- **Packaging / functionality** (`Yellow Magnesium`): manifest references files
  not present in the bundle; case-sensitivity mismatches between manifest
  paths and actual file names; missing declared icons. Severity: blocker.
- **Overrides-API circumvention** (`Blue Nickel` / `Blue Potassium`): detect
  New-Tab-Page or omnibox/search modification done without the Overrides API.
  Severity: warning.

### 5b. Security module (the two repos, native + optional Nuclei)

Native ports of the ChromeAudit/tarnish checks: missing CSP, `innerHTML` /
`document.write`, HTTP usage, manifest wildcards, `externally_connectable`,
`web_accessible_resources`, cross-origin `fetch`/CORS, known-vulnerable
libraries (Retire.js-style signature match). **Plus** an optional pass that
shells out to the real Nuclei binary with the ChromeAudit templates when the
binary is available; its results are merged and deduplicated against the native
findings. Severities mostly warning, except HTTP transmission of user data
(see 5c). When Nuclei is absent, the module reports "Nuclei not run" rather
than failing.

### 5c. Listing / privacy — need metadata, some need network

- **Missing / insufficient metadata** (`Yellow Zinc`): icon, title,
  screenshots, description present and non-trivial. Severity: blocker if
  missing, warning if thin.
- **Keyword stuffing** (`Yellow Argon`): repetition heuristics (same keyword
  >5×), lists of sites/regions without added value. Severity: warning.
- **Privacy policy** (`Purple Lithium`): if the extension handles sensitive
  data (inferred from permissions), require a privacy-policy URL that is
  present and reachable (server fetch). Severity: blocker when required and
  missing/unreachable.
- **Secure transmission** (`Purple Copper`): user data sent over HTTP, or
  encoded in URLs/headers. Severity: blocker.

### 5d. Subjective — rules backbone + optional Claude judge

These categories are genuinely judgment calls. Deterministic heuristics form
the backbone and always run; if a Claude API key is configured, an LLM pass
evaluates the subjective dimension and explains its reasoning. Without a key
these degrade to `manual` findings with the heuristic signal attached.

- **Deceptive description vs actual functionality** (`Red Nickel` /
  `Red Potassium` / `Red Silicon`).
- **Single-purpose coherence** (`Red Magnesium` / `Red Copper` / `Red Lithium`
  / `Red Argon`): also a deterministic check for multiple unrelated
  action-icon entry points.
- **Minimum functionality** (`Yellow Potassium`): e.g. bundle contains only a
  manifest, or functionality is just a link-out.

### 5e. Content-policy categories — manual (+ optional LLM signal)

Illegal activity, gambling, pornography, hate, violence, crypto mining,
prohibited products, affiliate-ads disclosure, deceptive installation, spam,
redirection. These are largely about *content/intent* and are surfaced as
`manual` review items with the policy text; the optional Claude judge may add a
signal where text is available (e.g. description analysis), but Verdikt does not
claim a deterministic verdict on them.

## 6. Data flow

```
client
  → POST /api/scan  (multipart file | { url } | { listing fields })
  → server normalizes to Bundle
  → engine runs all checkers (each sandboxed in try/catch)
  → optional Nuclei pass, results merged + deduped
  → optional Claude judge enriches subjective findings
  → aggregate into Report
  → persist Report to SQLite (keyed by content hash), assign report id
  → return Report JSON
client
  → GET /report/:id renders dashboard (also shareable)
```

## 7. Error handling & graceful degradation

- Corrupt zip, malformed CRX, invalid/missing manifest, unreachable URL,
  oversized upload → each produces a clear **report-level notice**, not a crash.
- Missing Nuclei binary or missing Claude key → those modules report
  "not run"; the scan still completes.
- A single checker throwing surfaces as one "could not evaluate" finding for
  that checker; all other checkers still run and aggregate normally.

## 8. Report dashboard (web)

- Top: overall verdict banner (Likely Rejected / At Risk / Looks Clear) with
  blocker/warning/manual counts.
- Per-category cards grouped by notification ID, each expandable to show
  findings, evidence (file + line + snippet, clickable), the verbatim policy
  quote, and how-to-fix.
- Source badges on findings (native / nuclei / llm).
- Shareable `/report/:id` link; "rescan" action.

## 9. Testing strategy (TDD)

- **Engine unit tests:** a fixture set of tiny extensions — one clean baseline,
  plus several that each deliberately trip exactly one checker. Per-checker
  assertions on emitted `Finding`s, and golden `Report` snapshots for the full
  fixtures.
- **Server integration tests:** one per input type (folder, zip, crx, url)
  using recorded fixtures (no live network in CI); CRX-header stripping and
  Web-Store-URL normalization covered explicitly.
- **Degradation tests:** Nuclei-absent and Claude-key-absent paths still
  produce a valid report; corrupt-input paths produce report-level notices.

## 10. Explicit scope decisions

- **In:** persistence + shareable report URLs (SQLite), full checker catalog,
  optional Nuclei integration, optional Claude judge, all four input types.
- **Out (v1):** Celery/redis/S3/auto-scaling (single Fastify process suffices);
  user accounts / authentication; historical report browsing UI beyond direct
  `/report/:id` links.

## 11. Repository layout

```
/                         (existing reference material stays in place)
  ChromeAudit/            reference: Nuclei templates (ported, not depended on)
  tarnish/                reference: concepts only
  Troubleshooting ...md   source of policy quotes
  docs/superpowers/specs/ this spec
  packages/
    engine/               pure analysis core
    server/               Fastify + SQLite + optional Nuclei/Claude
    web/                  React + Vite dashboard
```
