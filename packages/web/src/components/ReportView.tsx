import { useState } from 'react';
import type { CategorySummary, Finding, Report, Severity } from '../types.js';

const VERDICT_META: Record<Report['verdict'], { icon: string; title: string; blurb: string }> = {
  likely_rejected: {
    icon: '✕',
    title: 'Likely Rejected',
    blurb: 'At least one issue maps to a violation that commonly causes rejection. Fix the blockers below before submitting.',
  },
  at_risk: {
    icon: '!',
    title: 'At Risk',
    blurb: 'No outright blockers, but there are warnings a reviewer may flag. Worth addressing to be safe.',
  },
  looks_clear: {
    icon: '✓',
    title: 'Looks Clear',
    blurb: 'No automated blockers or warnings found. Some categories still need manual review (see below).',
  },
};

export function ReportView({ report }: { report: Report }) {
  const meta = VERDICT_META[report.verdict];

  return (
    <div>
      <div className={`verdict ${report.verdict}`}>
        <div className="verdict-icon">{meta.icon}</div>
        <div>
          <h2>{meta.title}</h2>
          <p>{meta.blurb}</p>
        </div>
        <div className="counts">
          <Count n={report.counts.blocker} label="Blockers" cls="blocker" />
          <Count n={report.counts.warning} label="Warnings" cls="warning" />
          <Count n={report.counts.manual} label="Manual" cls="manual" />
        </div>
      </div>

      <div className="section-title">Findings by policy category</div>
      {report.categories.length === 0 ? (
        <p style={{ color: 'var(--text-dim)' }}>No findings.</p>
      ) : (
        [...report.categories]
          .sort((a, b) => weight(b) - weight(a))
          .map((c) => <CategoryCard key={c.notificationId + c.category} cat={c} />)
      )}

      {report.notices.length > 0 && (
        <div className="notices">
          <div className="section-title">Scan notes</div>
          {report.notices.map((n, i) => (
            <div className="notice" key={i}>
              <span>•</span>
              <span>{n.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function weight(c: CategorySummary): number {
  return c.blocker * 100 + c.warning * 10 + c.manual;
}

function Count({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className={`count ${cls}`}>
      <span className="n">{n}</span>
      <span className="l">{label}</span>
    </div>
  );
}

function CategoryCard({ cat }: { cat: CategorySummary }) {
  const [open, setOpen] = useState(cat.blocker > 0);
  const top: Severity = cat.blocker ? 'blocker' : cat.warning ? 'warning' : 'manual';
  const count = cat.blocker + cat.warning + cat.manual;

  return (
    <div className={`card ${open ? 'open' : ''}`}>
      <div className="card-head" onClick={() => setOpen((o) => !o)}>
        <span className={`pill ${top}`}>{count}</span>
        <span className="cat">{cat.category}</span>
        <span className="nid">{cat.notificationId}</span>
        <span className="chev">›</span>
      </div>
      {open && cat.findings.map((f, i) => <FindingItem key={i} f={f} />)}
    </div>
  );
}

function FindingItem({ f }: { f: Finding }) {
  return (
    <div className="finding">
      <div className="finding-top">
        <span className={`pill ${f.severity}`}>{f.severity}</span>
        <span className="finding-title">{f.title}</span>
        <span className="src">{f.source}</span>
      </div>
      {f.howToFix && <div className="fix">{f.howToFix}</div>}
      {f.evidence?.map((e, i) => (
        <div className="evidence" key={i}>
          <span className="loc">
            {e.path}
            {e.line ? `:${e.line}` : ''}
          </span>
          {e.snippet && <span className="snip">{e.snippet}</span>}
        </div>
      ))}
      <div className="quote">{f.policyQuote}</div>
    </div>
  );
}
