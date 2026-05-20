import { scan } from '@verdikt/engine';
import type { Bundle, Checker, CheckerContext, ListingMetadata, Report } from '@verdikt/engine';
import { buildBundle, unzip, BundleError } from './bundle/build.js';
import { crxToZip } from './bundle/crx.js';
import { bundleFromWebStore } from './bundle/webstore.js';
import { makeLlmJudge } from './modules/llm-judge.js';
import type { ReportStore } from './store.js';

export interface ScanServiceConfig {
  store: ReportStore;
  /** Claude API key; enables the subjective LLM judge if set. */
  claudeApiKey?: string;
  claudeModel?: string;
}

export interface ScanResult {
  id: string;
  report: Report;
  cached: boolean;
}

/** Reachability probe used by the privacy checker for privacy-policy URLs. */
const ctx: CheckerContext = {
  async isUrlReachable(url: string): Promise<boolean> {
    try {
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
      return res.ok || res.status === 405; // some servers reject HEAD but exist
    } catch {
      return false;
    }
  },
};

export class ScanService {
  constructor(private cfg: ScanServiceConfig) {}

  /** Build a bundle from uploaded bytes (zip or crx), then scan. */
  async scanFile(bytes: Uint8Array, filename: string, listing?: ListingMetadata): Promise<ScanResult> {
    const isCrx = filename.toLowerCase().endsWith('.crx') || (bytes[0] === 0x43 && bytes[1] === 0x72);
    const zipBytes = isCrx ? crxToZip(bytes) : bytes;
    const fileMap = unzip(zipBytes);
    const source = isCrx ? 'crx' : 'zip';
    const bundle = buildBundle(fileMap, source, listing);
    return this.runScan(bundle);
  }

  /** Build a bundle from a set of folder files (path -> bytes), then scan. */
  async scanFolder(fileMap: Record<string, Uint8Array>, listing?: ListingMetadata): Promise<ScanResult> {
    const bundle = buildBundle(fileMap, 'folder', listing);
    return this.runScan(bundle);
  }

  /** Fetch a published extension by Web Store URL, then scan. */
  async scanUrl(url: string, listingOverride?: ListingMetadata): Promise<ScanResult> {
    const bundle = await bundleFromWebStore(url);
    if (listingOverride) bundle.listing = { ...bundle.listing, ...listingOverride };
    return this.runScan(bundle);
  }

  private async runScan(bundle: Bundle): Promise<ScanResult> {
    // Cache by content hash.
    if (bundle.contentHash) {
      const hit = this.cfg.store.findByHash(bundle.contentHash);
      if (hit) return { id: hit.id, report: hit.report, cached: true };
    }

    const extraCheckers: Checker[] = [];
    if (this.cfg.claudeApiKey) {
      extraCheckers.push(makeLlmJudge({ apiKey: this.cfg.claudeApiKey, model: this.cfg.claudeModel }));
    }

    const report = await scan(bundle, { extraCheckers, ctx });

    // Note which optional modules ran, so the UI can be honest about coverage.
    if (!this.cfg.claudeApiKey) {
      report.notices.push({
        level: 'info',
        message: 'LLM judge not run (no Claude API key); subjective categories are heuristic/manual only.',
      });
    }

    const id = this.cfg.store.save(report, bundle.contentHash);
    return { id, report, cached: false };
  }
}

export { BundleError };
