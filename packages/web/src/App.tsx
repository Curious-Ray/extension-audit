import { useEffect, useState } from 'react';
import type { ScanResult } from './types.js';
import { getReport } from './api.js';
import { InputPanel } from './components/InputPanel.js';
import { ReportView } from './components/ReportView.js';

export function App() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Deep-link: /report/:id loads a stored report.
  useEffect(() => {
    const m = location.pathname.match(/^\/report\/([\w-]+)$/);
    if (!m) return;
    setBusy(true);
    getReport(m[1]!)
      .then((r) => setResult(r))
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load report'))
      .finally(() => setBusy(false));
  }, []);

  function reset() {
    history.pushState({}, '', '/');
    setResult(null);
    setLoadError(null);
  }

  return (
    <div className="app">
      <div className="masthead">
        <span className="logo">
          Verdi<span className="k">kt</span>
        </span>
        <span className="tagline">Chrome Web Store rejection predictor</span>
      </div>
      <p className="sub">
        Upload your extension package (<code>.zip</code>/<code>.crx</code>) or paste a Web Store URL. Verdikt maps it
        against the official Chrome Web Store violation categories and predicts whether it would be rejected — with the
        exact policy and how to fix each issue.
      </p>

      {!result && !busy && <InputPanel onResult={setResult} onBusy={setBusy} />}

      {busy && (
        <div className="center">
          <div className="spinner" />
          Scanning…
        </div>
      )}

      {loadError && <div className="error">{loadError}</div>}

      {result && !busy && (
        <>
          <div className="toolbar" style={{ marginBottom: 4 }}>
            <button className="link-btn" onClick={reset}>
              ← New scan
            </button>
          </div>
          <ReportView report={result.report} reportId={result.id} cached={result.cached} />
        </>
      )}
    </div>
  );
}
