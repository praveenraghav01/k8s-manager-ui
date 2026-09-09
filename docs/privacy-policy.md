# Privacy Policy

**Last updated: September 9, 2026**

k8sight ("the app", "we", "our") is a free, open-source desktop application for browsing and operating Kubernetes clusters. This policy explains what data the app touches and how it is handled.

**The short version:** k8sight runs entirely on your own computer. We operate no servers, and we do **not** collect, store, receive, sell, or share your data.

## 1. We collect nothing

k8sight is a desktop application that runs locally on your machine. It has no backend owned by us, sends no telemetry or analytics, requires no account or sign-up, and transmits no usage data to us. All processing happens on your device.

## 2. Data the app accesses (and where it stays)

To do its job, k8sight works with data that either stays on your machine or travels **directly** between your machine and services you configure — never through us:

- **Kubeconfig & cluster data** — read from your local kubeconfig (`~/.kube/config`). The app talks directly to your Kubernetes API servers to display resources, logs, metrics, topology, etc. This traffic is between your machine and your clusters.
- **Cloud credentials** — when you connect AWS, Azure, or Google clusters, credentials and tokens are stored **locally** (e.g. `~/.aws`, `~/.kube`, `~/.config/k8s-manager/…`) and used only to call that cloud provider's APIs directly from your machine.

## 3. Google user data (OAuth) — Limited Use

If you choose to sign in with Google to import GKE clusters, k8sight requests the `https://www.googleapis.com/auth/cloud-platform` scope **solely** to:

- list the Google Cloud projects and GKE clusters you can access, and
- obtain short-lived access tokens to authenticate to those clusters.

k8sight's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including its **Limited Use** requirements. Specifically:

- Google user data is used **only** to provide the cluster-connection features you invoke.
- It is **not** transferred to others except as necessary to provide those features, for security, or to comply with applicable law.
- It is **not** used for advertising.
- No humans read your Google user data.

Google tokens are stored locally on your device (`~/.config/k8s-manager/gke/credentials.json`) and are never sent to us or any third party. You can revoke access at any time at <https://myaccount.google.com/permissions>, by signing out in the app, or by deleting that file.

## 4. AWS and Azure

AWS (SSO, access keys, or assume-role) and Azure (browser or `az` CLI) sign-ins authenticate **directly** with those providers. Credentials and tokens are stored locally and used only to discover clusters and write kubeconfig entries. Nothing is sent to us.

## 5. AI assistant (bring your own model)

The optional AI assistant is **off until you configure it** with your own OpenAI-compatible API endpoint and key. When you use it, relevant **read-only** cluster context is sent to the endpoint **you chose** (e.g. OpenAI, Azure OpenAI, TrueFoundry, LiteLLM) so it can answer your question. Secret values are redacted before anything is sent, and your API key is stored locally. That exchange is governed by your chosen provider's privacy policy; we are not a party to it.

## 6. The website

This website is static. It may load a third-party **Buy Me a Coffee** widget; if you interact with it, Buy Me a Coffee processes that interaction under its own privacy policy. The site itself does not set tracking cookies or collect personal data. Standard server request logs kept by the hosting provider are not used by us for tracking or profiling.

## 7. Data retention & deletion

Because everything lives on your machine, you are in control. You can remove data by signing out in the app, deleting the relevant local files (`~/.config/k8s-manager/`, cloud credential files, kubeconfig entries), or uninstalling the app.

## 8. Children

k8sight is a developer tool and is not directed to children under 13.

## 9. Changes to this policy

We may update this policy from time to time. Material changes will be reflected here with a new "Last updated" date.

## 10. Contact

Questions about this policy? Open an issue at <https://github.com/praveenraghav01/k8s-manager-ui> or email **praveensinghraghav96@gmail.com**.
