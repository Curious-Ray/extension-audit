import { useState } from 'react';
import type { ScanResult } from './types.js';
import { InputPanel } from './components/InputPanel.js';
import { ReportView } from './components/ReportView.js';

export function App() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setResult(null);
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
        exact policy and how to fix each issue. The audit runs entirely in your browser; nothing is uploaded.
      </p>

      {!result && !busy && <InputPanel onResult={setResult} onBusy={setBusy} />}

      {busy && (
        <div className="center">
          <div className="spinner" />
          Scanning…
        </div>
      )}

      {result && !busy && (
        <>
          <div className="toolbar" style={{ marginBottom: 4 }}>
            <button className="link-btn" onClick={reset}>
              ← New scan
            </button>
          </div>
          <ReportView report={result.report} />
        </>
      )}
    </div>
  );
}
