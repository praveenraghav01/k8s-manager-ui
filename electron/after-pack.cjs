// electron-builder afterPack hook.
//
// We have no Apple Developer ID certificate, so electron-builder ships the app
// UNSIGNED (mac.identity is null). On Apple Silicon an unsigned (or
// signature-invalidated) bundle is killed by Gatekeeper on launch and reported
// as "damaged" / "malware".
//
// An *ad-hoc* signature (`codesign -s -`) has no certificate but produces a
// valid, self-consistent signature that macOS will run locally. We apply it
// here — after the .app is packed, before any DMG is built — so both the
// unpacked app and the DMG contain a runnable, ad-hoc-signed bundle.
//
// We sign every nested Mach-O first (frameworks, helpers, dylibs, the unpacked
// `.node` addon) and then the app bundle, inside-out, which is the order
// codesign requires. We deliberately do NOT enable the hardened runtime — see
// the note on `sign()` below.
//
// This is NOT a substitute for Developer ID signing + notarization if you
// intend to distribute the app to other machines (those users would still get
// a Gatekeeper prompt / quarantine). It only makes the app runnable locally.
'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  // Plain ad-hoc signature, WITHOUT the hardened runtime. Hardened runtime
  // turns on library validation, which requires every loaded library to share
  // the main executable's Team ID or be an Apple platform binary. Ad-hoc
  // signatures carry no Team ID, so a hardened helper refuses to load the
  // ad-hoc Electron Framework ("mapping process and mapped file have different
  // Team IDs", dyld). An ad-hoc build can never be notarized anyway, so the
  // hardened runtime buys us nothing here — omit it and the app runs.
  const sign = (target) => {
    execFileSync(
      'codesign',
      ['--force', '--timestamp=none', '--sign', '-', target],
      { stdio: 'inherit' },
    );
  };

  console.log(`  • ad-hoc signing (no Developer ID)  app=${appPath}`);
  try {
    // 1. Nested Mach-O first: frameworks, dylibs, unpacked .node addons and
    //    the bundled `node`/helper executables. codesign requires inside-out
    //    order, so sign the deepest paths before their containers.
    const nested = collectNested(path.join(appPath, 'Contents'));
    for (const p of nested) sign(p);

    // 2. The app bundle itself.
    sign(appPath);

    // 3. Verify the signature is valid before a DMG is built around it.
    execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
      stdio: 'inherit',
    });
    console.log('  • ad-hoc signature verified');
  } catch (err) {
    console.warn(`  ! ad-hoc signing failed: ${err.message}`);
    console.warn('  ! the app may be blocked by Gatekeeper on launch.');
  }
};

// Depth-first walk of the .app collecting signable Mach-O paths, deepest first.
// Covers *.framework, *.dylib, *.node and any executable files in MacOS/.
function collectNested(root) {
  const hits = [];
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        walk(full);
        if (/\.(framework|app)$/.test(e.name)) hits.push(full); // container after its contents
      } else if (/\.(dylib|node|so)$/.test(e.name)) {
        hits.push(full);
      } else if (isMachOExecutable(full)) {
        hits.push(full);
      }
    }
  };
  walk(root);
  return hits;
}

// A file is a signable executable if it starts with a Mach-O magic number.
function isMachOExecutable(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    const magic = buf.readUInt32BE(0);
    // MH_MAGIC/CIGAM (32/64) and fat-binary magics.
    return [0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca].includes(magic);
  } catch {
    return false;
  }
}
