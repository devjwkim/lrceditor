'use strict';
// electron-builder afterPack 훅 (macOS):
//  1) Chromium 자체 UI 언어 리소스(.lproj) 중 앱이 쓰는 것만 남기고 제거
//     (앱 UI는 자체 i18n.js 사용 → Chromium 기본 메뉴 로캘만 영향, en 폴백)
//  2) 내용 변경으로 무효화된 서명을 ad-hoc 으로 재서명
//     → 코드서명 인증서 없이도 Apple Silicon 에서 "손상됨" 없이 실행 가능
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

  // 정식 서명(Developer ID) 빌드에서는 electron-builder 가 이후에 서명/공증하므로 ad-hoc 생략.
  // 무서명 빌드(CSC_IDENTITY_AUTO_DISCOVERY=false)일 때만 ad-hoc 재서명해 "손상됨" 방지.
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY !== 'false') return;

  // 내용 변경 후 ad-hoc 재서명 (인증서 불필요). nested 부터 안쪽→바깥 순으로 --deep.
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'pipe' });
    execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'pipe' });
    console.log('  • afterPack: ad-hoc re-signed the app bundle');
  } catch (e) {
    console.warn('  • afterPack: ad-hoc codesign failed:', e.message);
  }
};
