# Verdikt

Predicts whether a Chrome extension would be **rejected by the Chrome Web Store**
— before you submit. Verdikt maps your extension against the official Web Store
violation categories (each tagged with its notification ID, e.g. `Blue Argon`,
`Purple Potassium`, `Yellow Zinc`) and returns a verdict with per-category
findings, evidence, the verbatim policy, and how to fix each issue.

It draws on two reference security tools shipped in this repo — the **ChromeAudit**
Nuclei templates and the **tarnish** static analyzer — but is organized around
*store-policy rejection reasons*, not just security, because that's what actually
gets extensions rejected.

## Architecture

A TypeScript monorepo (npm workspaces):

| Package | Role |
|---|---|
| `packages/engine` | Pure, I/O-free analysis core. `Bundle → Report`. Fully unit-tested. |
| `packages/server` | Fastify + SQLite. Normalizes input (folder/zip/crx/URL), runs the engine, optional Nuclei + Claude modules, caches & serves reports. |
| `packages/web` | React + Vite report dashboard. |

### Verdict model

Every finding is `blocker` / `warning` / `manual`. The overall verdict:

- **Likely Rejected** — any blocker.
- **At Risk** — warnings only.
- **Looks Clear** — only manual-review items remain.

## Running

```bash
npm install

# Terminal 1 — API (port 5174)
npm run dev:server

# Terminal 2 — web UI (port 5173, proxies /api to 5174)
npm run dev:web
```

Or single-process production mode (server serves the built UI):

```bash
npm run build
node packages/server/dist/index.js   # http://localhost:5174
```

## Configuration (env vars, all optional)

| Var | Effect |
|---|---|
| `PORT` | Server port (default `5174`). |
| `VERDIKT_DB` | SQLite path (default `verdikt.sqlite`; `:memory:` for ephemeral). |
| `MAX_UPLOAD_BYTES` | Upload size limit (default 64 MB). |
| `NUCLEI_TEMPLATES_DIR` | Path to the `ChromeAudit/` templates. Enables the optional Nuclei security pass (requires the `nuclei` binary on PATH). |
| `ANTHROPIC_API_KEY` | Enables the optional Claude judge for subjective categories (deceptive description, single purpose, minimum functionality). |
| `VERDIKT_CLAUDE_MODEL` | Override the Claude model (default `claude-opus-4-7`). |

Without the optional vars, Verdikt runs rules-only and notes in each report
which modules were skipped.

## Inputs

- **Upload** a `.zip` or `.crx` (CRX2/CRX3 headers are stripped automatically).
- **Web Store URL** or bare extension ID — Verdikt downloads the published CRX
  and scrapes listing metadata.
- **Listing metadata** (title / description / privacy-policy URL) can be
  supplied to unlock the metadata and privacy checks for local packages.

## Testing

```bash
npm test          # engine + server suites
```

## What's deliberately out of scope (v1)

User accounts, the tarnish-style Celery/redis/S3 auto-scaling stack (a single
Fastify process suffices), and a historical report-browsing UI beyond direct
`/report/:id` links.
