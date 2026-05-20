import type { Bundle, Checker, CheckerContext, Report } from './types.js';
import { NATIVE_CHECKERS } from './checkers/index.js';
import { runCheckers } from './registry.js';
import { aggregate } from './aggregate.js';

export * from './types.js';
export { parseManifest, fromObject } from './manifest.js';
export { POLICIES } from './policies.js';
export { NATIVE_CHECKERS } from './checkers/index.js';
export { aggregate } from './aggregate.js';
export { runCheckers } from './registry.js';

export interface ScanOptions {
  /** Override the checker set. Defaults to all native checkers. */
  checkers?: Checker[];
  /** Extra checkers to append (e.g. nuclei, llm) to the default set. */
  extraCheckers?: Checker[];
  ctx?: CheckerContext;
}

/** Run a full scan of a bundle and return an aggregated report. */
export async function scan(bundle: Bundle, options: ScanOptions = {}): Promise<Report> {
  const checkers = [...(options.checkers ?? NATIVE_CHECKERS), ...(options.extraCheckers ?? [])];
  const { findings, notices } = await runCheckers(checkers, bundle, options.ctx);
  return aggregate(findings, notices, bundle.source);
}
