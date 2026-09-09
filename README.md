# k8sight

[![Build & Release](https://github.com/praveenraghav01/k8s-manager-ui/actions/workflows/release.yml/badge.svg)](https://github.com/praveenraghav01/k8s-manager-ui/actions/workflows/release.yml)
[![Latest release](https://img.shields.io/github/v/release/praveenraghav01/k8s-manager-ui?sort=semver)](https://github.com/praveenraghav01/k8s-manager-ui/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/praveenraghav01/k8s-manager-ui/total)](https://github.com/praveenraghav01/k8s-manager-ui/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Platforms](https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-informational)
![Built with Electron](https://img.shields.io/badge/built%20with-Electron-47848F?logo=electron&logoColor=white)

A beautiful, native **desktop app** (macOS · Windows · Linux) — and a Docker image — for browsing and operating any Kubernetes cluster from your local `kubeconfig`.

![k8sight — cluster dashboard](docs/screenshot-dashboard.png)

> **Download:** grab the latest macOS `.dmg`, Windows `.exe`, or Linux `.AppImage`/`.deb` from the [**Releases**](https://github.com/praveenraghav01/k8s-manager-ui/releases/latest) page. See [Run — Desktop app](#run--desktop-app-electron) to build it yourself, or [Run — Docker](#run--docker) to run it anywhere.

## Features

- **Native desktop app** — packaged for **macOS, Windows and Linux** (plus a Docker image), with a native title bar (traffic lights, back/forward history) and a right-side launcher that shows the chosen AI model/agent.
- **Command palette (⌘K)** — a Spotlight-style palette to jump to any view, cluster, or action from the keyboard.
- **Built-in AI assistant (bring your own LLM)** — a read-only, tool-using debugging session over live cluster data; connect any OpenAI-compatible endpoint (TrueFoundry, OpenAI, Azure OpenAI, LiteLLM, …). Secrets are redacted before anything leaves the app.
- **Docked coding agents** — detects **Claude Code, GitHub Copilot CLI, Gemini CLI, Codex and opencode** on your `PATH` and opens the one you pick in a panel beside the pod terminal. External tools are shown with their official logos.
- **One-click Azure AKS integration** — two sign-in methods: **Browser** (CLI-free — Azure AD auth-code + PKCE in your system browser + the ARM REST API; works with managed-device Conditional Access, since the browser carries the device's compliance state) or the **Azure CLI (`az`)** if you prefer it or the browser flow is blocked. Either way, auto-discover every AKS cluster you can access across all subscriptions and add the ones you pick to your kubeconfig in one step. Also offered on the "could not connect" screen, so an expired Azure session is one click from re-auth. See [Azure setup & permissions](docs/azure-aks-setup.md).
- **One-click AWS EKS integration** — the same, for EKS, and **no `aws` CLI required**: it's built on the AWS SDK, so sign-in and discovery run in-process. Sign in via **AWS SSO** (IAM Identity Center device flow — enter your start URL or pick a profile), **access keys** (IAM user), or an **assume-role** profile, then auto-discover every EKS cluster across **all accounts and regions** and add the ones you pick. Cluster auth is generated natively (a bundled `eks-token.js` helper signs the STS request), so even *using* the imported clusters needs no `aws` binary. See [AWS setup & permissions](docs/aws-eks-setup.md).
- **One-click Google GKE integration** — and **no `gcloud` / gke-gcloud-auth-plugin required**. Sign in with your **browser** (OAuth 2.0 auth-code + PKCE — see [one-time OAuth setup](docs/gke-oauth-setup.md)) or a **service-account key** (JSON — works out of the box), then auto-discover every GKE cluster across all your **projects** and add the ones you pick. A bundled `gke-token.js` helper mints access tokens for the kubeconfig, so using the clusters needs no Google CLI.
- **Cluster overview** — live dashboard (node/pod health donuts, workload charts, capacity)
- **Workloads** — Pods, Deployments, StatefulSets, DaemonSets, Services, etc. with live CPU/memory (metrics-server), per-container status boxes, and cross-links (namespace → node → pod → owner)
- **Nodes** — live per-node CPU/memory graphs with capacity thresholds, and the pods running on each node
- **Namespaces** — searchable list; click a namespace to filter its workloads
- **Topology** — interactive pan/zoom graph of Deployment → ReplicaSet → Pod → Service relationships
- **Custom Resources** — lazy-loaded sidebar tree (group → kind → instance) with YAML details
- **ArgoCD** — auto-detected when its CRDs are present. A GitOps dashboard (fleet-health status bar, summary cards, "Needs attention", recent activity) plus **Applications / View / ApplicationSets / Projects / Settings → Repositories / Clusters** views and an "Open Argo CD UI" link. The **View** tab is a Topology-style, pan/zoom resource graph: pick a namespace + application to see the Application and all of its managed resources as an interactive tree (Deployment → ReplicaSet → Pod inferred), colour-coded by sync/health — a single view for tracking one app. The dashboard's Applications card and the Applications-tab selection both open a **Sync / Refresh** dialog with per-app checkboxes, all / out-of-sync / none presets, prune, and normal/hard refresh. Application drawer shows properties, source (clickable repo), destination, sync policy, last operation, a resource tree, deploy history, and events; actions include Sync (prune/dry-run/force/replace, two-step confirm), Refresh (normal or hard), roll-back-to-revision, and Delete (cascade or orphan, two-step confirm)
- **Ask AI → Summarize** — right-click any ArgoCD Application (or use the drawer) to hand the resource to the built-in assistant, which analyzes its sync/health condition using cluster context and suggests fixes
- **Edit & apply** — edit any resource's YAML and apply it; per-row and drawer actions for Scale, Rollout restart, and Delete (two-step confirm)
- **Helm** — releases with values and rendered manifest
- **Detail drawer** — slide-in right-side panel with metadata, live metric graphs, conditions, containers
- **Pro log viewer** — timestamps, per-container or merged "all containers" streams, case-sensitive/regex search with match navigation, line wrap, tail size, and one-click download
- **Interactive shell** — a real TTY into pods (`kubectl exec -it` streamed over WebSocket to xterm.js)
- **Port forwarding** — forward a Service port to `localhost` (choose a port or get a random one)
- **Multi-tab bottom panel** — logs/terminal/YAML tabs open side by side
- **Light & dark themes** with persistence

## Prerequisites

- **Node.js 20+** and npm (24 recommended) — for building from source or the Docker image; the packaged desktop app bundles its own runtime
- **`kubectl`** on your `PATH` — the app shells out to it for metrics, topology, CRDs, port-forward, etc.
- **`helm`** (v3) on your `PATH` — for the Helm releases view
- A working **`kubeconfig`** (default `~/.kube/config`, or set `KUBECONFIG`) with access to a cluster

Verify:

```bash
kubectl version --client
helm version
kubectl get nodes   # confirms cluster access
```

## Install

```bash
npm install
cd client && npm install && cd ..
```

## Run — development (hot reload)

```bash
npm run dev
```

- Frontend (Vite): **http://localhost:3000**  ← open this
- Backend (API + WebSocket): **http://localhost:3001** (Vite proxies `/api` and `/ws` to it)

## Run — production (single port)

Build the frontend, then start the server, which serves both the UI and the API on one port:

```bash
npm run build     # builds client/dist
npm start         # serves everything on http://localhost:3001
```

Open **http://localhost:3001**.

## Run — Docker

The image bundles Node, `kubectl`, and the `kubelogin` OIDC plugin, and serves
the UI + API on port `3001`. It runs as the unprivileged `node` user, so mount
your kubeconfig under **`/home/node/.kube`**.

**Run the published image** (from GitHub Container Registry):

```bash
docker run --rm -p 8080:3001 \
  -v "$HOME/.kube:/home/node/.kube:ro" \
  praveenraghav/k8s-manager-ui:latest
```

**Or build it locally:**

```bash
docker build -t k8s-manager .

docker run --rm -p 8080:3001 \
  -v "$HOME/.kube:/home/node/.kube:ro" \
  k8s-manager
```

Open **http://localhost:8080**.

Notes:
- Mount your kubeconfig at `/home/node/.kube/config` (as above) or pass `-e KUBECONFIG=/path/inside/container`.
- If your kubeconfig references cloud auth plugins (EKS/GKE/AKS exec credentials), those CLIs must be available inside the container too, or use a static-token kubeconfig.
- **Local clusters (Docker Desktop / kind / minikube):** their API server listens on `127.0.0.1`, which inside a container points at the container itself — so the config loads but the connection fails. Reach the host instead: add `--add-host=host.docker.internal:host-gateway` and set the context's `server:` to `https://host.docker.internal:<port>` with `insecure-skip-tls-verify: true` — or simply use the native desktop app / `npm start` for local clusters.
- The build auto-selects `amd64`/`arm64` via BuildKit's `TARGETARCH`.

### OIDC clusters (`kubectl oidc-login` / kubelogin)

The `kubelogin` plugin is bundled, so contexts that authenticate with
`kubectl oidc-login` work — **but the container can't open a browser**, so it
relies on a token that's already cached. Do this:

1. **Log in on the host first** so a token is cached under `~/.kube/cache/oidc-login/`:
   ```bash
   kubectl get nodes            # triggers the browser login on your machine
   ```
2. **Mount `~/.kube` read-write** (drop the `:ro`) so kubelogin can refresh and
   re-cache the token from inside the container:
   ```bash
   docker run --rm -p 8080:3001 \
     -v "$HOME/.kube:/home/node/.kube" \
     praveenraghav/k8s-manager-ui:latest
   ```

If the cached token has fully expired (refresh token gone), re-run step 1 on the
host, then restart the container.

## Run — Desktop app (Electron)

k8sight ships as a native desktop app. Most people just [download a build](https://github.com/praveenraghav01/k8s-manager-ui/releases/latest); to build it yourself:

```bash
npm ci                     # installs Electron + electron-builder (first time)
npm ci --prefix client
npm run dist               # builds the UI and packages for the current OS → release/
```

`npm run dist` produces the installer for whatever OS you run it on:

| OS | Artifact |
|----|----------|
| macOS | `k8sight-<ver>-arm64.dmg` (Apple Silicon) |
| Windows | `k8sight Setup <ver>.exe` (NSIS) |
| Linux | `k8sight-<ver>.AppImage` and `k8sight_<ver>_amd64.deb` |

To try it without packaging:

```bash
npm run app          # runs the UI in an Electron window (uses the current client/dist)
npm run app:pack     # builds an unpacked app into release/ (faster than a full package)
```

How it works: the Electron main process (`electron/main.cjs`) starts `server.js`
as a child using Electron's bundled Node, waits for port `3001`, then loads the
UI in a window. Because a launched app doesn't inherit your shell `PATH`, the main
process reconstructs it (querying your login shell + the usual Homebrew/`~/.local/bin`
paths) so `kubectl` is found at runtime.

Notes:
- `kubectl` still has to be installed on the machine — the app shells out to it.
- Builds are **unsigned / ad-hoc signed** (no paid code-signing certificate). On macOS the
  `.dmg` is ad-hoc signed by `electron/after-pack.cjs` so it runs locally; copied to
  *another* Mac it's quarantined, so the recipient right-clicks → **Open** or runs
  `xattr -dr com.apple.quarantine "/Applications/k8sight.app"`. On Windows, SmartScreen
  shows **More info → Run anyway**. For frictionless distribution, add a Developer ID
  signature + notarization (macOS) and an EV/OV cert (Windows).

## Release (GitHub Actions)

The [`Build & Release`](.github/workflows/release.yml) workflow builds the app for
macOS, Windows and Linux on GitHub-hosted runners and attaches the installers to a
GitHub Release. To cut a release, bump the version and push a matching `v*.*.*` tag:

```bash
npm version 1.4.0 --no-git-tag-version   # bump package.json (or edit it by hand)
git commit -am "Release v1.4.0"
git tag v1.4.0
git push origin main --tags
```

The tag push runs a **parallel matrix build** across `macos-14` (Apple Silicon),
`windows-latest` and `ubuntu-latest`, then publishes the installers (macOS `.dmg`,
Windows `.exe`, Linux `.AppImage` + `.deb`) to one GitHub Release with
auto-generated notes. Keep the tag in sync with `version` in `package.json`. You
can also run the workflow manually from the **Actions** tab to produce build
artifacts without publishing a release.

## Usage

1. **Command palette** — press **⌘K** (Ctrl+K) to jump to any view, cluster, or action; use the top toolbar's back/forward arrows to retrace your steps.
2. **Pick a context** — the searchable selector in the sidebar switches clusters (`kubectl config use-context`); pin favourites to the left rail for one-click switching.
3. **Add a cloud cluster** — the **+** button → **AWS** or **Azure** discovers your EKS/AKS clusters and merges the ones you pick into your kubeconfig.
4. **Filter namespaces** — the multi-select in each view, or click a namespace name anywhere.
5. **Click a row** — opens the right-side detail drawer (with live metric graphs for pods).
6. **⋮ menu** — per row: Details, Logs (expands to pick a container), Terminal, Edit YAML.
7. **Port-forward** — open a Service's drawer → Port Forwarding → Forward.
8. **AI & agents** — launch the built-in assistant or your chosen coding agent from the top toolbar; configure them in **Preferences → AI / External Tools**.
9. **Toggle theme** — the sun/moon button in the sidebar header.

## Connect AI agents (MCP)

The app doubles as an [MCP](https://modelcontextprotocol.io) server, so any
MCP-compatible AI agent (Claude Desktop, Claude Code, Cursor, …) can inspect and
operate the cluster it's connected to. It exposes the same capabilities as the
UI. **Read tools:** `list_contexts`, `switch_context`, `list_namespaces`,
`list_resources`, `get_resource`, `get_resource_yaml`, `get_pod_logs`,
`get_events`, `get_topology`, `get_cluster_summary`, `list_nodes`,
`get_node_pods`, `get_node_metrics`, `get_pod_metrics`, `list_pod_metrics`,
`list_storage`, `get_rbac`, `list_helm_releases`, `get_helm_values`,
`get_helm_manifest`, `list_crds`, `list_custom_resources`, `get_custom_resource`,
`get_argocd_status`, `list_argocd_apps`, `get_argocd_app`, `list_argocd_projects`,
`list_argocd_appsets`, `list_argocd_repositories`, `list_argocd_clusters`. Plus
**write** tools (`apply_yaml`, `delete_resource`, `scale_workload`,
`rollout_restart`, `sync_argocd_app`, `refresh_argocd_app`).

Write tools are **off by default**. Toggle them in the app under
**Preferences → MCP Server → Write access** (persisted), or start the server with
`MCP_ALLOW_WRITE=1`. Changes apply to new agent connections — reconnect the agent
to pick up the new tool set.

**HTTP transport** (recommended) — while the app is running, agents connect to:

```
http://localhost:3001/mcp
```

Example Claude Code registration:

```bash
claude mcp add --transport http k8s-manager http://localhost:3001/mcp
```

**Stdio transport** — for agents launched by command (e.g. Claude Desktop).
The app must be running; this bridge talks to its API:

```jsonc
// claude_desktop_config.json
{
  "mcpServers": {
    "k8s-manager": {
      "command": "node",
      "args": ["/absolute/path/to/k8s-manager-ui/mcp-stdio.js"],
      "env": { "MCP_API_BASE": "http://127.0.0.1:3001", "MCP_ALLOW_WRITE": "0" }
    }
  }
}
```

Run it standalone with `npm run mcp`. All tools act on the **currently selected
context** — switch clusters from the UI, the `switch_context` tool, or a pin.

## Configuration

| Variable | Purpose | Default |
|----------|---------|---------|
| `KUBECONFIG` | Path to kubeconfig | `~/.kube/config` |
| `LLM_BASE_URL` | OpenAI-compatible endpoint for the built-in AI assistant | — |
| `LLM_API_KEY` | API key for the assistant's endpoint (stored locally; also settable in **Preferences → AI**) | — |
| `LLM_MODEL` | Model name the assistant requests | — |
| `MCP_ALLOW_WRITE` | Enable MCP write/destructive tools (`apply_yaml`, `delete_resource`, `scale_workload`, `rollout_restart`) | `0` (read-only) |
| `MCP_API_BASE` | API base URL the stdio MCP bridge targets | `http://127.0.0.1:3001` |

The backend always listens on port **3001**; map it to any host port with Docker (`-p <host>:3001`).

## Architecture

- **Backend** (`server.js`) — Express + `@kubernetes/client-node`. Reads the kubeconfig, exposes a REST API and a `/ws/exec` WebSocket for interactive shells, and shells out to `kubectl`/`helm` for features without a clean typed-API path. Responses are cached with short TTLs; in production it also serves the built frontend.
- **Frontend** (`client/`) — React + Vite. Same-origin calls to `/api/*` and `/ws/exec`, xterm.js terminal, token-driven theming, a ⌘K command palette, and a native top toolbar.
- **Cloud** (`aws-eks.js`, `azure-aks.js`, `eks-token.js`) — CLI-free EKS/AKS discovery and kubeconfig merge, built on the AWS SDK and Azure AD + ARM REST.
- **Desktop** (`electron/`) — Electron shell (`main.cjs`) that runs the backend as a utility process and packages the app for macOS/Windows/Linux with electron-builder; `after-pack.cjs` ad-hoc signs the macOS build.

## Troubleshooting

- **"No kubeconfig loaded"** — ensure `~/.kube/config` exists or set `KUBECONFIG`.
- **Empty metrics / CPU-Memory show `—`** — the cluster needs **metrics-server** installed.
- **Helm view empty or erroring** — `helm` must be on the server's `PATH` and able to reach the cluster.
- **Terminal won't open** — the target container needs a shell (`sh`); distroless images won't work.
- **"All namespaces" is slow the first time** — it fetches every namespace (cached afterward); pick a single namespace for faster loads.
