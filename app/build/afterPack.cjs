'use strict';
// electron-builder afterPack 훅: macOS Electron Framework 에 남는
// Chromium 자체 UI 언어 리소스(.lproj) 중 앱이 쓰는 것만 남기고 제거.
// (앱 UI는 자체 i18n.js 사용 → Chromium 기본 메뉴 로캘만 영향, en 폴백)
const fs = require('fs');
const path = require('path');

const KEEP = new Set(['en', 'en_GB', 'Base', 'ko', 'ja', 'zh_CN', 'zh_TW']);

function dirSize(p) {
  let s = 0;
  for (const f of fs.readdirSync(p)) {
    const fp = path.join(p, f);
    const st = fs.statSync(fp);
    s += st.isDirectory() ? dirSize(fp) : st.size;
  }
  return s;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appName = context.packager.appInfo.productFilename;
  const res = path.join(
    context.appOutDir, `${appName}.app`, 'Contents', 'Frameworks',
    'Electron Framework.framework', 'Versions', 'A', 'Resources'
  );
  if (!fs.existsSync(res)) return;
  let removed = 0, freed = 0;
  for (const entry of fs.readdirSync(res)) {
    if (!entry.endsWith('.lproj')) continue;
    const code = entry.slice(0, -'.lproj'.length);
    if (KEEP.has(code)) continue;
    const p = path.join(res, entry);
    try { freed += dirSize(p); } catch { /* ignore */ }
    fs.rmSync(p, { recursive: true, force: true });
    removed++;
  }
  console.log(`  • afterPack: removed ${removed} extra Chromium locales (~${Math.round(freed / 1e6)}MB)`);
};
