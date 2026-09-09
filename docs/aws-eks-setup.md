# AWS EKS — connect your clusters

k8sight imports **Amazon EKS** clusters with **no `aws` CLI required**. It's built on the AWS SDK, so sign-in, discovery, and even the auth-token generation run in-process. Unlike GKE, there is **nothing for a maintainer to register** — you sign in with your own AWS identity.

Three sign-in methods:

- **AWS SSO (IAM Identity Center)** — enter your **start URL** (e.g. `https://my-org.awsapps.com/start`) or pick an existing profile; k8sight runs the device-authorization flow, then lets you choose an **account + role**.
- **Access keys (IAM user)** — an access key id + secret (and optional session token).
- **Assume-role** — a role ARN plus a source profile.

k8sight then discovers **every EKS cluster across your accounts and regions** and writes the ones you pick into your kubeconfig. Cluster auth is generated natively (the bundled `eks-token.js` signs an STS request), so **using** the clusters needs no `aws` binary either.

---

## Use it

**Preferences → Cloud Integrations → Add AWS clusters**, or the **Add AWS** button in the context dropdown.

1. Pick a method:
   - **AWS SSO** → enter your start URL → approve the device code in the browser → choose account + role.
   - **Access key** → paste the key id / secret (open *Advanced options*).
   - **IAM role** → enter the role ARN + source profile (open *Advanced options*).
2. k8sight lists your EKS clusters across regions.
3. Select clusters → **Add** → they're written to your kubeconfig.

An **Add AWS** option also appears on the "couldn't connect" screen for quick re-auth.

## Permissions you need

Two separate layers — **both** are required:

**1. AWS IAM (to discover + import):**
- `eks:ListClusters` and `eks:DescribeCluster` on the target regions/accounts.
- `sts:GetCallerIdentity` (always allowed) — used to mint the auth token.
- For SSO: permission to list your assigned accounts/roles (handled by Identity Center).

**2. Kubernetes access on the cluster (to actually use it):** ⚠️ the classic EKS gotcha
Your IAM principal (user or assumed role) must be mapped to a Kubernetes group, or you'll authenticate but get **`Unauthorized` / `forbidden`**. Do this on the cluster with **either**:
- an **EKS access entry** (recommended, newer): `aws eks create-access-entry` + an access policy (e.g. `AmazonEKSClusterAdminPolicy`), or the console's *Access* tab; **or**
- the legacy **`aws-auth` ConfigMap** in `kube-system`, mapping your ARN to `system:masters` (or a custom group with RBAC).

If a cluster imports but every request is forbidden, this mapping is what's missing.

---

## How auth works (for reference)

- Sign-in and discovery use the **AWS SDK for JavaScript v3** (EKS, STS, SSO/SSO-OIDC clients) — no `aws` binary.
- Access keys / assume-role sign-ins are saved as an `~/.aws` **profile** so the token helper can read them at runtime; SSO role credentials are saved as a short-lived profile.
- The kubeconfig `user` runs an `exec` plugin: `eks-token.js --cluster <name> --region <region> [--profile <p>]`, a drop-in for `aws eks get-token`. It **presigns an STS `GetCallerIdentity`** request (with the `x-k8s-aws-id` header) and returns it as the `k8s-aws-v1.` bearer token EKS expects. Tokens are short-lived; clients refresh automatically.

## Troubleshooting

- **Cluster imports, but everything is `forbidden` / `Unauthorized`** → your IAM principal isn't mapped to Kubernetes RBAC. Add an **EKS access entry** or an **`aws-auth`** mapping (see permissions above). This is the #1 EKS issue.
- **No clusters found** → check the region(s), and that the identity has `eks:ListClusters`. SSO: confirm you picked an account/role that can see the clusters.
- **SSO device code expired / "session expired"** → re-run the SSO sign-in; tokens are short-lived.
- **Assume-role fails** → verify the role's trust policy allows your source profile/principal and that the source profile is valid.
- **Wrong account** → for SSO, pick a different account/role in the picker; for keys, use the correct key pair.
