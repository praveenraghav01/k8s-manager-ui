#!/usr/bin/env node
// postinstall: restore the execute bit on node-pty's `spawn-helper` binaries so
// pod terminals work after a fresh `npm install`. npm/CI file handling sometimes
// drops it, which makes every pty.spawn() fail with "posix_spawnp failed".
// Mirrored by a runtime guard in server.js (via lib/pty-helper.mjs).
import { ensurePtyHelperExecutable } from '../lib/pty-helper.mjs';

const fixed = ensurePtyHelperExecutable({ fromUrl: import.meta.url });
if (fixed) console.log(`[fix-pty-helper] made ${fixed} spawn-helper binary(ies) executable`);
