import { describe, it, expect } from 'vitest';
import { scan } from '../index.js';
import { remoteCodeChecker } from '../checkers/remote-code.js';
import { permissionsChecker } from '../checkers/permissions.js';
import { obfuscationChecker } from '../checkers/obfuscation.js';
import { packagingChecker } from '../checkers/packaging.js';
import { metadataChecker } from '../checkers/metadata.js';
import { privacyChecker } from '../checkers/privacy.js';
import { minimumFunctionalityChecker } from '../checkers/minimum-functionality.js';
import { file, makeBundle, cleanManifest } from './helpers.js';

describe('remote-code (Blue Argon)', () => {
  it('flags eval as a blocker on MV3', () => {
    const b = makeBundle({
      manifest: cleanManifest(),
      files: [file('bg.js', 'const x = eval("1+1");'), file('popup.html', '<html></html>')],
    });
    const findings = remoteCodeChecker.run(b) as any[];
    expect(findings.some((f) => f.severity === 'blocker' && f.notificationId === 'Blue Argon')).toBe(true);
  });

  it('flags remote <script src> in html', () => {
    const b = makeBundle({
      manifest: cleanManifest(),
      files: [file('popup.html', '<script src="https://cdn.evil.com/a.js"></script>')],
    });
    const findings = remoteCodeChecker.run(b) as any[];
    expect(findings.some((f) => f.title.includes('Remote <script'))).toBe(true);
  });

  it('does not flag clean code', () => {
    const b = makeBundle({ manifest: cleanManifest(), files: [file('bg.js', 'console.log(chrome.tabs);')] });
    expect((remoteCodeChecker.run(b) as any[]).length).toBe(0);
  });
});

describe('permissions (Purple Potassium)', () => {
  it('flags declared-but-unused permission as blocker', () => {
    const m = cleanManifest();
    m.permissions = ['tabs', 'cookies'];
    const b = makeBundle({ manifest: m, files: [file('bg.js', 'chrome.tabs.query({});')] });
    const findings = permissionsChecker.run(b) as any[];
    expect(findings.some((f) => f.title.includes('cookies') && f.severity === 'blocker')).toBe(true);
  });

  it('does not flag a used permission', () => {
    const b = makeBundle({ manifest: cleanManifest(), files: [file('bg.js', 'chrome.tabs.query({});')] });
    const findings = permissionsChecker.run(b) as any[];
    expect(findings.some((f) => f.title.includes('tabs') && f.severity === 'blocker')).toBe(false);
  });

  it('warns on broad host permissions', () => {
    const m = cleanManifest();
    m.host_permissions = ['<all_urls>'];
    const b = makeBundle({ manifest: m, files: [file('bg.js', 'chrome.tabs.query({});')] });
    const findings = permissionsChecker.run(b) as any[];
    expect(findings.some((f) => f.severity === 'warning')).toBe(true);
  });
});

describe('obfuscation (Red Titanium)', () => {
  it('flags decode-then-eval as blocker', () => {
    const b = makeBundle({
      manifest: cleanManifest(),
      files: [file('bg.js', 'eval(atob("YWxlcnQoMSk="));')],
    });
    const findings = obfuscationChecker.run(b) as any[];
    expect(findings.some((f) => f.severity === 'blocker')).toBe(true);
  });
});

describe('packaging (Yellow Magnesium)', () => {
  it('flags a manifest-referenced file that is missing', () => {
    const b = makeBundle({ manifest: cleanManifest(), files: [file('bg.js', 'x')] });
    // popup.html and icon16.png are referenced but absent
    const findings = packagingChecker.run(b) as any[];
    expect(findings.some((f) => f.title.includes('popup.html'))).toBe(true);
  });

  it('flags case mismatch', () => {
    const b = makeBundle({
      manifest: cleanManifest(),
      files: [file('bg.js', 'x'), file('Popup.html', '<html>'), file('icon16.png', '')],
    });
    const findings = packagingChecker.run(b) as any[];
    expect(findings.some((f) => f.title.toLowerCase().includes('case mismatch'))).toBe(true);
  });
});

describe('metadata (Yellow Zinc / Yellow Argon)', () => {
  it('blocks on missing description', () => {
    const b = makeBundle({
      manifest: cleanManifest(),
      listing: { title: 'X', description: '', screenshotCount: 1, iconPresent: true },
    });
    const findings = metadataChecker.run(b) as any[];
    expect(findings.some((f) => f.severity === 'blocker' && f.title.includes('description'))).toBe(true);
  });

  it('warns on keyword stuffing', () => {
    const stuffed = 'translate translate translate translate translate translate words fast';
    const b = makeBundle({
      manifest: cleanManifest(),
      listing: { title: 'T', description: stuffed, screenshotCount: 2, iconPresent: true },
    });
    const findings = metadataChecker.run(b) as any[];
    expect(findings.some((f) => f.notificationId === 'Yellow Argon')).toBe(true);
  });
});

describe('privacy (Purple Lithium / Copper)', () => {
  it('flags http transmission as blocker', async () => {
    const b = makeBundle({
      manifest: cleanManifest(),
      files: [file('bg.js', 'fetch("http://api.example.com/track")')],
    });
    const findings = (await privacyChecker.run(b)) as any[];
    expect(findings.some((f) => f.notificationId === 'Purple Copper' && f.severity === 'blocker')).toBe(true);
  });

  it('requires privacy policy when sensitive perms + listing present', async () => {
    const m = cleanManifest();
    m.permissions = ['cookies'];
    const b = makeBundle({
      manifest: m,
      files: [file('bg.js', 'chrome.cookies.get({})')],
      listing: { title: 'T', description: 'desc that is long enough here', screenshotCount: 1, iconPresent: true },
    });
    const findings = (await privacyChecker.run(b)) as any[];
    expect(findings.some((f) => f.notificationId === 'Purple Lithium' && f.severity === 'blocker')).toBe(true);
  });
});

describe('minimum-functionality (Yellow Potassium)', () => {
  it('flags manifest-only package', () => {
    const b = makeBundle({ manifest: cleanManifest() });
    const findings = minimumFunctionalityChecker.run(b) as any[];
    expect(findings.some((f) => f.severity === 'blocker')).toBe(true);
  });
});

describe('full scan + verdict', () => {
  it('clean extension with full listing is not likely_rejected', async () => {
    const b = makeBundle({
      manifest: cleanManifest(),
      files: [
        file('bg.js', 'chrome.tabs.onUpdated.addListener(() => chrome.action.setBadgeText({text:"1"}));'),
        file('popup.html', '<!doctype html><html><body>Tabs</body></html>'),
        file('icon16.png', 'PNGDATA'),
      ],
      listing: {
        title: 'Tab Counter',
        description: 'Shows how many tabs you currently have open in a small badge on the toolbar icon.',
        screenshotCount: 2,
        iconPresent: true,
      },
    });
    const report = await scan(b);
    expect(report.verdict).not.toBe('likely_rejected');
    expect(report.counts.blocker).toBe(0);
  });

  it('an extension with eval + unused perm + missing files is likely_rejected', async () => {
    const m = cleanManifest();
    m.permissions = ['tabs', 'history'];
    const b = makeBundle({
      manifest: m,
      files: [file('bg.js', 'eval(atob("eA=="))')],
    });
    const report = await scan(b);
    expect(report.verdict).toBe('likely_rejected');
    expect(report.counts.blocker).toBeGreaterThan(0);
    // categories grouped
    expect(report.categories.length).toBeGreaterThan(0);
  });
});
