import { useRef, useState } from 'react';
import type { ListingInput, ScanResult } from '../types.js';
import { scanFile, scanUrl } from '../api.js';

type Mode = 'upload' | 'url';

export function InputPanel({
  onResult,
  onBusy,
}: {
  onResult: (r: ScanResult) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optional listing metadata.
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  function listing(): ListingInput | undefined {
    if (!title && !description && !privacyPolicyUrl) return undefined;
    return {
      title: title || undefined,
      description: description || undefined,
      privacyPolicyUrl: privacyPolicyUrl || undefined,
    };
  }

  async function submit() {
    setError(null);
    onBusy(true);
    try {
      const result =
        mode === 'upload'
          ? file
            ? await scanFile(file, listing())
            : (() => {
                throw new Error('Choose a .zip or .crx file first.');
              })()
          : await scanUrl(url.trim(), listing());
      onResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed.');
    } finally {
      onBusy(false);
    }
  }

  const canSubmit = mode === 'upload' ? !!file : url.trim().length > 0;

  return (
    <div className="panel">
      <div className="tabs">
        <button className={`tab ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>
          Upload package
        </button>
        <button className={`tab ${mode === 'url' ? 'active' : ''}`} onClick={() => setMode('url')}>
          Web Store URL
        </button>
      </div>

      {mode === 'upload' ? (
        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files[0];
            if (f) setFile(f);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.crx"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <strong>{file ? file.name : 'Drop your .zip or .crx here'}</strong>
          <small>{file ? `${(file.size / 1024).toFixed(0)} KB — click to replace` : 'or click to browse'}</small>
        </div>
      ) : (
        <div className="field">
          <label>Chrome Web Store URL or extension ID</label>
          <input
            className="input"
            placeholder="https://chromewebstore.google.com/detail/.../<id>"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
      )}

      <details className="advanced">
        <summary>Listing metadata (optional — improves metadata &amp; privacy checks)</summary>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Listing title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Listing description</label>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field">
          <label>Privacy policy URL</label>
          <input className="input" value={privacyPolicyUrl} onChange={(e) => setPrivacyPolicyUrl(e.target.value)} />
        </div>
      </details>

      <button className="btn" disabled={!canSubmit} onClick={submit}>
        Predict verdict →
      </button>

      {error && <div className="error">{error}</div>}
    </div>
  );
}
