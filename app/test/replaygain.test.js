'use strict';
// ReplayGain 포팅 sanity 테스트 (정밀 검증은 ffmpeg 대조로 완료: -11.81dB 일치).
const assert = require('assert');
const rg = require('../replaygain');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n      ', e.message); }
}

console.log('replaygain tests\n');

test('표준 sample_rate 포함(44100/48000)', () => {
  assert.ok(rg.rates.includes(44100) && rg.rates.includes(48000));
});
test('기준 REF = 89', () => assert.strictEqual(rg.REF, 89));

test('1kHz 사인 측정 → volume/trackGain 유한, peak≈0.5', () => {
  const sr = 44100, n = sr * 2;
  const L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = 0.5 * Math.sin(2 * Math.PI * 1000 * i / sr);
  const m = rg.measure(L, L, sr);
  assert.ok(m && isFinite(m.volume) && isFinite(m.trackGain), 'measure 실패');
  assert.ok(m.peak > 0.45 && m.peak < 0.55, 'peak=' + m.peak);
  // volume = 89 - trackGain
  assert.ok(Math.abs(m.volume - (89 - m.trackGain)) < 1e-6);
});

test('더 큰 진폭 → 더 큰 volume', () => {
  const sr = 44100, n = sr;
  const quiet = new Float32Array(n), loud = new Float32Array(n);
  for (let i = 0; i < n; i++) { const s = Math.sin(2 * Math.PI * 1000 * i / sr); quiet[i] = 0.1 * s; loud[i] = 0.8 * s; }
  assert.ok(rg.measure(loud, loud, sr).volume > rg.measure(quiet, quiet, sr).volume);
});

test('미지원 rate 는 null', () => assert.strictEqual(rg.measure(new Float32Array(10), new Float32Array(10), 12345), null));

console.log(`\n결과: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
