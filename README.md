# Verdikt

Predicts whether a Chrome extension would be **rejected by the Chrome Web Store**
— before you submit. Verdikt maps your extension against the official Web Store
violation categories (each tagged with its notification ID, e.g. `Blue Argon`,
`Purple Potassium`, `Yellow Zinc`) and returns a verdict with per-category
findings, evidence, the verbatim policy, and how to fix each issue.

It draws on ideas from existing extension security tools (Nuclei-style regex
checks, tarnish-style static analysis) but is organized around *store-policy
rejection reasons*, not just security, because that's what actually gets
extensions rejected.

## Architecture

A TypeScript monorepo (npm workspaces):

| Package | Role |
|---|---|
| `packages/engine` | Pure, I/O-free analysis core. `Bundle → Report`. Fully unit-tested. Runs in Node **and** the browser. |
| `packages/web` | React + Vite app that runs the engine **client-side** — uploads are unzipped and audited entirely in the browser (nothing is sent anywhere). Deploys static to GitHub Pages. |
| `packages/worker` | Tiny Cloudflare Worker that relays the CRX + listing for Web Store **URL** scanning (the only thing a browser can't fetch cross-origin). Optional. |
| `packages/server` | Full Fastify + SQLite alternative: server-side scanning, content-hash caching, shareable `/report/:id` links, optional Claude judge. Use when you want those extras instead of the static build. |

### Verdict model

Every finding is `blocker` / `warning` / `manual`. The overall verdict:

- **Likely Rejected** — any blocker.
- **At Risk** — warnings only.
- **Looks Clear** — only manual-review items remain.

## Running (static / client-side — the default)

```bash
npm install
npm run build --workspace @verdikt/engine   # web imports the built engine
npm run dev:web                              # http://localhost:5173
```

The audit runs in the browser. Upload a `.zip`/`.crx` and it's analyzed locally.
Web Store **URL** scanning needs the Worker (below) — without it, the URL tab is
hidden and upload still works.

## Deploying to GitHub Pages

The repo includes `.github/workflows/pages.yml`, which builds the web app and
deploys it on every push to `master`/`main`.

1. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push. The site goes live at `https://<user>.github.io/extension-audit/`.

The workflow sets `VITE_BASE=/extension-audit/`. To enable URL scanning, deploy
the Worker and add its URL as a repo **variable** named `VITE_PROXY_URL`
(**Settings → Secrets and variables → Actions → Variables**).

### Deploy the Worker (optional — enables URL scanning)

```bash
cd packages/worker
npm install
npx wrangler login
npx wrangler deploy        # prints a https://verdikt-proxy.<you>.workers.dev URL
```

Set that URL as the `VITE_PROXY_URL` repo variable (for Pages) or in
`packages/web/.env` as `VITE_PROXY_URL=...` (for local dev). The Worker only
relays the CRX + listing bytes the browser can't fetch cross-origin; the audit
still runs client-side.

## Full server mode (optional alternative)

For server-side scanning, content-hash caching, and shareable `/report/:id`
links:

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
| `ANTHROPIC_API_KEY` | Enables the optional Claude judge for subjective categories (deceptive description, single purpose, minimum functionality). |
| `VERDIKT_CLAUDE_MODEL` | Override the Claude model (default `claude-opus-4-7`). |

Without `ANTHROPIC_API_KEY`, Verdikt runs rules-only and notes in each report
that the subjective LLM judge was skipped.

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
