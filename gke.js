// CLI-free Google GKE integration — no `gcloud`, no gke-gcloud-auth-plugin.
// Mirrors the AWS EKS / Azure AKS integrations. Two sign-in methods:
//   * Service account key (JSON)  — works out of the box, no OAuth client.
//   * Browser (OAuth 2.0 auth-code + PKCE, loopback) — needs a Google "Desktop
//     app" OAuth client (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
// Clusters are discovered via the Cloud Resource Manager + GKE REST APIs, and
// kubeconfig entries exec our native gke-token.js helper for token refresh.
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import crypto from 'crypto';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const GKE_TOKEN_HELPER = path.join(__dirname, 'gke-token.js');

const CONFIG_DIR = path.join(process.env.HOME || os.homedir(), '.config', 'k8s-manager', 'gke');
const CREDS_FILE = path.join(CONFIG_DIR, 'credentials.json');
const kubeconfigPath = () => process.env.KUBECONFIG || path.join(process.env.HOME || os.homedir(), '.kube', 'config');

const OAUTH_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

// OAuth "Desktop app" client for browser sign-in (keyless, like Azure/AWS).
// The client id/secret are NOT committed. They come from, in order:
//   1. GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars, or
//   2. a gitignored gke-oauth.json next to this file ({ clientId, clientSecret }),
//      which `scripts/write-gke-oauth.mjs` generates from those env vars at build
//      time so shipped installers embed the client without it living in git.
// If neither is present, only the service-account-key sign-in is offered.
// (Google treats installed-app client secrets as non-confidential — see
//  docs/gke-oauth-setup.md.)
function readOAuthFile() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'gke-oauth.json'), 'utf8')); } catch { return {}; }
}
const oauthFile = readOAuthFile();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || oauthFile.clientId || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || oauthFile.clientSecret || '';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

// ---- stored credentials ---------------------------------------------------
function saveCreds(obj) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CREDS_FILE, JSON.stringify(obj, null, 2), { mode: 0o600 });
  return CREDS_FILE;
}
export function readCreds() {
  try { return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8')); } catch { return null; }
}
export function signOut() { try { fs.rmSync(CREDS_FILE); } catch { /* ignore */ } }
export function getStatus() {
  const c = readCreds();
  return {
    installed: true, // REST-based — always available
    loggedIn: !!c,
    method: c?.type === 'service_account' ? 'key' : c?.type === 'authorized_user' ? 'browser' : null,
    account: c?.client_email || null,
    oauthConfigured: !!(CLIENT_ID && CLIENT_SECRET),
  };
}

// ---- access tokens --------------------------------------------------------
export async function accessTokenFromServiceAccount(key) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = { iss: key.client_email, scope: OAUTH_SCOPE, aud: key.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(input), key.private_key);
  const assertion = `${input}.${b64url(sig)}`;
  const res = await fetch(key.token_uri || 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'token exchange failed');
  return data.access_token;
}

export async function accessTokenFromRefresh(creds) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: creds.refresh_token, client_id: creds.client_id, client_secret: creds.client_secret }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'refresh failed');
  return data.access_token;
}

async function accessTokenFor(creds) {
  if (creds?.type === 'service_account') return accessTokenFromServiceAccount(creds);
  if (creds?.type === 'authorized_user') return accessTokenFromRefresh(creds);
  throw new Error('Not signed in to Google');
}

// ---- Google REST ----------------------------------------------------------
async function gapi(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `request failed (${res.status})`);
  return data;
}

export async function listProjects(token) {
  const data = await gapi(token, 'https://cloudresourcemanager.googleapis.com/v1/projects?filter=lifecycleState:ACTIVE');
  return (data.projects || []).map((p) => ({ projectId: p.projectId, name: p.name }));
}

export async function listClustersForProject(token, projectId) {
  const data = await gapi(token, `https://container.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/locations/-/clusters`);
  return (data.clusters || []).map((c) => ({
    project: projectId, name: c.name, location: c.location, status: c.status,
    endpoint: c.endpoint, ca: c.masterAuth?.clusterCaCertificate, version: c.currentMasterVersion,
  }));
}

// Discover GKE clusters across every accessible project.
export async function discoverClusters(creds = readCreds()) {
  const token = await accessTokenFor(creds);
  const projects = await listProjects(token);
  const all = [];
  await Promise.all(projects.map(async (p) => {
    try { all.push(...await listClustersForProject(token, p.projectId)); }
    catch { /* project without GKE / insufficient permissions — skip */ }
  }));
  return all;
}

// Validate + persist a service-account key, returning discovered clusters.
export async function loginWithServiceAccount(keyJson) {
  const key = typeof keyJson === 'string' ? JSON.parse(keyJson) : keyJson;
  if (key?.type !== 'service_account' || !key.private_key || !key.client_email) {
    throw new Error('That is not a valid service-account key JSON.');
  }
  await accessTokenFromServiceAccount(key); // throws on bad key
  saveCreds(key);
  return discoverClusters(key);
}

// ---- browser OAuth (loopback + PKCE) --------------------------------------
let pending = null; // { server, status, error }

export function startBrowserLogin() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Google OAuth client not configured. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, or use a service-account key.');
  }
  cancelLogin();
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));

  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      if (!u.pathname.startsWith('/callback')) { res.writeHead(404); return res.end(); }
      const code = u.searchParams.get('code');
      if (u.searchParams.get('state') !== state || !code) {
        pending.status = 'error'; pending.error = 'state/code mismatch';
        res.end('Sign-in failed. You can close this window.'); try { server.close(); } catch {}; return;
      }
      try {
        const tok = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: pending.redirectUri, code_verifier: verifier }),
        }).then((r) => r.json());
        if (!tok.refresh_token) throw new Error(tok.error_description || 'no refresh token returned');
        saveCreds({ type: 'authorized_user', client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: tok.refresh_token });
        pending.status = 'done';
        res.end('Signed in to Google. You can close this window and return to k8sight.');
      } catch (e) {
        pending.status = 'error'; pending.error = e.message;
        res.end('Sign-in failed: ' + e.message);
      } finally { try { server.close(); } catch {} }
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: OAUTH_SCOPE,
        access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256',
      });
      pending = { server, redirectUri, status: 'pending', error: null };
      resolve({ authUrl });
    });
  });
}
export function loginStatus() { return pending ? { status: pending.status, error: pending.error } : { status: 'idle' }; }
export function cancelLogin() { if (pending?.server) { try { pending.server.close(); } catch {} } pending = null; }

// ---- write kubeconfig -----------------------------------------------------
function loadKube() {
  const p = kubeconfigPath();
  let doc = { apiVersion: 'v1', kind: 'Config', clusters: [], users: [], contexts: [], 'current-context': '' };
  if (fs.existsSync(p)) { try { doc = yaml.load(fs.readFileSync(p, 'utf8')) || doc; } catch { /* keep default */ } }
  doc.clusters = doc.clusters || []; doc.users = doc.users || []; doc.contexts = doc.contexts || [];
  return { p, doc };
}
function upsert(arr, name, entry) { const i = arr.findIndex((x) => x.name === name); if (i >= 0) arr[i] = entry; else arr.push(entry); }

// Merge one GKE cluster into the kubeconfig. Auth is delegated to gke-token.js,
// which reads the stored credentials and mints a fresh access token each call.
export function writeCluster({ name, location, project, endpoint, ca, alias }) {
  if (!endpoint || !ca) throw new Error('cluster is missing endpoint/CA (private cluster without a public endpoint?)');
  const ctxName = alias || `gke_${project}_${location}_${name}`;
  const { p, doc } = loadKube();
  upsert(doc.clusters, ctxName, { name: ctxName, cluster: { server: `https://${endpoint}`, 'certificate-authority-data': ca } });
  upsert(doc.users, ctxName, {
    name: ctxName,
    user: {
      exec: {
        apiVersion: 'client.authentication.k8s.io/v1beta1',
        command: process.execPath, // node / electron-as-node
        args: [GKE_TOKEN_HELPER, '--credentials', CREDS_FILE],
        interactiveMode: 'Never',
        provideClusterInfo: false,
      },
    },
  });
  upsert(doc.contexts, ctxName, { name: ctxName, context: { cluster: ctxName, user: ctxName } });
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, yaml.dump(doc), 'utf8');
  return ctxName;
}
