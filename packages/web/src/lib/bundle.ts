import { unzipSync, strFromU8 } from 'fflate';
import { fromObject } from '@verdikt/engine';
import type { Bundle, BundleFile, BundleSource, FileKind, ListingMetadata } from '@verdikt/engine';

const TEXT_EXT = /\.(js|mjs|json|html?|css|txt|md|svg|xml)$/i;

export class BundleError extends Error {}

/** Unzip raw zip bytes into a path -> bytes map (runs in the browser). */
export function unzip(bytes: Uint8Array): Record<string, Uint8Array> {
  try {
    return unzipSync(bytes);
  } catch (err) {
    throw new BundleError(`Could not unzip the package: ${(err as Error).message}`);
  }
}

/**
 * Strip a CRX header and return the embedded ZIP bytes (CRX2 + CRX3). If the
 * input already looks like a plain ZIP (PK signature), it is returned as-is.
 */
export function crxToZip(input: Uint8Array): Uint8Array {
  if (input.length < 16) throw new BundleError('File is too small to be a CRX.');
  const magic = String.fromCharCode(input[0]!, input[1]!, input[2]!, input[3]!);
  if (magic !== 'Cr24') {
    if (input[0] === 0x50 && input[1] === 0x4b) return input; // PK = zip
    throw new BundleError('Not a CRX file (missing "Cr24" magic).');
  }
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const version = view.getUint32(4, true);
  let zipStart: number;
  if (version === 2) {
    zipStart = 16 + view.getUint32(8, true) + view.getUint32(12, true);
  } else if (version === 3) {
    zipStart = 12 + view.getUint32(8, true);
  } else {
    throw new BundleError(`Unsupported CRX version: ${version}`);
  }
  if (zipStart >= input.length) throw new BundleError('CRX header length exceeds file size.');
  return input.subarray(zipStart);
}

/** Build an engine Bundle from unzipped files. */
export function buildBundle(
  fileMap: Record<string, Uint8Array>,
  source: BundleSource,
  listing?: ListingMetadata,
): Bundle {
  const manifestEntry = findManifest(fileMap);
  if (!manifestEntry) throw new BundleError('No manifest.json found in the package.');
  const [manifestPath, manifestBytes] = manifestEntry;
  const prefix = manifestPath.slice(0, manifestPath.length - 'manifest.json'.length);

  let manifestRaw: Record<string, unknown>;
  try {
    manifestRaw = JSON.parse(strFromU8(manifestBytes)) as Record<string, unknown>;
  } catch (err) {
    throw new BundleError(`manifest.json is not valid JSON: ${(err as Error).message}`);
  }

  const kindOf = makeKindResolver(manifestRaw);
  const files: BundleFile[] = [];
  for (const [rawPath, bytes] of Object.entries(fileMap)) {
    if (rawPath.endsWith('/')) continue;
    const path = rawPath.startsWith(prefix) ? rawPath.slice(prefix.length) : rawPath;
    const file: BundleFile = { path, bytes, kind: kindOf(path) };
    if (TEXT_EXT.test(path)) file.text = strFromU8(bytes);
    files.push(file);
  }

  return { manifest: fromObject(manifestRaw), files, listing, source };
}

/** Build a Bundle directly from an uploaded File (zip or crx). */
export async function bundleFromFile(file: File, listing?: ListingMetadata): Promise<Bundle> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isCrx = file.name.toLowerCase().endsWith('.crx') || (bytes[0] === 0x43 && bytes[1] === 0x72);
  const zip = isCrx ? crxToZip(bytes) : bytes;
  return buildBundle(unzip(zip), isCrx ? 'crx' : 'zip', listing);
}

function findManifest(fileMap: Record<string, Uint8Array>): [string, Uint8Array] | null {
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

function makeKindResolver(raw: Record<string, unknown>): (path: string) => FileKind {
  const background = new Set<string>();
  const content = new Set<string>();
  const popup = new Set<string>();
  const options = new Set<string>();

  const bg = raw.background as Record<string, unknown> | undefined;
  let swPath: string | undefined;
  if (bg) {
    if (typeof bg.service_worker === 'string') { swPath = norm(bg.service_worker); background.add(swPath); }
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

  return (path: string): FileKind => {
    const p = norm(path);
    if (background.has(p)) return swPath && p === swPath ? 'service_worker' : 'background';
    if (content.has(p)) return 'content';
    if (popup.has(p)) return 'popup';
    if (options.has(p)) return 'options';
    return 'other';
  };
}

function norm(p: string): string {
  return p.replace(/^\.?\//, '').replace(/\\/g, '/');
}
