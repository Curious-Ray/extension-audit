// The audit runs in the browser. These wrappers keep a stable surface for the
// UI components while delegating to the client-side engine (lib/scan.ts).
import type { ListingInput, ScanResult } from './types.js';
import { scanFile as clientScanFile, scanUrl as clientScanUrl, urlScanAvailable } from './lib/scan.js';

export { urlScanAvailable };

export async function scanFile(file: File, listing?: ListingInput): Promise<ScanResult> {
  return clientScanFile(file, listing);
}

export async function scanUrl(url: string, listing?: ListingInput): Promise<ScanResult> {
  return clientScanUrl(url.trim(), listing);
}
