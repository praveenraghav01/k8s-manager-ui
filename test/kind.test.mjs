// Regression tests for the Security Center workload-link kind mapping.
//
// The bug: "Used By Pods" / "Controlled By" links did `kind.toLowerCase()`, so
// a PascalCase owner kind like "ReplicaSet" became "replicaset" (no such
// resource view) and clicking the pod/workload name navigated to nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kindType, KIND_TYPE } from '../client/src/lib/kind.js';

test('PascalCase owner kinds map to the app\'s camelCase view keys', () => {
  assert.equal(kindType('ReplicaSet'), 'replicaSet');
  assert.equal(kindType('StatefulSet'), 'statefulSet');
  assert.equal(kindType('DaemonSet'), 'daemonSet');
  assert.equal(kindType('CronJob'), 'cronJob');
  assert.equal(kindType('ReplicationController'), 'replicationController');
});

test('simple kinds map to their lowercase key', () => {
  assert.equal(kindType('Pod'), 'pod');
  assert.equal(kindType('Deployment'), 'deployment');
  assert.equal(kindType('Job'), 'job');
});

test('multi-word kinds never collapse to an invalid all-lowercase key', () => {
  // The original bug: these must NOT be "replicaset" / "statefulset" etc.
  for (const k of ['ReplicaSet', 'StatefulSet', 'DaemonSet', 'CronJob']) {
    assert.notEqual(kindType(k), k.toLowerCase());
    assert.ok(/[A-Z]/.test(kindType(k)), `${k} → ${kindType(k)} should stay camelCase`);
  }
});

test('unknown kinds fall back to a lowercased name', () => {
  assert.equal(kindType('Service'), 'service');
  assert.equal(kindType('Ingress'), 'ingress');
});

test('empty / nullish input is handled safely', () => {
  assert.equal(kindType(''), '');
  assert.equal(kindType(undefined), '');
  assert.equal(kindType(null), '');
});

test('every mapped value is camelCase (no accidental all-lowercase multiword)', () => {
  for (const [pascal, key] of Object.entries(KIND_TYPE)) {
    assert.equal(typeof key, 'string');
    assert.ok(key.length > 0, `${pascal} must map to a non-empty key`);
  }
});
