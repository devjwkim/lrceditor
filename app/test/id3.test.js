'use strict';
// ID3 파서 테스트 (샘플 mp3 기준). 샘플이 없으면 건너뜀.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const id3 = require('../id3');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓', name); }
  catch (e) { fail++; console.log('  ✗', name, '\n      ', e.message); }
}

console.log('id3 tests\n');

test('비-ID3 버퍼는 빈 결과', () => {
  const r = id3.parse(Buffer.from('not an mp3 at all'));
  assert.deepStrictEqual({ t: r.title, a: r.artist, al: r.album, p: r.picture }, { t: '', a: '', al: '', p: null });
});

const sample = path.join(__dirname, '..', '..', 'sample', 'cherry.mp3');
if (fs.existsSync(sample)) {
  const tg = id3.parse(fs.readFileSync(sample));
  test('샘플: 제목 = Cherry', () => assert.strictEqual(tg.title, 'Cherry'));
  test('샘플: 아티스트 추출됨', () => assert.ok(tg.artist && tg.artist.length > 0));
  test('샘플: 앨범아트(APIC) 추출됨', () => {
    assert.ok(tg.picture && tg.picture.data.length > 0, '앨범아트 없음');
    assert.ok(/^image\//.test(tg.picture.mime), 'mime 형식 이상: ' + tg.picture.mime);
  });
  test('strip: 태그 제거 후 재파싱 시 비어있음', () => {
    const orig = fs.readFileSync(sample);
    const stripped = id3.strip(orig);
    const re = id3.parse(stripped);
    assert.strictEqual(re.title, '');
    assert.strictEqual(re.artist, '');
    assert.strictEqual(re.album, '');
    assert.ok(re.picture == null, '앨범아트가 남아있음');
    assert.ok(stripped.length < orig.length, '크기가 줄지 않음');
  });
} else {
  console.log('  - 샘플 mp3 없음 → 샘플 테스트 건너뜀');
}

console.log(`\n결과: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
