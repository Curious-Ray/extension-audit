import type { ListingInput, ScanResult } from './types.js';

async function handle(res: Response): Promise<ScanResult> {
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data as ScanResult;
}

/** Scan an uploaded file (zip/crx), with optional listing metadata. */
export async function scanFile(file: File, listing?: ListingInput): Promise<ScanResult> {
  const form = new FormData();
  form.append('file', file);
  if (listing) form.append('listing', JSON.stringify(listing));
  return handle(await fetch('/api/scan', { method: 'POST', body: form }));
}

/** Scan a published extension by Web Store URL. */
export async function scanUrl(url: string, listing?: ListingInput): Promise<ScanResult> {
  return handle(
    await fetch('/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, listing }),
    }),
  );
}

/** Fetch a previously-generated report by id. */
export async function getReport(id: string): Promise<ScanResult> {
  const res = await fetch(`/api/report/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? 'Report not found');
  return { id: data.id, report: data.report };
}
