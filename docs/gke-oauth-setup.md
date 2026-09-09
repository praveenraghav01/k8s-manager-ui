# GKE browser sign-in — one-time OAuth setup

k8sight can import **Google GKE** clusters two ways:

- **Browser sign-in** (recommended) — the user clicks *Sign in with browser*, authenticates with their own Google account, and k8sight stores a refresh token and mints access tokens for the kubeconfig. **No service-account key, no `gcloud`.** This is the Azure/AWS-style experience.
- **Service-account key** (fallback) — paste a service-account key JSON. Works out of the box with no OAuth client; ideal for CI or orgs that block the browser flow.

Browser sign-in needs a Google **OAuth "Desktop app" client**. You register **one** client (in a GCP project you own) and ship it with the app — then *every* user just signs in. This is exactly how `gcloud` and other desktop tools work, and Google explicitly treats desktop-app client secrets as **non-confidential**, so it is safe to embed.

This page is the one-time setup. It takes ~5 minutes and you only do it once (per app, not per user).

---

## 1. Pick or create a GCP project

Use any Google Cloud project you control — it only hosts the OAuth client's identity; it does **not** need to contain the clusters users will connect to.

<https://console.cloud.google.com/> → project picker → *New Project* (or choose an existing one).

## 2. Enable the required APIs

**APIs & Services → Library**, then enable both:

- **Kubernetes Engine API** (`container.googleapis.com`) — to list clusters
- **Cloud Resource Manager API** (`cloudresourcemanager.googleapis.com`) — to list projects

Direct links (swap in your project):
- `https://console.cloud.google.com/apis/library/container.googleapis.com`
- `https://console.cloud.google.com/apis/library/cloudresourcemanager.googleapis.com`

## 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen**

- **User type:** *External* (works for any Google account). *Internal* is fine if everyone is in your Workspace org.
- Fill in the app name, support email, and developer contact email.
- **Scopes:** add `https://www.googleapis.com/auth/cloud-platform` (or leave default and let the flow request it).
- **Test users:** while the consent screen is in *Testing* (unpublished), add the Google accounts that will sign in. (Publishing to *Production* removes this limit but may trigger Google's verification review for sensitive scopes.)

## 4. Create the OAuth client

**APIs & Services → Credentials → Create credentials → OAuth client ID**

- **Application type:** **Desktop app**
- Name it (e.g. `k8sight desktop`)
- Click **Create**, then copy the **Client ID** and **Client secret**.

> Desktop-app clients use a loopback redirect (`http://127.0.0.1:<random-port>/callback`) that k8sight opens automatically — you don't configure redirect URIs.

## 5. Give it to k8sight

Two options — pick one:

**A. Bake it into the build** (so shipped installers have browser sign-in on by default). Edit [`gke.js`](../gke.js):

```js
const DEFAULT_CLIENT_ID = '1234567890-abc.apps.googleusercontent.com';
const DEFAULT_CLIENT_SECRET = 'GOCSPX-...';
```

**B. Environment variables** (no code change — good for dev or per-machine):

```bash
export GOOGLE_CLIENT_ID='1234567890-abc.apps.googleusercontent.com'
export GOOGLE_CLIENT_SECRET='GOCSPX-...'
```

Env vars override the baked-in defaults.

## 6. Use it

Restart k8sight. In **Preferences → Cloud Integrations → Add GKE clusters** (or the **Add GKE** button in the context dropdown):

1. Click **Sign in with browser** → your browser opens Google sign-in.
2. Pick your account and approve.
3. k8sight discovers your GKE clusters across all accessible projects.
4. Select clusters → **Add** → they're written to your kubeconfig.

Using the clusters needs no `gcloud`/`gke-gcloud-auth-plugin`: the bundled [`gke-token.js`](../gke-token.js) mints a fresh access token from the stored refresh token whenever `kubectl` / the app authenticates.

---

## How auth works (for reference)

- Sign-in uses **OAuth 2.0 authorization code + PKCE** with a **loopback** redirect — Google's recommended flow for installed apps.
- k8sight stores the credentials at `~/.config/k8s-manager/gke/credentials.json` (mode `600`):
  - browser sign-in → `{ type: 'authorized_user', client_id, client_secret, refresh_token }`
  - service-account key → the key JSON (`type: 'service_account'`)
- The kubeconfig `user` runs an `exec` credential plugin: `gke-token.js --credentials <path>`, which prints an `ExecCredential` with a short-lived access token. Clients refresh automatically.
- Users only ever get the access **their own Google IAM allows** — the shipped OAuth client is just the app's identity, not an authorization grant.

## Troubleshooting

- **"Sign in with browser" isn't shown** → no client id is configured; set it per step 5 (until then only the service-account-key option appears).
- **`access_denied` / "app isn't verified"** → add the account under **Test users**, or publish the consent screen.
- **`invalid_grant` / no refresh token** → the flow requests `access_type=offline&prompt=consent`; make sure you approved the consent screen. Remove `~/.config/k8s-manager/gke/credentials.json` and retry.
- **No clusters found** → the signed-in account needs at least *Kubernetes Engine Viewer* + *Browser* (or *Viewer*) IAM on the projects, and the two APIs (step 2) must be enabled in those projects.
- **Private clusters** → a cluster with no public endpoint can't be reached from a desktop; use its private endpoint over VPN/Connect Gateway, or import via a reachable endpoint.
