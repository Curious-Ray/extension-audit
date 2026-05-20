// Mirrors @verdikt/engine's Report shape for the client.
export type Severity = 'blocker' | 'warning' | 'manual';
export type Verdict = 'likely_rejected' | 'at_risk' | 'looks_clear';

export interface Evidence {
  path: string;
  line?: number;
  snippet?: string;
}

export interface Finding {
  notificationId: string;
  category: string;
  severity: Severity;
  title: string;
  evidence?: Evidence[];
  policyQuote: string;
  howToFix: string;
  source: 'native' | 'nuclei' | 'llm';
}

export interface CategorySummary {
  notificationId: string;
  category: string;
  blocker: number;
  warning: number;
  manual: number;
  findings: Finding[];
}

export interface ReportNotice {
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface Report {
  verdict: Verdict;
  counts: { blocker: number; warning: number; manual: number };
  categories: CategorySummary[];
  findings: Finding[];
  notices: ReportNotice[];
  source: string;
  generatedAt: string;
}

export interface ScanResult {
  id: string;
  report: Report;
  cached?: boolean;
}

export interface ListingInput {
  title?: string;
  description?: string;
  privacyPolicyUrl?: string;
  screenshotCount?: number;
  iconPresent?: boolean;
}
