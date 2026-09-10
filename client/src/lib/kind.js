// Trivy (and other Kubernetes tooling) reports a workload's owner kind in
// PascalCase — "Deployment", "ReplicaSet", "StatefulSet". The app's resource
// views are keyed in camelCase, so a naive `kind.toLowerCase()` yields
// "replicaset" (no such view) and cross-navigation links go nowhere. Map the
// known kinds explicitly, falling back to a lowercased name for anything else.
export const KIND_TYPE = {
  Pod: 'pod',
  Deployment: 'deployment',
  StatefulSet: 'statefulSet',
  DaemonSet: 'daemonSet',
  ReplicaSet: 'replicaSet',
  Job: 'job',
  CronJob: 'cronJob',
  ReplicationController: 'replicationController',
  // RBAC kinds live under the Access Control view.
  Role: 'accessControl',
  ClusterRole: 'accessControl',
  RoleBinding: 'accessControl',
  ClusterRoleBinding: 'accessControl',
};

export const kindType = (k) => KIND_TYPE[k] || (k || '').toLowerCase();
