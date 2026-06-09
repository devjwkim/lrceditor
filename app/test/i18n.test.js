'use strict';
// 언어팩 헤드리스 테스트 — 키 정합성/보간/언어전환.
//   실행: node app/test/i18n.test.js
const assert = require('assert');
const I18N = require('../i18n');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n      ', e.message); }
}

console.log('i18n tests\n');

const codes = I18N.langs.map((l) => l.code);

test('지원 언어: en, ko, ja, zh', () => {
  assert.deepStrictEqual(codes, ['en', 'ko', 'ja', 'zh']);
});

test('기본 언어는 en', () => {
  assert.strictEqual(I18N.getLang(), 'en');
});

test('모든 언어가 동일한 키 집합을 가진다 (누락/잉여 없음)', () => {
  const enKeys = Object.keys(I18N.strings.en).sort();
  for (const c of codes) {
    const keys = Object.keys(I18N.strings[c]).sort();
    assert.deepStrictEqual(keys, enKeys, `'${c}' 키가 en과 불일치`);
  }
});

test('빈 문자열 값이 없다', () => {
  for (const c of codes) {
    for (const [k, v] of Object.entries(I18N.strings[c])) {
      assert.ok(typeof v === 'string' && v.length > 0, `'${c}.${k}' 비어 있음`);
    }
  }
});

test('setLang 으로 전환 + t() 가 해당 언어 반환', () => {
  I18N.setLang('ko');
  assert.strictEqual(I18N.t('btn.save'), '저장…');
  I18N.setLang('ja');
  assert.strictEqual(I18N.t('btn.save'), '保存…');
  I18N.setLang('zh');
  assert.strictEqual(I18N.t('btn.save'), '保存…');
  I18N.setLang('en');
  assert.strictEqual(I18N.t('btn.save'), 'Save…');
});

test('알 수 없는 언어는 무시(현재 유지)', () => {
  I18N.setLang('en');
  I18N.setLang('xx');
  assert.strictEqual(I18N.getLang(), 'en');
});

test('{name} 등 파라미터 보간', () => {
  I18N.setLang('en');
  assert.strictEqual(I18N.t('status.audioLoaded', { name: 'a.mp3' }), 'Audio loaded: a.mp3');
  assert.strictEqual(I18N.t('status.saved', { path: '/x/y.lrc' }), 'Saved: /x/y.lrc');
});

test('없는 키는 en 폴백 후 키 그대로', () => {
  I18N.setLang('ko');
  assert.strictEqual(I18N.t('no.such.key'), 'no.such.key');
});

console.log(`\n결과: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
