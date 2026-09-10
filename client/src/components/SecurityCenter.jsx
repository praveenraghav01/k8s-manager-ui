import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Icon from './Icons';
import Loader from './Loader';

// Security Center — image CVEs, resource best-practice (config-audit) and RBAC
// risk, read from the Trivy Operator's report CRDs. Overview / Images /
// Resources / Roles tabs with donut summaries, a critical-vuln table, and a
// right-side detail drawer (modelled on Lens's Security Center).

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
const SEV_COLOR = { CRITICAL: '#e5484d', HIGH: '#f5a623', MEDIUM: '#e3b341', LOW: '#4c9be8', UNKNOWN: '#8b949e' };
const sevTotal = (s = {}) => SEVERITIES.reduce((n, k) => n + (s[k] || 0), 0);
const SevPill = ({ s }) => <span className="sec-pill" style={{ color: SEV_COLOR[s], background: `${SEV_COLOR[s]}22` }}>{s}</span>;

const rel = (iso) => {
  if (!iso) return '—';
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} minutes ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  return `${Math.floor(s / 86400)} days ago`;
};

/* ---------- Donut ---------- */
function Donut({ title, segments, size = 130 }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  const sw = 15, cr = (size - sw) / 2, circ = 2 * Math.PI * cr;
  let acc = 0;
  return (
    <div className="sec-donut">
      <div className="sec-donut-title">{title}</div>
      <div className="sec-donut-row">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="sec-donut-svg">
          <circle cx={size / 2} cy={size / 2} r={cr} fill="none" stroke="var(--bg-surface-2)" strokeWidth={sw} />
          {total > 0 && segments.filter((s) => s.value > 0).map((s, i) => {
            const frac = s.value / total, dash = frac * circ;
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={cr} fill="none" stroke={s.color} strokeWidth={sw}
                strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-acc * circ}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                <title>{`${s.label}: ${s.value}`}</title>
              </circle>
            );
            acc += frac; return el;
          })}
          {total === 0 && <text x="50%" y="52%" textAnchor="middle" className="sec-donut-empty">no data</text>}
        </svg>
        <div className="sec-donut-legend">
          {segments.map((s) => (
            <span key={s.label} className="sec-legend"><i style={{ background: s.color }} /> {s.label}{s.value ? ` (${s.value})` : ''}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SecurityCenter({ namespaces = [], onNavigate }) {
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState('overview');
  const [ns, setNs] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [vuln, setVuln] = useState(null);
  const [config, setConfig] = useState(null);
  const [rbac, setRbac] = useState(null);
  const [detail, setDetail] = useState(null); // { type:'image'|'checks', data }

  useEffect(() => {
    axios.get('/api/security/status').then((r) => setStatus(r.data)).catch(() => setStatus({ installed: false }));
  }, []);

  const get = (path, extra = {}) => axios.get(path, { params: { ...(ns !== 'all' ? { namespace: ns } : {}), ...extra } }).then((r) => r.data);

  useEffect(() => {
    if (!status?.installed) return;
    setDetail(null); setLoading(true);
    const done = () => setLoading(false);
    if (tab === 'overview' || tab === 'images') { get('/api/security/vulnerabilities').then(setVuln).catch(() => {}).finally(done); }
    else if (tab === 'resources') { get('/api/security/checks', { kind: 'config' }).then(setConfig).catch(() => {}).finally(done); }
    else if (tab === 'roles') { get('/api/security/checks', { kind: 'rbac' }).then(setRbac).catch(() => {}).finally(done); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ns, status?.installed]);

  if (status && !status.installed) return <SetupState error={status.error} />;
  if (!status) return <div className="sec-center"><Loader label="Checking Security Center…" /></div>;

  const nsList = namespaces.filter((n) => n !== 'all');
  const count = tab === 'resources' ? (config?.resources || []).length
    : tab === 'roles' ? (rbac?.resources || []).length : (vuln?.images || []).length;

  return (
    <div className="sec-view">
      <div className="sec-head">
        <div className="sec-title"><Icon name="shieldCheck" size={20} /> <h1>Security</h1></div>
        <div className="sec-controls">
          <select className="sec-nssel" value={ns} onChange={(e) => setNs(e.target.value)}>
            <option value="all">All namespaces</option>
            {nsList.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <div className="sec-search">
            <Icon name="search" size={14} />
            <input placeholder={`Search ${tab}…`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <span className="sec-count">{count} items</span>
        </div>
      </div>

      <div className="sec-tabs">
        {[['overview', 'Overview'], ['images', 'Images'], ['resources', 'Resources'], ['roles', 'Roles']].map(([k, label]) => (
          <button key={k} className={`sec-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      <div className="sec-main">
        <div className="sec-body">
          {loading ? <div className="sec-center"><Loader label="Loading reports…" /></div> : (
            <>
              {tab === 'overview' && <ImagesView vuln={vuln} q={q} onSelect={(d) => setDetail({ type: 'image', data: d })} selected={detail?.data} criticalOnly />}
              {tab === 'images' && <ImagesView vuln={vuln} q={q} onSelect={(d) => setDetail({ type: 'image', data: d })} selected={detail?.data} />}
              {tab === 'resources' && <ChecksView data={config} q={q} onSelect={(d) => setDetail({ type: 'checks', data: d })} selected={detail?.data} label="resource" />}
              {tab === 'roles' && <ChecksView data={rbac} q={q} onSelect={(d) => setDetail({ type: 'checks', data: d })} selected={detail?.data} label="role" />}
            </>
          )}
        </div>
        {detail && <Drawer detail={detail} onClose={() => setDetail(null)} onNavigate={onNavigate} />}
      </div>
    </div>
  );
}

/* ---------- Images / Overview (shared) ---------- */
function ImagesView({ vuln, q, onSelect, selected, criticalOnly }) {
  const ql = q.toLowerCase();
  const all = vuln?.images || [];
  const rows = useMemo(() => {
    let list = criticalOnly ? all.filter((im) => im.summary.CRITICAL > 0) : all;
    if (ql) list = list.filter((im) => im.image.toLowerCase().includes(ql) || (im.namespace || '').toLowerCase().includes(ql) || im.vulnerabilities.some((v) => v.id.toLowerCase().includes(ql)));
    return criticalOnly ? [...list].sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt)) : list;
  }, [all, ql, criticalOnly]);

  const statusSeg = [
    { label: 'Scanned', value: vuln?.scanned || 0, color: '#8b949e' },
    { label: 'Not Scanned', value: vuln?.notScanned ?? 0, color: '#4c9be8' },
  ];
  const resultSeg = [
    { label: 'Ok', value: vuln?.results?.ok || 0, color: '#3fb950' },
    { label: 'Vulnerable', value: vuln?.results?.vulnerable || 0, color: '#e5484d' },
  ];
  const vulnSeg = SEVERITIES.filter((k) => k !== 'UNKNOWN').map((k) => ({ label: k[0] + k.slice(1).toLowerCase(), value: vuln?.summary?.[k] || 0, color: SEV_COLOR[k] }));

  return (
    <>
      <div className="sec-donuts">
        <Donut title="Status" segments={statusSeg} />
        <Donut title="Results" segments={resultSeg} />
        <Donut title="Vulnerabilities" segments={vulnSeg} />
      </div>
      {criticalOnly && <div className="sec-section-title">Latest critical vulnerabilities</div>}
      {rows.length === 0 ? (
        <div className="sec-empty"><Icon name="shieldCheck" size={28} /><p>No {criticalOnly ? 'critical ' : ''}image findings{q ? ' match your search' : ''}.</p></div>
      ) : (
        <div className="sec-table">
          <div className="sec-tr sec-th img"><span>Name</span><span>Namespace</span><span>Kind</span><span>Critical</span><span>Scan Date</span></div>
          {rows.map((im) => (
            <button key={im.image} className={`sec-tr img row ${selected === im ? 'sel' : ''}`} onClick={() => onSelect(im)}>
              <span className="sec-mono sec-ellip" title={im.image}>{im.image}</span>
              <span>{im.namespace || '—'}</span>
              <span className="sec-kind">OciImage</span>
              <span className={im.summary.CRITICAL ? 'sec-crit' : ''}>{im.summary.CRITICAL || 0}</span>
              <span className="sec-dim">{rel(im.scannedAt)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Resources / Roles ---------- */
function ChecksView({ data, q, onSelect, selected, label }) {
  const ql = q.toLowerCase();
  const rows = (data?.resources || []).filter((r) => !ql || (r.name || '').toLowerCase().includes(ql) || r.checks.some((c) => (c.id + c.title).toLowerCase().includes(ql)));
  if (!rows.length) return <div className="sec-empty"><Icon name="shieldCheck" size={28} /><p>No {label} issues{q ? ' match your search' : ''}.</p></div>;
  return (
    <div className="sec-table">
      <div className="sec-tr chk sec-th"><span>Name</span><span>Kind</span><span>Namespace</span><span>Issues</span></div>
      {rows.map((r, i) => (
        <button key={`${r.kind}/${r.namespace}/${r.name}/${i}`} className={`sec-tr chk row ${selected === r ? 'sel' : ''}`} onClick={() => onSelect(r)}>
          <span className="sec-strong sec-ellip">{r.name}</span>
          <span className="sec-kind">{r.kind}</span>
          <span className="sec-dim">{r.namespace || '—'}</span>
          <span><SevMini summary={r.summary} /></span>
        </button>
      ))}
    </div>
  );
}

const SevMini = ({ summary = {} }) => (
  <span className="sec-sevmini">
    {SEVERITIES.filter((k) => summary[k]).map((k) => <span key={k} style={{ color: SEV_COLOR[k], background: `${SEV_COLOR[k]}22` }}>{summary[k]}</span>)}
  </span>
);

/* ---------- Detail drawer ---------- */
function Drawer({ detail, onClose, onNavigate }) {
  const isImage = detail.type === 'image';
  const d = detail.data;
  return (
    <aside className="sec-drawer">
      <div className="sec-drawer-head">
        <span className="sec-drawer-title">{isImage ? <><span className="sec-kind">OciImage</span> {d.image}</> : <><span className="sec-kind">{d.kind}</span> {d.name}</>}</span>
        <button className="sec-drawer-x" onClick={onClose}><Icon name="close" size={16} /></button>
      </div>
      <div className="sec-drawer-body">
        {isImage ? <ImageDetail d={d} onNavigate={onNavigate} /> : <ChecksDetail d={d} />}
      </div>
    </aside>
  );
}

function Prop({ k, children }) { return <div className="sec-prop"><span className="sec-prop-k">{k}</span><span className="sec-prop-v">{children}</span></div>; }

function ImageDetail({ d, onNavigate }) {
  const controlledBy = d.workloads[0];
  const donutSeg = SEVERITIES.filter((k) => k !== 'UNKNOWN').map((k) => ({ label: k[0] + k.slice(1).toLowerCase(), value: d.summary[k] || 0, color: SEV_COLOR[k] }));
  const worst = SEVERITIES.find((k) => d.summary[k]) || 'LOW';
  return (
    <>
      <div className="sec-drawer-section">Properties</div>
      <Prop k="Name"><span className="sec-mono">{d.image}</span></Prop>
      <Prop k="Namespace">{d.namespace ? <a onClick={() => onNavigate?.toNamespace?.(d.namespace)}>{d.namespace}</a> : '—'}</Prop>
      {controlledBy && <Prop k="Controlled By">{controlledBy.kind} <a onClick={() => onNavigate?.toResource?.({ type: (controlledBy.kind || '').toLowerCase(), namespace: controlledBy.namespace, name: controlledBy.name })}>{controlledBy.name}</a></Prop>}
      {d.tag && <Prop k="Tag">{d.tag}</Prop>}
      {d.digest && <Prop k="Image Digest"><span className="sec-mono sec-break">{d.digest}</span></Prop>}
      <Prop k="Status">{d.status}</Prop>
      <Prop k="Used By Pods">
        <span className="sec-podlinks">
          {d.workloads.slice(0, 30).map((w, i) => (
            <a key={i} onClick={() => onNavigate?.toResource?.({ type: (w.kind || '').toLowerCase(), namespace: w.namespace, name: w.name })}>{w.namespace}/{w.name}</a>
          ))}
        </span>
      </Prop>

      <div className="sec-drawer-section">Vulnerabilities</div>
      <div className="sec-drawer-donut"><Donut title="" segments={donutSeg} size={120} /></div>
      <Prop k="Severity"><SevPill s={worst} /></Prop>
      <Prop k="Scanned">{rel(d.scannedAt)}</Prop>
      {d.scanner && <Prop k="Scan Result Source">{d.scanner}</Prop>}

      <div className="sec-table" style={{ marginTop: 12 }}>
        <div className="sec-tr vt sec-th"><span>ID</span><span>Severity</span><span>Package</span><span>Fixed in</span><span>Installed</span></div>
        {d.vulnerabilities.map((v, i) => (
          <div className="sec-vitem" key={v.id + i}>
            <div className="sec-tr vt">
              <span>{v.link ? <a href={v.link} target="_blank" rel="noreferrer" className="sec-cve">{v.id}</a> : v.id}</span>
              <span><SevPill s={v.severity} /></span>
              <span className="sec-mono sec-ellip" title={v.pkg}>{v.pkg}</span>
              <span className="sec-mono">{v.fixedVersion || <em className="sec-dim">—</em>}</span>
              <span className="sec-mono sec-ellip" title={v.installedVersion}>{v.installedVersion}</span>
            </div>
            {v.title && <div className="sec-vdesc">{v.title}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

function ChecksDetail({ d }) {
  return (
    <>
      <div className="sec-drawer-section">Properties</div>
      <Prop k="Name"><span className="sec-strong">{d.name}</span></Prop>
      <Prop k="Kind">{d.kind}</Prop>
      {d.namespace && <Prop k="Namespace">{d.namespace}</Prop>}
      <div className="sec-drawer-section">Checks ({d.checks.length})</div>
      <div className="sec-checks">
        {d.checks.map((c, i) => (
          <div className="sec-checkitem" key={c.id + i}>
            <SevPill s={c.severity} />
            <div className="sec-check-main">
              <div className="sec-check-title">{c.title || c.id} <code>{c.id}</code></div>
              {c.message && <div className="sec-check-msg">{c.message}</div>}
              {c.remediation && <div className="sec-check-fix"><strong>Fix:</strong> {c.remediation}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Setup ---------- */
function SetupState({ error }) {
  return (
    <div className="sec-view">
      <div className="sec-head"><div className="sec-title"><Icon name="shield" size={20} /> <h1>Security</h1></div></div>
      <div className="sec-setup">
        <div className="sec-setup-icon"><Icon name="shield" size={40} /></div>
        <h2>Security Center needs the Trivy Operator</h2>
        <p>The Security Center reads image-CVE, resource best-practice, and RBAC-risk reports produced by the <strong>Trivy Operator</strong> running in your cluster. It isn't installed here yet — deploy it once and its scans light up this view automatically. Nothing else to configure.</p>
        <div className="sec-setup-cmd">
          <pre><code>helm repo add aqua https://aquasecurity.github.io/helm-charts/
helm install trivy-operator aqua/trivy-operator \
  --namespace trivy-system --create-namespace</code></pre>
        </div>
        <p className="sec-dim">The operator scans your workloads on a schedule and writes VulnerabilityReport, ConfigAuditReport and RbacAssessmentReport resources. This page refreshes when you revisit it.</p>
        <a className="sec-link" href="https://aquasecurity.github.io/trivy-operator/latest/getting-started/installation/helm/" target="_blank" rel="noreferrer">Trivy Operator install guide <Icon name="externalLink" size={12} /></a>
        {error && <div className="sec-dim" style={{ marginTop: 14 }}>Note: {error}</div>}
      </div>
    </div>
  );
}
