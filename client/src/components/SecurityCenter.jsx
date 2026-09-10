import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Icon from './Icons';
import Loader from './Loader';

// Security Center — image CVEs, resource best-practice (config-audit) and RBAC
// risk, read from the Trivy Operator's report CRDs on the cluster. Overview /
// Images / Resources / Roles tabs, with a namespace filter and search.

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
const SEV_COLOR = { CRITICAL: '#e5484d', HIGH: '#f5a623', MEDIUM: '#e3b341', LOW: '#4c9be8', UNKNOWN: '#8b949e' };
const sevTotal = (s = {}) => SEVERITIES.reduce((n, k) => n + (s[k] || 0), 0);

function SeverityBar({ summary = {}, compact }) {
  const total = sevTotal(summary) || 1;
  return (
    <div className={`sec-sevbar ${compact ? 'compact' : ''}`}>
      <div className="sec-sevbar-track">
        {SEVERITIES.map((k) => summary[k] ? (
          <span key={k} style={{ width: `${(summary[k] / total) * 100}%`, background: SEV_COLOR[k] }} title={`${k}: ${summary[k]}`} />
        ) : null)}
      </div>
      {!compact && (
        <div className="sec-sevbar-counts">
          {SEVERITIES.filter((k) => summary[k]).map((k) => (
            <span key={k} className="sec-sevcount"><i style={{ background: SEV_COLOR[k] }} /> {summary[k]} {k[0] + k.slice(1).toLowerCase()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const SevPill = ({ s }) => <span className="sec-pill" style={{ color: SEV_COLOR[s], background: `${SEV_COLOR[s]}22` }}>{s}</span>;

export default function SecurityCenter({ namespaces = [], onNavigate }) {
  const [status, setStatus] = useState(null);
  const [tab, setTab] = useState('overview');
  const [ns, setNs] = useState('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [vuln, setVuln] = useState(null);
  const [config, setConfig] = useState(null);
  const [rbac, setRbac] = useState(null);
  const [open, setOpen] = useState(null); // expanded row key

  useEffect(() => {
    axios.get('/api/security/status').then((r) => setStatus(r.data)).catch(() => setStatus({ installed: false }));
  }, []);

  const nsParam = () => (ns && ns !== 'all' ? { namespace: ns } : {});
  const get = (path, extra = {}) => axios.get(path, { params: { ...nsParam(), ...extra } }).then((r) => r.data);

  useEffect(() => {
    if (!status?.installed) return;
    setOpen(null);
    setLoading(true);
    const done = () => setLoading(false);
    if (tab === 'overview') {
      Promise.all([get('/api/security/vulnerabilities'), get('/api/security/checks', { kind: 'config' }), get('/api/security/checks', { kind: 'rbac' })])
        .then(([v, c, r]) => { setVuln(v); setConfig(c); setRbac(r); }).catch(() => {}).finally(done);
    } else if (tab === 'images') { get('/api/security/vulnerabilities').then(setVuln).catch(() => {}).finally(done); }
    else if (tab === 'resources') { get('/api/security/checks', { kind: 'config' }).then(setConfig).catch(() => {}).finally(done); }
    else if (tab === 'roles') { get('/api/security/checks', { kind: 'rbac' }).then(setRbac).catch(() => {}).finally(done); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, ns, status?.installed]);

  // ---- not installed / setup state ----
  if (status && !status.installed) return <SetupState error={status.error} />;
  if (!status) return <div className="sec-center"><Loader label="Checking Security Center…" /></div>;

  const nsList = namespaces.filter((n) => n !== 'all');

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
            <input placeholder="Search CVE, image, resource…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="sec-tabs">
        {[['overview', 'Overview'], ['images', 'Images'], ['resources', 'Resources'], ['roles', 'Roles']].map(([k, label]) => (
          <button key={k} className={`sec-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {loading ? <div className="sec-center"><Loader label="Loading reports…" /></div> : (
        <div className="sec-body">
          {tab === 'overview' && <Overview vuln={vuln} config={config} rbac={rbac} q={q} onJump={setTab} />}
          {tab === 'images' && <Images data={vuln} q={q} open={open} setOpen={setOpen} onNavigate={onNavigate} />}
          {tab === 'resources' && <Checks data={config} q={q} open={open} setOpen={setOpen} label="resource" />}
          {tab === 'roles' && <Checks data={rbac} q={q} open={open} setOpen={setOpen} label="role" />}
        </div>
      )}
    </div>
  );
}

/* ---------- Overview ---------- */
function Overview({ vuln, config, rbac, q, onJump }) {
  const summary = vuln?.summary || {};
  const critical = useMemo(() => {
    const out = [];
    for (const img of (vuln?.images || [])) {
      for (const v of img.vulnerabilities) {
        if (v.severity !== 'CRITICAL') continue;
        out.push({ ...v, image: img.image });
      }
    }
    const ql = q.toLowerCase();
    return out.filter((v) => !ql || v.id.toLowerCase().includes(ql) || v.image.toLowerCase().includes(ql) || v.pkg.toLowerCase().includes(ql)).slice(0, 30);
  }, [vuln, q]);

  const configIssues = sevTotal(config?.summary);
  const rbacIssues = sevTotal(rbac?.summary);

  return (
    <div className="sec-overview">
      <div className="sec-cards">
        <div className="sec-card">
          <div className="sec-card-label">Image vulnerabilities</div>
          <div className="sec-card-num">{sevTotal(summary).toLocaleString()}</div>
          <div className="sec-card-sub">{(vuln?.images || []).length} images · {vuln?.reportCount || 0} reports</div>
          <SeverityBar summary={summary} />
        </div>
        <button className="sec-card clickable" onClick={() => onJump('resources')}>
          <div className="sec-card-label">Resource misconfigurations</div>
          <div className="sec-card-num">{configIssues.toLocaleString()}</div>
          <div className="sec-card-sub">{(config?.resources || []).length} resources with issues</div>
          <SeverityBar summary={config?.summary || {}} compact />
        </button>
        <button className="sec-card clickable" onClick={() => onJump('roles')}>
          <div className="sec-card-label">RBAC risks</div>
          <div className="sec-card-num">{rbacIssues.toLocaleString()}</div>
          <div className="sec-card-sub">{(rbac?.resources || []).length} roles with issues</div>
          <SeverityBar summary={rbac?.summary || {}} compact />
        </button>
      </div>

      <div className="sec-section-title">Latest critical vulnerabilities</div>
      {critical.length === 0 ? (
        <div className="sec-empty"><Icon name="shieldCheck" size={28} /><p>No critical image vulnerabilities{q ? ' match your search' : ''}.</p></div>
      ) : (
        <div className="sec-table">
          <div className="sec-tr sec-th"><span>CVE</span><span>Severity</span><span>Package</span><span>Image</span><span>Fixed in</span></div>
          {critical.map((v, i) => (
            <div className="sec-tr" key={v.id + i}>
              <span>{v.link ? <a href={v.link} target="_blank" rel="noreferrer" className="sec-cve">{v.id} <Icon name="externalLink" size={11} /></a> : v.id}</span>
              <span><SevPill s={v.severity} /></span>
              <span className="sec-mono" title={v.pkg}>{v.pkg}{v.installedVersion ? ` @ ${v.installedVersion}` : ''}</span>
              <span className="sec-mono sec-ellip" title={v.image}>{v.image}</span>
              <span className="sec-mono">{v.fixedVersion || <em className="sec-dim">none</em>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Images ---------- */
function Images({ data, q, open, setOpen, onNavigate }) {
  const ql = q.toLowerCase();
  const images = (data?.images || []).filter((im) =>
    !ql || im.image.toLowerCase().includes(ql) || im.vulnerabilities.some((v) => v.id.toLowerCase().includes(ql)));
  if (!images.length) return <div className="sec-empty"><Icon name="shieldCheck" size={28} /><p>No image vulnerability reports{q ? ' match your search' : ''}.</p></div>;
  return (
    <div className="sec-rows">
      {images.map((im) => {
        const key = im.image;
        const isOpen = open === key;
        return (
          <div className={`sec-row ${isOpen ? 'open' : ''}`} key={key}>
            <button className="sec-row-head" onClick={() => setOpen(isOpen ? null : key)}>
              <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={14} className="sec-caret" />
              <span className="sec-row-name sec-mono" title={im.image}>{im.image}</span>
              <span className="sec-row-meta">{im.os || ''}</span>
              <span className="sec-row-bar"><SeverityBar summary={im.summary} compact /></span>
            </button>
            {isOpen && (
              <div className="sec-row-body">
                {im.workloads.length > 0 && (
                  <div className="sec-workloads">
                    <span className="sec-sub">Used by:</span>
                    {im.workloads.slice(0, 40).map((w, i) => (
                      <button key={i} className="sec-chip" onClick={() => onNavigate?.toResource?.({ type: (w.kind || '').toLowerCase(), namespace: w.namespace, name: w.name })} title={`${w.namespace}/${w.name}`}>
                        {w.kind || 'Workload'} · {w.name}
                      </button>
                    ))}
                  </div>
                )}
                <VulnTable vulns={im.vulnerabilities} q={q} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VulnTable({ vulns, q }) {
  const ql = q.toLowerCase();
  const rows = vulns.filter((v) => !ql || v.id.toLowerCase().includes(ql) || v.pkg.toLowerCase().includes(ql));
  if (!rows.length) return <div className="sec-dim" style={{ padding: '8px 4px' }}>No matching vulnerabilities.</div>;
  return (
    <div className="sec-table">
      <div className="sec-tr sec-th vt"><span>CVE</span><span>Severity</span><span>Package</span><span>Installed</span><span>Fixed in</span></div>
      {rows.map((v, i) => (
        <div className="sec-tr vt" key={v.id + i}>
          <span>{v.link ? <a href={v.link} target="_blank" rel="noreferrer" className="sec-cve">{v.id} <Icon name="externalLink" size={11} /></a> : v.id}</span>
          <span><SevPill s={v.severity} /></span>
          <span className="sec-mono" title={v.title || v.pkg}>{v.pkg}</span>
          <span className="sec-mono">{v.installedVersion}</span>
          <span className="sec-mono">{v.fixedVersion || <em className="sec-dim">none</em>}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Resources / Roles (config-audit + rbac checks) ---------- */
function Checks({ data, q, open, setOpen, label }) {
  const ql = q.toLowerCase();
  const rows = (data?.resources || []).filter((r) =>
    !ql || (r.name || '').toLowerCase().includes(ql) || r.checks.some((c) => (c.id + c.title).toLowerCase().includes(ql)));
  if (!rows.length) return <div className="sec-empty"><Icon name="shieldCheck" size={28} /><p>No {label} issues{q ? ' match your search' : ''}.</p></div>;
  return (
    <div className="sec-rows">
      {rows.map((r, ri) => {
        const key = `${r.kind}/${r.namespace}/${r.name}/${ri}`;
        const isOpen = open === key;
        return (
          <div className={`sec-row ${isOpen ? 'open' : ''}`} key={key}>
            <button className="sec-row-head" onClick={() => setOpen(isOpen ? null : key)}>
              <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={14} className="sec-caret" />
              <span className="sec-row-kind">{r.kind}</span>
              <span className="sec-row-name">{r.name}</span>
              <span className="sec-row-meta">{r.namespace}</span>
              <span className="sec-row-bar"><SeverityBar summary={r.summary} compact /></span>
            </button>
            {isOpen && (
              <div className="sec-row-body">
                <div className="sec-checks">
                  {r.checks.map((c, i) => (
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Setup / not-installed ---------- */
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
