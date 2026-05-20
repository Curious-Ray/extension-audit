import { scan as engineScan } from '@verdikt/engine';
import type { Bundle, ListingMetadata, Report } from '@verdikt/engine';
import { bundleFromFile, buildBundle, crxToZip, unzip, BundleError } from './bundle.js';

/**
 * Base URL of the Cloudflare Worker fetch-proxy (set at build time via
 * VITE_PROXY_URL). When unset, Web Store URL scanning is unavailable because
 * the browser can't fetch the CRX/listing cross-origin on its own.
 */
export const PROXY_URL: string | undefined =
  (import.meta.env.VITE_PROXY_URL as string | undefined)?.replace(/\/$/, '') || undefined;

export const urlScanAvailable = Boolean(PROXY_URL);

const ID_RE = /\b([a-p]{32})\b/;

function extensionId(input: string): string {
  const m = input.match(ID_RE);
  if (!m) throw new BundleError('Could not find a 32-character extension ID in that URL.');
  return m[1]!;
}

/** Run the full audit on an already-built bundle, entirely in the browser. */
async function runScan(bundle: Bundle): Promise<{ id: string; report: Report }> {
  const report = await engineScan(bundle);
  report.notices.push({
    level: 'info',
    message: 'Audit ran entirely in your browser — your extension was not uploaded to any server.',
  });
  return { id: crypto.randomUUID(), report };
}

/** Audit an uploaded .zip/.crx file. */
export async function scanFile(file: File, listing?: ListingMetadata): Promise<{ id: string; report: Report }> {
  return runScan(await bundleFromFile(file, listing));
}

/** Audit a published extension by Web Store URL, via the Worker proxy. */
export async function scanUrl(url: string, listingOverride?: ListingMetadata): Promise<{ id: string; report: Report }> {
  if (!PROXY_URL) {
    throw new BundleError('Web Store URL scanning is not configured for this deployment. Upload a .zip/.crx instead.');
  }
  const id = extensionId(url);

  const crxRes = await fetch(`${PROXY_URL}/crx?id=${id}`);
  if (!crxRes.ok) {
    throw new BundleError(`Couldn't download the extension (HTTP ${crxRes.status}). It may be unlisted or removed.`);
  }
  const crxBytes = new Uint8Array(await crxRes.arrayBuffer());
  const fileMap = unzip(crxToZip(crxBytes));

  let listing: ListingMetadata | undefined;
  try {
    const lRes = await fetch(`${PROXY_URL}/listing?id=${id}`);
    if (lRes.ok) listing = (await lRes.json()) as ListingMetadata;
  } catch {
    // listing is best-effort
  }
  if (listingOverride) listing = { ...listing, ...listingOverride };

  return runScan(buildBundle(fileMap, 'webstore-url', listing));
}

export { BundleError };
