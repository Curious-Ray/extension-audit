import { unzipSync, strFromU8 } from 'fflate';
import { createHash } from 'node:crypto';
import { fromObject } from '@verdikt/engine';
import type { Bundle, BundleFile, BundleSource, FileKind, ListingMetadata } from '@verdikt/engine';

const TEXT_EXT = /\.(js|mjs|json|html|htm|css|txt|md|svg|xml)$/i;

/** Build a Bundle from a map of path -> bytes (already unzipped). */
export function buildBundle(
  fileMap: Record<string, Uint8Array>,
  source: BundleSource,
  listing?: ListingMetadata,
): Bundle {
  const manifestEntry = findManifest(fileMap);
  if (!manifestEntry) {
    throw new BundleError('No manifest.json found in the package.');
  }
  const [manifestPath, manifestBytes] = manifestEntry;
  const prefix = manifestPath.slice(0, manifestPath.length - 'manifest.json'.length);

  let manifestRaw: Record<string, unknown>;
  try {
    manifestRaw = JSON.parse(strFromU8(manifestBytes)) as Record<string, unknown>;
  } catch (err) {
    throw new BundleError(`manifest.json is not valid JSON: ${(err as Error).message}`);
  }
  const manifest = fromObject(manifestRaw);

  const kindOf = makeKindResolver(manifestRaw);
  const files: BundleFile[] = [];
  for (const [rawPath, bytes] of Object.entries(fileMap)) {
    if (rawPath.endsWith('/')) continue; // directory entry
    // Strip the common prefix so paths are relative to the manifest root.
    const path = rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : rawPath;
    const file: BundleFile = { path, bytes, kind: kindOf(path) };
    if (TEXT_EXT.test(path)) file.text = strFromU8(bytes);
    files.push(file);
  }

  const contentHash = createHash('sha256');
  for (const f of files.sort((a, b) => a.path.localeCompare(b.path))) {
    contentHash.update(f.path);
    contentHash.update(f.bytes);
  }

  return { manifest, files, listing, source, contentHash: contentHash.digest('hex') };
}

/** Unzip raw zip bytes into a path->bytes map. */
export function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  try {
    return unzipSync(bytes);
  } catch (err) {
    throw new BundleError(`Could not unzip the package: ${(err as Error).message}`);
  }
}

function findManifest(fileMap: Record<string, Uint8Array>): [string, Uint8Array] | null {
  // Prefer a top-level manifest.json; otherwise the shallowest one.
  let best: [string, Uint8Array] | null = null;
  let bestDepth = Infinity;
  for (const [path, bytes] of Object.entries(fileMap)) {
    if (/(^|\/)manifest\.json$/i.test(path)) {
      const depth = path.split('/').length;
      if (depth < bestDepth) {
        best = [path, bytes];
        bestDepth = depth;
      }
    }
  }
  return best;
}

/** Resolve a file's role from the manifest's references. */
function makeKindResolver(raw: Record<string, unknown>): (path: string) => FileKind {
  const background = new Set<string>();
  const content = new Set<string>();
  const popup = new Set<string>();
  const options = new Set<string>();

  const bg = raw.background as Record<string, unknown> | undefined;
  if (bg) {
    if (typeof bg.service_worker === 'string') background.add(norm(bg.service_worker));
    if (typeof bg.page === 'string') background.add(norm(bg.page));
    if (Array.isArray(bg.scripts)) bg.scripts.forEach((s) => typeof s === 'string' && background.add(norm(s)));
  }
  if (Array.isArray(raw.content_scripts)) {
    for (const cs of raw.content_scripts as Array<Record<string, unknown>>) {
      if (Array.isArray(cs.js)) cs.js.forEach((s) => typeof s === 'string' && content.add(norm(s)));
    }
  }
  const action = (raw.action ?? raw.browser_action ?? raw.page_action) as Record<string, unknown> | undefined;
  if (action && typeof action.default_popup === 'string') popup.add(norm(action.default_popup));
  const optionsUi = raw.options_ui as Record<string, unknown> | undefined;
  if (optionsUi && typeof optionsUi.page === 'string') options.add(norm(optionsUi.page));
  if (typeof raw.options_page === 'string') options.add(norm(raw.options_page));

  const isSw = bg && typeof bg.service_worker === 'string';

  return (path: string): FileKind => {
    const p = norm(path);
    if (background.has(p)) return isSw && p === norm(String(bg!.service_worker)) ? 'service_worker' : 'background';
    if (content.has(p)) return 'content';
    if (popup.has(p)) return 'popup';
    if (options.has(p)) return 'options';
    return 'other';
  };
}

function norm(p: string): string {
  return p.replace(/^\.?\//, '').replace(/\\/g, '/');
}

export class BundleError extends Error {}
