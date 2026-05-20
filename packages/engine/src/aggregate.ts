import type {
  CategorySummary,
  Finding,
  Report,
  ReportNotice,
  BundleSource,
  Verdict,
} from './types.js';

/** Roll a flat list of findings into category summaries + an overall verdict. */
export function aggregate(
  findings: Finding[],
  notices: ReportNotice[],
  source: BundleSource,
): Report {
  const counts = { blocker: 0, warning: 0, manual: 0 };
  const byCategory = new Map<string, CategorySummary>();

  for (const f of findings) {
    counts[f.severity]++;
    let summary = byCategory.get(f.notificationId);
    if (!summary) {
      summary = {
        notificationId: f.notificationId,
        category: f.category,
        blocker: 0,
        warning: 0,
        manual: 0,
        findings: [],
      };
      byCategory.set(f.notificationId, summary);
    }
    summary[f.severity]++;
    summary.findings.push(f);
  }

  const verdict: Verdict =
    counts.blocker > 0 ? 'likely_rejected' : counts.warning > 0 ? 'at_risk' : 'looks_clear';

  return {
    verdict,
    counts,
    categories: [...byCategory.values()],
    findings,
    notices,
    source,
    generatedAt: new Date().toISOString(),
  };
}
