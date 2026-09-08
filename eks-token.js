#!/usr/bin/env node
// Native EKS authentication-token generator — a drop-in replacement for
// `aws eks get-token` that needs NO aws CLI, only Node + the bundled AWS SDK.
//
// The kubeconfig entries written by the AWS EKS integration exec this file, so
// both @kubernetes/client-node and kubectl can authenticate to EKS without the
// aws binary or a local credential chain beyond what the SDK reads itself.
//
// Usage: node eks-token.js --cluster <name> --region <region> [--profile <p>]
// Credentials come from --profile (SDK fromNodeProviderChain honours ~/.aws and
// assume-role) or, if no profile, the ambient AWS_* environment variables.
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { HttpRequest } from '@smithy/protocol-http';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

const argv = process.argv.slice(2);
const arg = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };

async function main() {
  const clusterName = arg('cluster');
  const region = arg('region') || process.env.AWS_REGION || 'us-east-1';
  const profile = arg('profile');
  if (!clusterName) throw new Error('--cluster is required');

  const credentials = await fromNodeProviderChain(profile ? { profile } : {})();

  const signer = new SignatureV4({ service: 'sts', region, credentials, sha256: Sha256, applyChecksum: false });
  const request = new HttpRequest({
    method: 'GET', protocol: 'https:', hostname: `sts.${region}.amazonaws.com`, path: '/',
    query: { Action: 'GetCallerIdentity', Version: '2011-06-15' },
    headers: { host: `sts.${region}.amazonaws.com`, 'x-k8s-aws-id': clusterName },
  });
  const signed = await signer.presign(request, { expiresIn: 60 });
  const qs = new URLSearchParams(signed.query).toString();
  const url = `https://${signed.hostname}${signed.path}?${qs}`;
  const token = 'k8s-aws-v1.' + Buffer.from(url).toString('base64url').replace(/=+$/, '');

  // Report the token's own lifetime as the expiry so clients refresh in time.
  const expirationTimestamp = new Date(Date.now() + 55 * 1000).toISOString();
  process.stdout.write(JSON.stringify({
    kind: 'ExecCredential',
    apiVersion: 'client.authentication.k8s.io/v1beta1',
    spec: {},
    status: { expirationTimestamp, token },
  }));
}

main().catch((e) => { process.stderr.write(`eks-token: ${e.message}\n`); process.exit(1); });
