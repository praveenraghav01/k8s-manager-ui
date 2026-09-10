// Regression tests for the pod terminal (node-pty).
//
// The bug: node-pty's `spawn-helper` binary lost its execute bit, so every
// pty.spawn() failed with "posix_spawnp failed" and no pod shell could start.
// These tests would have caught it, and guard the fix in lib/pty-helper.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  ensurePtyHelperExecutable,
  spawnHelperPaths,
} from '../lib/pty-helper.mjs';

const require = createRequire(import.meta.url);
const isWindows = process.platform === 'win32';

// Run a command through node-pty and resolve with its output. This is the
// operation that failed in production — a real end-to-end check of the PTY.
function ptyRun(pty, file, args) {
  return new Promise((resolve, reject) => {
    let out = '';
    let term;
    try {
      term = pty.spawn(file, args, {
        name: 'xterm-256color', cols: 80, rows: 24,
        cwd: process.env.HOME || '/', env: process.env,
      });
    } catch (err) {
      return reject(err); // e.g. "posix_spawnp failed."
    }
    term.onData((d) => { out += d; });
    term.onExit(() => resolve(out));
    setTimeout(() => { try { term.kill(); } catch { /* ignore */ } resolve(out); }, 4000);
  });
}

test('node-pty is installed and loadable', async () => {
  const pty = (await import('node-pty')).default;
  assert.equal(typeof pty.spawn, 'function');
});

test('ensurePtyHelperExecutable makes the spawn-helper executable', { skip: isWindows }, () => {
  ensurePtyHelperExecutable({ currentOnly: true, fromUrl: import.meta.url });
  const helpers = spawnHelperPaths({ currentOnly: true, fromUrl: import.meta.url })
    .filter((p) => fs.existsSync(p));
  assert.ok(helpers.length > 0, 'a spawn-helper binary should exist for this platform');
  for (const h of helpers) {
    assert.doesNotThrow(() => fs.accessSync(h, fs.constants.X_OK), `${h} should be executable`);
  }
});

test('node-pty can actually spawn a process (no posix_spawnp failure)', { skip: isWindows }, async () => {
  ensurePtyHelperExecutable({ currentOnly: true, fromUrl: import.meta.url });
  const pty = (await import('node-pty')).default;
  const out = await ptyRun(pty, '/bin/echo', ['k8sight-pty-ok']);
  assert.match(out, /k8sight-pty-ok/);
});

test('a stripped execute bit is self-healed and the PTY works again', { skip: isWindows }, async () => {
  const helpers = spawnHelperPaths({ currentOnly: true, fromUrl: import.meta.url })
    .filter((p) => fs.existsSync(p));
  assert.ok(helpers.length > 0);
  const helper = helpers[0];

  // Simulate the production breakage: remove the execute bit.
  fs.chmodSync(helper, 0o644);
  assert.throws(() => fs.accessSync(helper, fs.constants.X_OK), 'exec bit should be gone');

  // The guard should restore it and report that it fixed one.
  const fixed = ensurePtyHelperExecutable({ currentOnly: true, fromUrl: import.meta.url });
  assert.ok(fixed >= 1, 'guard should have re-applied the execute bit');
  assert.doesNotThrow(() => fs.accessSync(helper, fs.constants.X_OK));

  // And a real spawn must succeed after the heal.
  const pty = (await import('node-pty')).default;
  const out = await ptyRun(pty, '/bin/echo', ['healed']);
  assert.match(out, /healed/);
});
