// ============================================================
// Built-in image scanning with a bundled `trivy` — so the Security Center works
// without installing the Trivy Operator in the user's cluster.
//
// We enumerate the images the cluster is actually running (from Pods) and run
// `trivy image --format json` on each with the app's own binary, then aggregate
// into the exact shape the /api/security/vulnerabilities endpoint returns, so
// the frontend's Overview / Images views render identically to operator data.
//
// trivy is resolved from TRIVY_BIN, then a bundled path next to the app, then
// PATH. The Docker image installs it; desktop builds ship it in resources.
// ============================================================
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Candidate locations for a bundled binary (electron unpacks to resources/bin).
const BUNDLED = [
  process.env.TRIVY_BIN,
  path.join(__dirname, 'bin', 'trivy'),
  path.join(__dirname, 'bin', process.platform === 'win32' ? 'trivy.exe' : 'trivy'),
  process.resourcesPath && path.join(process.resourcesPath, 'bin', 'trivy'),
].filter(Boolean);

let _bin = null;
export function trivyBin() {
  if (_bin) return _bin;
  for (const p of BUNDLED) { try { if (fs.existsSync(p)) { _bin = p; return _bin; } } catch { /* ignore */ } }
  _bin = 'trivy'; // fall back to PATH
  return _bin;
}

export async function trivyAvailable() {
  try {
    const { stdout } = await execFileAsync(trivyBin(), ['--version'], { timeout: 8000 });
    return { available: true, version: (stdout.match(/Version:\s*([^\s]+)/) || [])[1] || stdout.split('\n')[0].trim() };
  } catch {
    return { available: false };
  }
}

// Every unique running image → the pods using it.
export function listClusterImages(pods, namespace) {
  const byImage = new Map();
  for (const p of pods) {
    const ns = p.metadata?.namespace || '';
    if (namespace && namespace !== 'all' && ns !== namespace) continue;
    const owner = p.metadata?.ownerReferences?.[0];
    const spec = p.spec || {};
    const containers = [...(spec.containers || []), ...(spec.initContainers || []), ...(spec.ephemeralContainers || [])];
    for (const c of containers) {
      const image = c.image;
      if (!image) continue;
      if (!byImage.has(image)) byImage.set(image, []);
      byImage.get(image).push({ kind: owner?.kind || 'Pod', name: owner?.name || p.metadata?.name, namespace: ns, container: c.name });
    }
  }
  return byImage;
}

const SEV = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'];
const emptySummary = () => ({ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 });

// Scan one image → { os, summary, vulnerabilities[] } in our model's shape.
export async function scanImage(image) {
  const args = ['image', '--quiet', '--format', 'json', '--scanners', 'vuln', '--timeout', '5m', image];
  const { stdout } = await execFileAsync(trivyBin(), args, { timeout: 6 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  const rep = JSON.parse(stdout || '{}');
  const summary = emptySummary();
  const seen = new Set();
  const vulnerabilities = [];
  for (const r of (rep.Results || [])) {
    for (const v of (r.Vulnerabilities || [])) {
      const sev = (v.Severity || 'UNKNOWN').toUpperCase();
      if (summary[sev] != null) summary[sev]++;
      const key = `${v.VulnerabilityID}|${v.PkgName}|${v.InstalledVersion}`;
      if (seen.has(key)) continue; seen.add(key);
      vulnerabilities.push({
        id: v.VulnerabilityID, severity: sev, pkg: v.PkgName || '',
        installedVersion: v.InstalledVersion || '', fixedVersion: v.FixedVersion || '',
        title: v.Title || v.Description || '', link: v.PrimaryURL || (v.References || [])[0] || '',
        score: v.CVSS?.nvd?.V3Score || v.CVSS?.redhat?.V3Score,
      });
    }
  }
  const os = rep.Metadata?.OS ? `${rep.Metadata.OS.Family || ''} ${rep.Metadata.OS.Name || ''}`.trim() : '';
  return { os, summary, vulnerabilities };
}

// A single in-flight scan, progress tracked on this module-level object so
// GET /api/security/scan can report it and return the result when done.
export const scanState = {
  running: false, done: false, total: 0, scanned: 0, startedAt: null, finishedAt: null,
  error: null, images: null, summary: emptySummary(), results: { ok: 0, vulnerable: 0 }, scanned_count: 0,
};

function resetScan() {
  Object.assign(scanState, {
    running: true, done: false, total: 0, scanned: 0, startedAt: new Date().toISOString(),
    finishedAt: null, error: null, images: null, summary: emptySummary(), results: { ok: 0, vulnerable: 0 },
  });
}

const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
const sevTotal = (s) => SEV.reduce((n, k) => n + (s[k] || 0), 0);

// Kick off a scan of every running image (bounded concurrency). Returns quickly;
// progress + result live on scanState.
export async function startScan(byImage) {
  if (scanState.running) return scanState;
  resetScan();
  const entries = [...byImage.entries()];
  scanState.total = entries.length;
  const out = [];
  const total = emptySummary();
  const CONCURRENCY = 3;
  let cursor = 0;
  const worker = async () => {
    while (cursor < entries.length) {
      const [image, workloads] = entries[cursor++];
      let scan;
      try { scan = await scanImage(image); }
      catch (e) { scan = { os: '', summary: emptySummary(), vulnerabilities: [], error: (e.message || 'scan failed').split('\n')[0] }; }
      for (const k of SEV) total[k] += scan.summary[k];
      scan.vulnerabilities.sort((a, b) => order[a.severity] - order[b.severity] || (b.score || 0) - (a.score || 0));
      const tag = (image.split(':')[1] || '').split('@')[0];
      out.push({
        image, repository: image.split(':')[0], tag, digest: (image.split('@')[1] || ''),
        os: scan.os, namespace: workloads[0]?.namespace || '', status: scan.error ? 'Failed' : 'Scanned',
        scanner: 'Trivy (built-in)', scannedAt: new Date().toISOString(),
        summary: scan.summary, criticalCount: scan.summary.CRITICAL, workloads, vulnerabilities: scan.vulnerabilities,
        scanError: scan.error,
      });
      scanState.scanned++;
    }
  };
  // Run workers in the background; don't block the HTTP response.
  Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length || 1) }, worker))
    .then(() => {
      out.sort((a, b) => (b.summary.CRITICAL - a.summary.CRITICAL) || (b.summary.HIGH - a.summary.HIGH));
      const vulnerable = out.filter((g) => sevTotal(g.summary) > 0).length;
      Object.assign(scanState, {
        running: false, done: true, finishedAt: new Date().toISOString(), images: out, summary: total,
        results: { vulnerable, ok: out.length - vulnerable },
      });
    })
    .catch((e) => { Object.assign(scanState, { running: false, done: true, error: (e.message || 'scan failed').split('\n')[0] }); });
  return scanState;
}
