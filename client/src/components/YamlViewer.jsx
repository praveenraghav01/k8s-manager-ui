import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import hljs from 'highlight.js';
import 'highlight.js/styles/atom-one-dark.css';
import Loader from './Loader';
import Icon from './Icons';
import { useToast } from './Toast';

// Editable YAML editor: fetches the resource, lets the user edit, and applies
// changes back to the cluster via `kubectl apply`. A transparent textarea sits
// over a syntax-highlighted <pre> so editing keeps the colours.
export default function YamlViewer({ resource, namespace, resourceType, onApplied }) {
  const toast = useToast();
  const [yaml, setYaml] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const taRef = useRef(null);
  const preRef = useRef(null);

  const resourceNamespace = resource?.namespace || namespace;

  useEffect(() => { if (resource) fetchYaml(); /* eslint-disable-next-line */ }, [resource, namespace, resourceType]);

  const fetchYaml = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/yaml/${resourceNamespace}/${resourceType}/${resource.name}`);
      const y = response.data.yaml || '';
      setYaml(y); setOriginal(y); setError(null);
    } catch (err) {
      setError('Failed to load YAML'); setYaml('');
    } finally {
      setLoading(false);
    }
  };

  const highlighted = () => {
    try { return hljs.highlight(yaml || '', { language: 'yaml' }).value; }
    catch { return (yaml || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
  };

  // keep the highlight layer scrolled with the textarea
  const syncScroll = () => {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop;
      preRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  const apply = async () => {
    if (applying || yaml === original) return;
    setApplying(true);
    try {
      const { data } = await axios.put(`/api/yaml/${resourceNamespace}/${resourceType}/${resource.name}`, { yaml });
      toast.success(data.message || 'Applied', { title: resource.name });
      setOriginal(yaml);
      onApplied && onApplied();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Apply failed', { title: 'Apply' });
    } finally {
      setApplying(false);
    }
  };

  // Tab inserts two spaces instead of moving focus
  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.target, s = el.selectionStart, en = el.selectionEnd;
      const next = yaml.slice(0, s) + '  ' + yaml.slice(en);
      setYaml(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = s + 2; });
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); apply(); }
  };

  if (!resource) return null;
  const dirty = yaml !== original;

  return (
    <div className="yaml-viewer">
      <div className="yaml-toolbar">
        <span className="yaml-title">
          <Icon name="configuration" size={14} /> {resource.name}
          {dirty && <span className="yaml-dirty" title="Unsaved changes">●</span>}
        </span>
        <div className="yaml-toolbar-actions">
          <button className="yaml-btn" onClick={fetchYaml} disabled={loading || applying} title="Reload from cluster">
            <Icon name="refresh" size={13} /> Reload
          </button>
          <button className="yaml-btn primary" onClick={apply} disabled={!dirty || applying || loading} title="Apply changes (⌘S)">
            <Icon name="check" size={14} /> {applying ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
      <div className="yaml-content">
        {loading ? (
          <Loader label="Loading YAML…" inline />
        ) : error ? (
          <div className="yaml-error">{error}</div>
        ) : (
          <div className="yaml-edit-wrap">
            <pre className="yaml-code hljs" ref={preRef} aria-hidden="true">
              <code className="language-yaml" dangerouslySetInnerHTML={{ __html: highlighted() + '\n' }} />
            </pre>
            <textarea
              ref={taRef}
              className="yaml-textarea"
              value={yaml}
              spellCheck={false}
              onChange={(e) => setYaml(e.target.value)}
              onScroll={syncScroll}
              onKeyDown={onKeyDown}
            />
          </div>
        )}
      </div>
    </div>
  );
}
