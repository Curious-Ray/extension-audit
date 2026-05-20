import { fromObject } from '../manifest.js';
import type { Bundle, BundleFile, ListingMetadata } from '../types.js';

const enc = new TextEncoder();

export function file(path: string, text: string): BundleFile {
  const kind = path.includes('content') ? 'content' : path.includes('background') ? 'background' : 'other';
  return { path, bytes: enc.encode(text), text, kind };
}

export function makeBundle(opts: {
  manifest: Record<string, unknown>;
  files?: BundleFile[];
  listing?: ListingMetadata;
  source?: Bundle['source'];
}): Bundle {
  const manifestText = JSON.stringify(opts.manifest);
  return {
    manifest: fromObject(opts.manifest),
    files: [file('manifest.json', manifestText), ...(opts.files ?? [])],
    listing: opts.listing,
    source: opts.source ?? 'zip',
  };
}

/** A minimal, clean MV3 extension that should trip no blockers. */
export function cleanManifest(): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: 'Tab Counter',
    description: 'Shows how many tabs you currently have open in a small badge on the toolbar icon.',
    version: '1.0.0',
    permissions: ['tabs'],
    action: { default_popup: 'popup.html' },
    background: { service_worker: 'bg.js' },
    icons: { '16': 'icon16.png' },
  };
}
