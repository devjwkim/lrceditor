'use strict';
// 무손실 게인(mp3gain) 테스트 — 샘플 mp3 기준. 샘플 없으면 건너뜀.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const g = require('../mp3gain');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n      ', e.message); }
}

console.log('mp3gain tests\n');

const sample = path.join(__dirname, '..', '..', 'sample', 'cherry.mp3');
if (fs.existsSync(sample)) {
  const buf = fs.readFileSync(sample);
  const gains = g.readGlobalGains(buf);

  test('프레임에서 global_gain 다수 추출 + 범위 0..255', () => {
    assert.ok(gains.length > 1000, 'global_gain 수가 너무 적음: ' + gains.length);
    assert.ok(gains.every((v) => v >= 0 && v <= 255));
  });

  test('+2 step 적용 시 각 global_gain 이 +2(클램프)', () => {
    const out = g.applyGainSteps(buf, 2);
    const after = g.readGlobalGains(out);
    assert.strictEqual(after.length, gains.length);
    for (let i = 0; i < gains.length; i++) {
      assert.strictEqual(after[i], Math.min(255, gains[i] + 2));
    }
    assert.strictEqual(out.length, buf.length, '파일 크기가 바뀜');
  });

  test('-3 step 적용 시 각 global_gain 이 -3(0 클램프)', () => {
    const after = g.readGlobalGains(g.applyGainSteps(buf, -3));
    for (let i = 0; i < gains.length; i++) {
      assert.strictEqual(after[i], Math.max(0, gains[i] - 3));
    }
  });

  test('0 step = 원본과 동일', () => {
    assert.ok(g.applyGainSteps(buf, 0).equals(buf));
  });

  test('+1 후 -1 round-trip (클램프 없는 범위면 복원)', () => {
    const noClamp = gains.every((v) => v + 1 <= 255 && v - 1 >= 0);
    if (noClamp) {
      const back = g.applyGainSteps(g.applyGainSteps(buf, 1), -1);
      assert.ok(back.equals(buf), 'round-trip 복원 실패');
    }
  });
} else {
  console.log('  - 샘플 mp3 없음 → 건너뜀');
}

console.log(`\n결과: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
