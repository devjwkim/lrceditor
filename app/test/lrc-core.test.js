'use strict';
// 순수 LRC 로직 헤드리스 테스트 (Electron 없이 node 로 실행).
//   실행: node app/test/lrc-core.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const LRC = require('../lrc-core');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n      ', e.message); }
}

console.log('LRC core tests\n');

// --- fmt ---
test('fmt: 0초 → 00:00.00', () => assert.strictEqual(LRC.fmt(0), '00:00.00'));
test('fmt: 76.5초 → 01:16.50', () => assert.strictEqual(LRC.fmt(76.5), '01:16.50'));
test('fmt: 가까운 반올림 경계 (9.999)', () => assert.strictEqual(LRC.fmt(9.999), '00:09.99'));
test('fmt: null → 플레이스홀더', () => assert.strictEqual(LRC.fmt(null), '--:--.--'));

// --- parseTimeStr (시간 입력 검증) ---
test('parseTimeStr: 정상 01:23.45 → 83.45', () => assert.strictEqual(LRC.parseTimeStr('01:23.45'), 83.45));
test('parseTimeStr: 00:00.00 → 0', () => assert.strictEqual(LRC.parseTimeStr('00:00.00'), 0));
test('parseTimeStr: 공백 허용 후 파싱', () => assert.strictEqual(LRC.parseTimeStr('  02:05.00 '), 125));
test('parseTimeStr: 초 60 이상 거부', () => assert.strictEqual(LRC.parseTimeStr('00:60.00'), null));
test('parseTimeStr: 센티초 한 자리 거부', () => assert.strictEqual(LRC.parseTimeStr('01:23.4'), null));
test('parseTimeStr: 형식 깨짐 거부', () => assert.strictEqual(LRC.parseTimeStr('1:2:3'), null));
test('parseTimeStr: 빈 문자열 거부', () => assert.strictEqual(LRC.parseTimeStr(''), null));

// --- parse ---
test('parse: 단일 태그', () => {
  const r = LRC.parseLrc('[01:16.00]가사줄');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].time, 76);
  assert.strictEqual(r[0].text, '가사줄');
});
test('parse: 밀리초 3자리', () => {
  const r = LRC.parseLrc('[00:01.500]x');
  assert.strictEqual(r[0].time, 1.5);
});
test('parse: 한 줄 다중 태그(반복 가사) → 분리', () => {
  const r = LRC.parseLrc('[00:10.00][00:20.00]후렴');
  assert.strictEqual(r.length, 2);
  assert.deepStrictEqual(r.map((x) => x.time), [10, 20]);
});
test('parse: id 태그([ti:]) 는 무시', () => {
  const r = LRC.parseLrc('[ti:Title]\n[00:01.00]a');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].text, 'a');
});
test('parse: 시간순 정렬', () => {
  const r = LRC.parseLrc('[00:30.00]c\n[00:10.00]a\n[00:20.00]b');
  assert.deepStrictEqual(r.map((x) => x.text), ['a', 'b', 'c']);
});

// --- 라운드트립: parse → serialize → parse 가 안정적 ---
test('round-trip: 값 보존', () => {
  const src = '[00:00.00]l1\n[00:16.00]l2\n[01:04.00]l3\n';
  const once = LRC.serializeLrc(LRC.parseLrc(src));
  const twice = LRC.serializeLrc(LRC.parseLrc(once));
  assert.strictEqual(once, twice);
  assert.strictEqual(once, src);
});

// --- 실제 샘플 파일 ---
test('sample/cherry.lrc 파싱', () => {
  const p = path.join(__dirname, '..', '..', 'sample', 'cherry.lrc');
  const text = fs.readFileSync(p, 'utf8');
  const lines = LRC.parseLrc(text);
  assert.ok(lines.length >= 20, '가사 줄이 20줄 이상이어야 함, 실제=' + lines.length);
  // 모든 줄이 시간 + 텍스트를 가짐
  assert.ok(lines.every((l) => l.time != null && l.text.length > 0), '모든 줄에 시간/텍스트 존재');
  // 첫 줄 [00:00.00], 정렬 단조 증가
  assert.strictEqual(lines[0].time, 0);
  for (let i = 1; i < lines.length; i++) assert.ok(lines[i].time >= lines[i - 1].time, '단조 증가');
  // 직렬화 후 재파싱 시 줄 수 동일
  const re = LRC.parseLrc(LRC.serializeLrc(lines));
  assert.strictEqual(re.length, lines.length);
});

console.log(`\n결과: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
