# Azure AKS — connect your clusters

k8sight imports **Azure AKS** clusters with **no `az` CLI required** (though you can use it if you prefer). Unlike GKE, there is **nothing for a maintainer to register** — the browser flow reuses the Azure CLI's well-known **public** client id, so it works out of the box.

Two sign-in methods:

- **Browser (recommended)** — Azure AD authorization-code + PKCE in your system browser, then the Azure Resource Manager (ARM) REST API. Because the sign-in happens in your real browser, it carries your device's compliance state, so it **works with managed-device Conditional Access** policies.
- **Azure CLI (`az`)** — if `az` is installed and you're already logged in (`az login`), k8sight can drive it instead. Useful if the browser flow is blocked.

Either way k8sight discovers **every AKS cluster you can access across all subscriptions** and writes the ones you pick into your kubeconfig.

---

## Use it

**Preferences → Cloud Integrations → Add Azure clusters**, or the **Add Azure** button in the context dropdown.

1. Click **Sign in with browser** (or *Use the Azure CLI* if you prefer).
2. Pick your account and complete sign-in in the browser.
3. k8sight lists your AKS clusters across all subscriptions.
4. Select clusters → **Add** → they're written to your kubeconfig and appear in the context switcher.

An **Add Azure** option also appears on the "couldn't connect" screen, so an expired Azure session is one click from re-auth.

## Permissions you need

The signed-in identity needs, per the clusters you want:

- **List clusters:** *Reader* (or any role that can read AKS resources) on the subscription(s) / resource group(s).
- **Get user credentials** (default): the **Azure Kubernetes Service Cluster User Role** on the cluster. This returns a normal, AAD-aware kubeconfig entry.
- **Admin credentials** (optional toggle, `--admin`): the **Azure Kubernetes Service Cluster Admin Role**. This returns cluster-admin client certificates that **bypass Azure AD** — handy when AAD/RBAC is getting in the way, but it's cluster-admin, so use sparingly.

Then, in-cluster, your Kubernetes RBAC still applies as usual.

## AAD-integrated clusters

If the AKS cluster uses **Azure AD integration** (no local accounts), the user kubeconfig it hands back authenticates via an exec plugin (`kubelogin`). k8sight merges that entry; **using** such a cluster then needs `kubelogin` on your `PATH` (or pick **admin credentials**, which use certs and need no plugin). Clusters with local accounts enabled work with no extra tooling.

---

## How auth works (for reference)

- Browser sign-in uses **OAuth 2.0 authorization code + PKCE** with a loopback redirect and the Azure CLI's public client id `04b07795-8ddb-461a-bbee-02f9e1bf7b46`, scope `https://management.azure.com/.default offline_access`.
- Cluster discovery calls the **ARM REST API** (`management.azure.com`) — list subscriptions, then AKS managed clusters.
- Import calls `listClusterUserCredential` (or `listClusterAdminCredential` with the admin toggle) and merges the returned kubeconfig into `~/.kube/config`.
- No credentials are stored beyond the standard kubeconfig entry; the browser session's refresh token lives only for the sign-in.

## Troubleshooting

- **"Help us keep your device secure" / Conditional Access blocks it** → use **Sign in with browser** (not device code) — it carries device compliance. If your org still blocks it, fall back to **Use the Azure CLI** after `az login` on a compliant session.
- **No subscriptions / no clusters** → the account needs at least *Reader* on the subscription; confirm you signed in with the right tenant/account (the flow shows an account picker).
- **Cluster imports but `kubectl` fails with an exec error** → it's an AAD cluster needing `kubelogin`; install it, or re-import with **admin credentials**.
- **Wrong tenant** → sign out of Azure in the browser (or use an incognito window) and retry so you can pick the correct account/tenant.
