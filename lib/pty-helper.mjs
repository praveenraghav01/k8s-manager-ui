// node-pty launches PTY processes by exec'ing a small native `spawn-helper`
// binary. npm/CI file handling and Electron's resource-copy step sometimes drop
// its execute bit, after which EVERY pty.spawn() fails with the cryptic
// "posix_spawnp failed" — no pod shell can start. These helpers restore +x.
//
// Shared by: server.js (runtime guard), scripts/fix-pty-helper.mjs
// (postinstall) and the test suite, so there is one implementation to trust.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

/** Absolute path to the installed node-pty package dir, or null if unresolved. */
export function ptyDir(fromUrl = import.meta.url) {
  try {
    const req = createRequire(fromUrl);
    return path.dirname(req.resolve('node-pty/package.json'));
  } catch {
    return null;
  }
}

/** Candidate spawn-helper locations. `currentOnly` limits to this platform/arch. */
export function spawnHelperPaths({ currentOnly = false, fromUrl = import.meta.url } = {}) {
  const dir = ptyDir(fromUrl);
  if (!dir) return [];
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  if (currentOnly) {
    return [
      path.join(dir, 'prebuilds', `${process.platform}-${arch}`, 'spawn-helper'),
      path.join(dir, 'build', 'Release', 'spawn-helper'),
    ];
  }
  // Every prebuild + a local build, best-effort (used by the postinstall step).
  const found = [];
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'spawn-helper') found.push(p);
    }
  };
  walk(path.join(dir, 'prebuilds'));
  walk(path.join(dir, 'build', 'Release'));
  return found;
}

/**
 * Ensure node-pty's spawn-helper binaries are executable.
 * @returns {number} how many helpers were (re)made executable.
 */
export function ensurePtyHelperExecutable({ currentOnly = false, fromUrl = import.meta.url } = {}) {
  if (process.platform === 'win32') return 0; // Windows uses conpty, no helper
  let fixed = 0;
  for (const helper of spawnHelperPaths({ currentOnly, fromUrl })) {
    try {
      fs.accessSync(helper, fs.constants.X_OK); // already executable — leave it
    } catch {
      try { fs.chmodSync(helper, 0o755); fixed++; } catch { /* missing/other build */ }
    }
  }
  return fixed;
}
