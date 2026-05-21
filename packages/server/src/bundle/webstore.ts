import type { Bundle, ListingMetadata } from '@verdikt/engine';
import { buildBundle, unzip, BundleError } from './build.js';
import { crxToZip } from './crx.js';

const ID_RE = /\b([a-p]{32})\b/;

/** Extract the 32-char extension ID from a Web Store URL (or a bare ID). */
export function extensionIdFromUrl(input: string): string {
  const m = input.match(ID_RE);
  if (!m) throw new BundleError('Could not find a 32-character extension ID in the URL.');
  return m[1]!;
}

/** Build the Google CRX download URL for an extension ID. */
export function crxDownloadUrl(id: string, prodversion = '9999.0'): string {
  const x = `id=${id}&installsource=ondemand&uc`;
  return (
    'https://clients2.google.com/service/update2/crx' +
    `?response=redirect&acceptformat=crx2,crx3&prodversion=${prodversion}&x=${encodeURIComponent(x)}`
  );
}

/** Fetch a published extension by Web Store URL and normalize it into a Bundle. */
export async function bundleFromWebStore(
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Bundle> {
  const id = extensionIdFromUrl(url);

  const crxRes = await fetchImpl(crxDownloadUrl(id), { redirect: 'follow' });
  if (!crxRes.ok) {
    throw new BundleError(`Failed to download CRX (HTTP ${crxRes.status}). The extension may be unlisted or removed.`);
  }
  const crxBytes = new Uint8Array(await crxRes.arrayBuffer());
  const zipBytes = crxToZip(crxBytes);
  const fileMap = unzip(zipBytes);

  let listing: ListingMetadata | undefined;
  try {
    listing = await scrapeListing(id, fetchImpl);
  } catch {
    // Listing scrape is best-effort; a scan still proceeds without it.
    listing = undefined;
  }

  return buildBundle(fileMap, 'webstore-url', listing);
}

/** Best-effort scrape of the public listing page for metadata. */
export async function scrapeListing(
  id: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ListingMetadata> {
  const res = await fetchImpl(`https://chromewebstore.google.com/detail/${id}`, {
    redirect: 'follow',
    headers: { 'accept-language': 'en-US,en;q=0.9' },
  });
  const html = await res.text();

  const title = meta(html, 'og:title') ?? tag(html, /<title>([^<]+)<\/title>/i);
  const description = meta(html, 'og:description') ?? meta(html, 'description');
  // Screenshot count: count og:image occurrences as a rough proxy.
  const screenshotCount = (html.match(/property=["']og:image["']/g) ?? []).length || undefined;

  return {
    title: title?.trim(),
    description: description?.trim(),
    screenshotCount,
    iconPresent: /og:image/.test(html),
  };
}

function meta(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeRe(name)}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  return html.match(re)?.[1];
}

function tag(html: string, re: RegExp): string | undefined {
  return html.match(re)?.[1];
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
