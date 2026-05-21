/**
 * Verdikt fetch-proxy — a tiny Cloudflare Worker.
 *
 * The browser can't fetch a Chrome Web Store CRX or listing page directly
 * (cross-origin / no CORS headers from Google). This Worker does that fetch and
 * relays the bytes back with permissive CORS, so the static web app can run the
 * whole audit client-side. It performs NO analysis — it only relays bytes.
 *
 * Routes:
 *   GET /crx?id=<extId>      -> the CRX file bytes (application/octet-stream)
 *   GET /listing?id=<extId>  -> { title, description, screenshotCount, iconPresent }
 *
 * <extId> is the 32-char [a-p] extension ID.
 */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const ID_RE = /^[a-p]{32}$/;

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const id = url.searchParams.get('id') ?? '';
    if (!ID_RE.test(id)) return json({ error: 'Invalid or missing extension id.' }, 400);

    try {
      if (url.pathname === '/crx') return await fetchCrx(id);
      if (url.pathname === '/listing') return await fetchListing(id);
      return json({ error: 'Not found. Use /crx?id= or /listing?id=.' }, 404);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'Proxy error' }, 502);
    }
  },
};

function crxDownloadUrl(id: string): string {
  const x = `id=${id}&installsource=ondemand&uc`;
  // prodversion must be high — a low value makes the update endpoint reply 204
  // ("you're up to date") instead of redirecting to the CRX.
  return (
    'https://clients2.google.com/service/update2/crx' +
    `?response=redirect&acceptformat=crx2,crx3&prodversion=9999.0&x=${encodeURIComponent(x)}`
  );
}

async function fetchCrx(id: string): Promise<Response> {
  const res = await fetch(crxDownloadUrl(id), { redirect: 'follow' });
  if (!res.ok || !res.body || res.status === 204) {
    // Always use a 5xx status here — never pass through a 204, which legally
    // cannot carry the JSON error body.
    return json({ error: `CRX download failed (HTTP ${res.status}). The extension may be unlisted or removed.` }, 502);
  }
  return new Response(res.body, {
    headers: { ...CORS, 'content-type': 'application/octet-stream', 'cache-control': 'public, max-age=3600' },
  });
}

async function fetchListing(id: string): Promise<Response> {
  const res = await fetch(`https://chromewebstore.google.com/detail/${id}`, {
    redirect: 'follow',
    headers: { 'accept-language': 'en-US,en;q=0.9' },
  });
  const html = await res.text();
  const listing = {
    title: meta(html, 'og:title') ?? tag(html, /<title>([^<]+)<\/title>/i),
    description: meta(html, 'og:description') ?? meta(html, 'description'),
    screenshotCount: (html.match(/property=["']og:image["']/g) ?? []).length || undefined,
    iconPresent: /og:image/.test(html),
  };
  return json(listing, 200, 'public, max-age=3600');
}

function meta(html: string, name: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapeRe(name)}["'][^>]+content=["']([^"']+)["']`,
    'i',
  );
  return html.match(re)?.[1]?.trim();
}
function tag(html: string, re: RegExp): string | undefined {
  return html.match(re)?.[1]?.trim();
}
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function json(body: unknown, status = 200, cache?: string): Response {
  const headers: Record<string, string> = { ...CORS, 'content-type': 'application/json' };
  if (cache) headers['cache-control'] = cache;
  return new Response(JSON.stringify(body), { status, headers });
}
