// Re-export the engine's report types so the client and components share one
// source of truth. The audit now runs in the browser via @verdikt/engine.
export type {
  Severity,
  Verdict,
  Evidence,
  Finding,
  CategorySummary,
  ReportNotice,
  Report,
  ListingMetadata,
} from '@verdikt/engine';

import type { Report, ListingMetadata } from '@verdikt/engine';

export interface ScanResult {
  /** Local pseudo-id for this scan (no server persistence in the static build). */
  id: string;
  report: Report;
  cached?: boolean;
}

export type ListingInput = ListingMetadata;
