import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Icon from './Icons';
import Loader from './Loader';
import {
  getAiConfig, setAiConfig, getAiExternalTerminal, setAiExternalTerminal,
} from '../aiConfig';

// Full-page Preferences view (Lens-style): a left sub-nav of sections and a
// content pane. Sections: General, Kubernetes, Cloud Integrations, External
// Tools (bring-your-own AI agent), AI Assistant, About.

const SECTIONS = [
  { key: 'general', label: 'General', icon: 'configuration' },
  { key: 'kubernetes', label: 'Kubernetes', icon: 'cluster' },
  { key: 'integrations', label: 'Cloud Integrations', icon: 'hexagon' },
  { key: 'external-tools', label: 'External Tools', icon: 'sparkles' },
  { key: 'assistant', label: 'AI Assistant', icon: 'send' },
  { key: 'about', label: 'About', icon: 'details' },
];

export default function Preferences({ configStatus, theme, onSetTheme, onChangeConfig, onAddAzure, onAddAws, initialSection, onClose }) {
  const [section, setSection] = useState(initialSection || 'general');
  useEffect(() => { if (initialSection) setSection(initialSection); }, [initialSection]);

  // Esc closes the page.
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="prefs-page">
      <div className="prefs-sidenav">
        <div className="prefs-sidenav-title">Preferences</div>
        {SECTIONS.map((s) => (
          <button key={s.key} className={`prefs-navitem ${section === s.key ? 'active' : ''}`} onClick={() => setSection(s.key)}>
            <Icon name={s.icon} size={15} /> {s.label}
          </button>
        ))}
      </div>
      <div className="prefs-content">
        {onClose && (
          <button className="prefs-close" onClick={onClose} title="Close preferences (Esc)" aria-label="Close preferences">
            <Icon name="close" size={18} />
          </button>
        )}
        {section === 'general' && <GeneralSection theme={theme} onSetTheme={onSetTheme} />}
        {section === 'kubernetes' && <KubernetesSection configStatus={configStatus} onChangeConfig={onChangeConfig} />}
        {section === 'integrations' && <IntegrationsSection onAddAzure={onAddAzure} onAddAws={onAddAws} />}
        {section === 'external-tools' && <ExternalToolsSection />}
        {section === 'assistant' && <AssistantSection />}
        {section === 'about' && <AboutSection configStatus={configStatus} />}
      </div>
    </div>
  );
}

/* ── General ─────────────────────────────────────────────────────── */
function GeneralSection({ theme, onSetTheme }) {
  return (
    <div className="prefs-section">
      <h2 className="prefs-h2">General</h2>
      <Field label="Theme" hint="Choose how the app looks. System follows your OS appearance.">
        <div className="prefs-seg">
          {[{ k: 'system', label: 'System', icon: 'monitor' }, { k: 'dark', label: 'Dark', icon: 'moon' }, { k: 'light', label: 'Light', icon: 'sun' }].map((t) => (
            <button key={t.k} className={`prefs-seg-btn ${theme === t.k ? 'active' : ''}`} onClick={() => onSetTheme(t.k)}>
              <Icon name={t.icon} size={14} /> {t.label}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

/* ── Kubernetes ──────────────────────────────────────────────────── */
function KubernetesSection({ configStatus, onChangeConfig }) {
  return (
    <div className="prefs-section">
      <h2 className="prefs-h2">Kubernetes</h2>
      <Field label="Kubeconfig" hint="The file the app reads clusters and contexts from.">
        <div className="prefs-inline">
          <code className="prefs-code">{configStatus?.path || configStatus?.defaultPath || '~/.kube/config'}</code>
          <button className="prefs-btn" onClick={onChangeConfig}>Change…</button>
        </div>
      </Field>
      <Field label="Current context" hint="The cluster that new requests target.">
        <code className="prefs-code">{configStatus?.currentContext || '—'}</code>
      </Field>
      <Field label="Available contexts">
        <span className="prefs-muted">{(configStatus?.contexts || []).length} context(s) across {(configStatus?.clusters || []).length} cluster(s)</span>
      </Field>
    </div>
  );
}

/* ── Cloud Integrations ──────────────────────────────────────────── */
function IntegrationsSection({ onAddAzure, onAddAws }) {
  return (
    <div className="prefs-section">
      <h2 className="prefs-h2">Cloud Integrations</h2>
      <p className="prefs-lead">Add clusters straight from your cloud account — no CLI required. We handle login and write the kubeconfig for you.</p>
      <div className="prefs-cards">
        <div className="prefs-int-card">
          <div className="prefs-int-head"><Icon name="azure" size={22} /> <span>Azure AKS</span></div>
          <p className="prefs-muted">Sign in to Azure and import your AKS clusters.</p>
          <button className="prefs-btn primary" onClick={onAddAzure}>Add Azure clusters</button>
        </div>
        <div className="prefs-int-card">
          <div className="prefs-int-head"><Icon name="aws" size={22} /> <span>AWS EKS</span></div>
          <p className="prefs-muted">SSO, access keys or IAM role — discover and import EKS clusters.</p>
          <button className="prefs-btn primary" onClick={onAddAws}>Add AWS clusters</button>
        </div>
      </div>
    </div>
  );
}

/* ── External Tools (AI agent) ───────────────────────────────────── */
const AGENT_ICON = { claude: 'aiClaude', copilot: 'aiCopilot', gemini: 'aiGemini', codex: 'aiCodex', opencode: 'aiOpencode' };

function ExternalToolsSection() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cfg, setCfg] = useState(getAiConfig);
  const [customCmd, setCustomCmd] = useState(() => getAiConfig().command || '');
  const [extTerm, setExtTerm] = useState(getAiExternalTerminal);

  const sel = cfg.mode === 'agent' ? cfg.id : cfg.mode; // agentId | 'builtin' | 'custom' | 'none'

  const load = () => {
    setLoading(true);
    axios.get('/api/ai-agents').then(({ data }) => setAgents(data.agents || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const detected = agents.filter((a) => a.installed).length;

  const choose = (next) => {
    let c;
    if (next === 'builtin') c = { mode: 'builtin' };
    else if (next === 'none') c = { mode: 'none' };
    else if (next === 'custom') c = { mode: 'custom', name: (customCmd.split(/\s+/)[0] || 'Custom'), command: customCmd.trim() };
    else { const a = agents.find((x) => x.id === next); c = { mode: 'agent', id: a.id, name: a.name }; }
    setCfg(c); setAiConfig(c);
  };

  const onCustomChange = (v) => {
    setCustomCmd(v);
    if (sel === 'custom') { const c = { mode: 'custom', name: (v.split(/\s+/)[0] || 'Custom'), command: v.trim() }; setCfg(c); setAiConfig(c); }
  };

  const toggleExt = () => { const on = !extTerm; setExtTerm(on); setAiExternalTerminal(on); };

  return (
    <div className="prefs-section">
      <h2 className="prefs-h2">External Tools</h2>
      <div className="prefs-ai-label">AI TOOL <span className="prefs-premium">FREE</span></div>
      <p className="prefs-lead">The AI tool the app launches for e.g. <strong>"Ask AI"</strong>. Bring your own agent — it runs in a terminal with your cluster context loaded, no API key.</p>

      <div className="prefs-detect-row">
        <span className="prefs-muted">{detected} of {agents.length} detected on your system</span>
        <button className="prefs-link" onClick={load}><Icon name="refresh" size={13} /> Refresh</button>
      </div>

      {loading ? <div className="prefs-center"><Loader label="Detecting installed AI tools…" /></div> : (
        <div className="prefs-ai-list">
          {agents.map((a) => (
            <label key={a.id} className={`prefs-ai-opt ${!a.installed ? 'disabled' : ''} ${sel === a.id ? 'sel' : ''}`}>
              <input type="radio" name="aitool" checked={sel === a.id} disabled={!a.installed} onChange={() => choose(a.id)} />
              <span className="prefs-ai-ico"><Icon name={AGENT_ICON[a.id] || 'sparkles'} size={18} /></span>
              <span className="prefs-ai-main">
                <span className="prefs-ai-name">{a.name}</span>
                <span className="prefs-ai-sub">{a.installed ? a.desc : 'Not found in PATH'}</span>
              </span>
              {a.installed
                ? <span className="prefs-ai-status ok"><Icon name="check" size={12} /> INSTALLED</span>
                : <a className="prefs-ai-status link" href={a.install} target="_blank" rel="noreferrer">HOW TO INSTALL</a>}
            </label>
          ))}

          <label className={`prefs-ai-opt ${sel === 'custom' ? 'sel' : ''}`}>
            <input type="radio" name="aitool" checked={sel === 'custom'} onChange={() => choose('custom')} />
            <span className="prefs-ai-ico"><Icon name="terminal" size={18} /></span>
            <span className="prefs-ai-main">
              <span className="prefs-ai-name">Custom</span>
              <input className="prefs-ai-input" placeholder="Runs your own configured command, e.g. my-ai-cli" value={customCmd} onFocus={() => choose('custom')} onChange={(e) => onCustomChange(e.target.value)} />
            </span>
            <span className="prefs-ai-status muted">CUSTOM</span>
          </label>

          <label className={`prefs-ai-opt ${sel === 'builtin' ? 'sel' : ''}`}>
            <input type="radio" name="aitool" checked={sel === 'builtin'} onChange={() => choose('builtin')} />
            <span className="prefs-ai-ico"><Icon name="send" size={18} /></span>
            <span className="prefs-ai-main">
              <span className="prefs-ai-name">Built-in assistant</span>
              <span className="prefs-ai-sub">Uses the app's own AI (API-based)</span>
            </span>
          </label>

          <label className={`prefs-ai-opt ${sel === 'none' ? 'sel' : ''}`}>
            <input type="radio" name="aitool" checked={sel === 'none'} onChange={() => choose('none')} />
            <span className="prefs-ai-ico"><Icon name="close" size={18} /></span>
            <span className="prefs-ai-main">
              <span className="prefs-ai-name">No AI tool</span>
              <span className="prefs-ai-sub">The app does not launch an AI tool</span>
            </span>
          </label>
        </div>
      )}

      <div className="prefs-toggle-row">
        <div>
          <div className="prefs-toggle-label">Open AI tools in an external terminal</div>
          <div className="prefs-muted">Launch the selected AI tool in a new terminal window instead of an in-app terminal tab.</div>
        </div>
        <button className={`prefs-switch ${extTerm ? 'on' : ''}`} onClick={toggleExt} role="switch" aria-checked={extTerm}><span /></button>
      </div>
    </div>
  );
}

/* ── AI Assistant (built-in LLM connection) ──────────────────────── */
function AssistantSection() {
  const [status, setStatus] = useState(null);
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [saved, setSaved] = useState(false);

  const refresh = () => fetch('/api/assistant/status').then((r) => r.json()).then((d) => {
    setStatus(d);
    if (d.baseUrl) setUrl((v) => v || d.baseUrl);
    if (d.model) setModel((v) => v || d.model);
  }).catch(() => setStatus({ enabled: false }));
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!url.trim() || !model.trim() || !key.trim() || saving) return;
    setSaving(true); setErr(null); setSaved(false);
    try {
      const r = await fetch('/api/assistant/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: url.trim(), model: model.trim(), apiKey: key.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Failed (${r.status})`);
      setKey(''); setSaved(true); await refresh();
    } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };
  const forget = async () => { try { await fetch('/api/assistant/config', { method: 'DELETE' }); setKey(''); setSaved(false); await refresh(); } catch { /* ignore */ } };

  return (
    <div className="prefs-section">
      <h2 className="prefs-h2">AI Assistant</h2>
      <p className="prefs-lead">The built-in assistant connects to any OpenAI-compatible endpoint (TrueFoundry, OpenAI, Azure, LiteLLM…). Used when "Built-in assistant" is selected under External Tools.</p>

      {status && (
        <div className={`prefs-badge-row ${status.enabled ? 'ok' : ''}`}>
          <Icon name={status.enabled ? 'check' : 'warning'} size={14} />
          {status.enabled ? `Connected · ${status.model || 'model set'}${status.source === 'env' ? ' (from environment)' : ''}` : 'Not configured'}
        </div>
      )}

      {status && status.editable === false ? (
        <p className="prefs-muted">Configured via server environment (<code>LLM_BASE_URL</code>, <code>LLM_API_KEY</code>, <code>LLM_MODEL</code>).</p>
      ) : (
        <>
          <Field label="API base URL"><input className="prefs-text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://<org>.truefoundry.cloud/api/llm/api/inference/openai" spellCheck={false} /></Field>
          <Field label="Model"><input className="prefs-text" value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. openai-main/gpt-4o" spellCheck={false} /></Field>
          <Field label="API key"><input className="prefs-text" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={status?.enabled ? '•••••• (stored)' : 'API token'} spellCheck={false} /></Field>
          {err && <div className="prefs-badge-row err"><Icon name="warning" size={13} /> {err}</div>}
          {saved && <div className="prefs-badge-row ok"><Icon name="check" size={13} /> Saved</div>}
          <div className="prefs-inline" style={{ marginTop: 6 }}>
            <button className="prefs-btn primary" onClick={save} disabled={!url.trim() || !model.trim() || !key.trim() || saving}>{saving ? 'Validating…' : 'Save connection'}</button>
            {status?.source === 'stored' && <button className="prefs-btn" onClick={forget}>Forget saved connection</button>}
          </div>
        </>
      )}
    </div>
  );
}

/* ── About ───────────────────────────────────────────────────────── */
function AboutSection({ configStatus }) {
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '';
  return (
    <div className="prefs-section">
      <h2 className="prefs-h2">About</h2>
      <Field label="k8sight">{version ? <span className="prefs-muted">Version {version}</span> : null}</Field>
      <p className="prefs-lead">A Lens-style Kubernetes management app — cluster overview, resources, topology, ArgoCD, one-click AKS/EKS, terminals and bring-your-own AI agents.</p>
    </div>
  );
}

/* ── shared field wrapper ────────────────────────────────────────── */
function Field({ label, hint, children }) {
  return (
    <div className="prefs-field">
      <div className="prefs-field-label">{label}</div>
      {hint && <div className="prefs-field-hint">{hint}</div>}
      <div className="prefs-field-control">{children}</div>
    </div>
  );
}
