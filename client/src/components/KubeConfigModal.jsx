import React, { useState } from 'react';
import Icon from './Icons';

export default function KubeConfigModal({ defaultPath, exists, onSubmit, onDemo }) {
  const [path, setPath] = useState(defaultPath || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const p = path.trim();
    if (!p || busy) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(p);
    // on success the parent unmounts this modal
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <span className="modal-icon"><Icon name="cluster" size={20} /></span>
          <h2>Load kubeconfig</h2>
        </div>

        <p className="modal-desc">
          {exists
            ? <>A kubeconfig was found at <code>{defaultPath}</code> but couldn't be loaded. Enter a valid kubeconfig file path.</>
            : <>No kubeconfig was found{defaultPath ? <> at <code>{defaultPath}</code></> : ''}. Enter the full path to your kubeconfig file.</>}
        </p>

        <form onSubmit={submit}>
          <label className="modal-label">Kubeconfig file path</label>
          <input
            className="modal-input"
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/Users/you/.kube/config"
            spellCheck={false}
            autoFocus
          />

          {error && (
            <div className="modal-error">
              <Icon name="details" size={14} /> {error}
            </div>
          )}

          <div className="modal-actions">
            <button type="submit" className="modal-btn primary" disabled={busy || !path.trim()}>
              {busy ? 'Loading…' : 'Load kubeconfig'}
            </button>
          </div>
        </form>

        {onDemo && (
          <div className="modal-demo">
            <div className="modal-or"><span>or</span></div>
            <button type="button" className="modal-btn" onClick={() => onDemo()} disabled={busy}>
              <Icon name="sparkles" size={14} /> Explore the demo — no cluster needed
            </button>
            <p className="modal-hint" style={{ marginTop: 8 }}>
              A synthetic cluster with sample workloads, metrics, logs, Argo CD and security scans, so you can try every feature.
            </p>
          </div>
        )}

        <p className="modal-hint">
          Tip: you can also set the <code>KUBECONFIG</code> environment variable and restart the server.
        </p>
      </div>
    </div>
  );
}
