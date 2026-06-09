'use strict';
// 패키징 무결성 테스트: index.html 이 참조하는 로컬 자산(script/link)이
// electron-builder 의 build.files 목록에 모두 포함돼 있는지 검사.
// (i18n.js 를 files 에서 빠뜨려 패키징 앱이 깨졌던 회귀를 방지)
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n      ', e.message); }
}

console.log('packaging integrity tests\n');

const appDir = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const files = pkg.build.files;

// index.html 의 <script src> / <link href> 중 로컬(상대) 경로만 추출
function localRefs() {
  const refs = [];
  const re = /(?:src|href)\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const r = m[1];
    if (/^(https?:|data:|#)/.test(r)) continue;
    refs.push(r.replace(/^\.\//, ''));
  }
  return refs;
}

const refs = localRefs();

test('index.html 이 참조하는 자산이 1개 이상', () => {
  assert.ok(refs.length > 0, '참조 자산을 찾지 못함');
});

test('참조 자산이 모두 실제로 존재', () => {
  for (const r of refs) {
    assert.ok(fs.existsSync(path.join(appDir, r)), `파일 없음: ${r}`);
  }
});

test('참조 자산이 모두 build.files 에 포함 (패키징 누락 방지)', () => {
  for (const r of refs) {
    assert.ok(files.includes(r), `build.files 에 누락됨: ${r}  → package.json build.files 에 추가 필요`);
  }
});

test('엔트리(main/preload)도 build.files 에 포함', () => {
  assert.ok(files.includes(path.basename(pkg.main)), 'main 누락');
  assert.ok(files.includes('preload.js'), 'preload.js 누락');
});

console.log(`\n결과: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
