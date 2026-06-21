// Renames pkg outputs to Tauri sidecar naming convention:
// dist/backend-server-macos     → ../src-tauri/binaries/backend-server-aarch64-apple-darwin
// dist/backend-server-win.exe   → ../src-tauri/binaries/backend-server-x86_64-pc-windows-msvc.exe
// dist/backend-server-linux     → ../src-tauri/binaries/backend-server-x86_64-unknown-linux-gnu
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const OUT  = path.join(__dirname, '..', '..', 'src-tauri', 'binaries');

const MAP = [
  ['backend-server-macos',   'backend-server-aarch64-apple-darwin'],
  ['backend-server-win.exe', 'backend-server-x86_64-pc-windows-msvc.exe'],
  ['backend-server-linux',   'backend-server-x86_64-unknown-linux-gnu'],
];

MAP.forEach(([src, dst]) => {
  const srcPath = path.join(DIST, src);
  const dstPath = path.join(OUT, dst);
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, dstPath);
    fs.chmodSync(dstPath, 0o755);
    console.log(`✓ ${src} → ${dst}`);
  }
});
