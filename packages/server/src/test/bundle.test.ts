import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { buildBundle, unzip } from '../bundle/build.js';
import { crxToZip } from '../bundle/crx.js';
import { extensionIdFromUrl, crxDownloadUrl } from '../bundle/webstore.js';

function makeZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(files)) entries[k] = strToU8(v);
  return zipSync(entries);
}

const manifest = JSON.stringify({
  manifest_version: 3,
  name: 'Test',
  description: 'A test extension that does a thing.',
  permissions: ['tabs'],
  background: { service_worker: 'bg.js' },
  content_scripts: [{ js: ['content.js'], matches: ['<all_urls>'] }],
});

describe('zip -> bundle', () => {
  it('builds a bundle and derives file kinds', () => {
    const zip = makeZip({
      'manifest.json': manifest,
      'bg.js': 'chrome.tabs.query({})',
      'content.js': 'console.log("cs")',
    });
    const bundle = buildBundle(unzip(zip), 'zip');
    expect(bundle.manifest.name).toBe('Test');
    expect(bundle.files.find((f) => f.path === 'bg.js')?.kind).toBe('service_worker');
    expect(bundle.files.find((f) => f.path === 'content.js')?.kind).toBe('content');
    expect(bundle.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles a nested root folder (strips prefix)', () => {
    const zip = makeZip({
      'my-ext/manifest.json': manifest,
      'my-ext/bg.js': 'x',
      'my-ext/content.js': 'y',
    });
    const bundle = buildBundle(unzip(zip), 'zip');
    expect(bundle.files.some((f) => f.path === 'bg.js')).toBe(true);
  });

  it('throws a BundleError when manifest is missing', () => {
    const zip = makeZip({ 'readme.txt': 'hi' });
    expect(() => buildBundle(unzip(zip), 'zip')).toThrow(/manifest/i);
  });
});

describe('crx -> zip', () => {
  it('passes through a plain zip (PK header)', () => {
    const zip = makeZip({ 'manifest.json': manifest });
    const out = crxToZip(zip);
    expect(out[0]).toBe(0x50); // 'P'
  });

  it('strips a CRX3 header', () => {
    const zip = makeZip({ 'manifest.json': manifest });
    const header = strToU8('HEADERDATA'); // 10 bytes of fake header
    const crx = new Uint8Array(12 + header.length + zip.length);
    const dv = new DataView(crx.buffer);
    crx.set(strToU8('Cr24'), 0);
    dv.setUint32(4, 3, true); // version 3
    dv.setUint32(8, header.length, true);
    crx.set(header, 12);
    crx.set(zip, 12 + header.length);
    const out = crxToZip(crx);
    const bundle = buildBundle(unzip(out), 'crx');
    expect(bundle.manifest.name).toBe('Test');
  });
});

describe('webstore url parsing', () => {
  it('extracts the extension id from a new-style URL', () => {
    const id = extensionIdFromUrl(
      'https://chromewebstore.google.com/detail/some-slug/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(id).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  });

  it('builds a crx download url containing the id', () => {
    const url = crxDownloadUrl('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(url).toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(url).toContain('clients2.google.com');
  });
});
