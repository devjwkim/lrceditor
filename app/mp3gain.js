'use strict';
// 무손실 MP3 게인 (mp3gain 방식): 각 프레임 side-info 의 global_gain(8bit)을
// 1.5dB 단위(=1 step)로 가감. 재인코딩 없이 디코드 레벨만 바뀜.
// MPEG1/2/2.5 Layer III 지원. 의존성 없음 (Node Buffer).

function getbits(buf, bitpos, n) {
  let v = 0;
  for (let i = 0; i < n; i++) {
    const byte = buf[(bitpos + i) >> 3] || 0;
    const bit = 7 - ((bitpos + i) & 7);
    v = (v << 1) | ((byte >> bit) & 1);
  }
  return v >>> 0;
}
function setbits(buf, bitpos, n, val) {
  for (let i = 0; i < n; i++) {
    const idx = (bitpos + i) >> 3;
    const bit = 7 - ((bitpos + i) & 7);
    const b = (val >> (n - 1 - i)) & 1;
    if (b) buf[idx] |= (1 << bit); else buf[idx] &= ~(1 << bit);
  }
}

const BR_MPEG1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BR_MPEG2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

// off 위치의 Layer III 프레임 정보 (아니면 null)
function frameInfo(buf, off) {
  if (off + 4 > buf.length) return null;
  if (buf[off] !== 0xFF || (buf[off + 1] & 0xE0) !== 0xE0) return null;
  const ver = (buf[off + 1] >> 3) & 0x3;     // 3=MPEG1, 2=MPEG2, 0=MPEG2.5, 1=reserved
  const layer = (buf[off + 1] >> 1) & 0x3;   // 1 = Layer III
  if (ver === 1 || layer !== 0b01) return null;
  const prot = buf[off + 1] & 0x1;           // 0 = CRC 있음
  const brIdx = (buf[off + 2] >> 4) & 0xF;
  const srIdx = (buf[off + 2] >> 2) & 0x3;
  const pad = (buf[off + 2] >> 1) & 0x1;
  const chMode = (buf[off + 3] >> 6) & 0x3;  // 3 = mono
  if (brIdx === 0 || brIdx === 0xF || srIdx === 0x3) return null;
  const mpeg1 = (ver === 3);
  const nch = (chMode === 0b11) ? 1 : 2;
  const bitrate = (mpeg1 ? BR_MPEG1 : BR_MPEG2)[brIdx] * 1000;
  const sr = SR[ver][srIdx];
  if (!bitrate || !sr) return null;
  const frameLen = (mpeg1 ? Math.floor(144 * bitrate / sr) : Math.floor(72 * bitrate / sr)) + pad;
  const sideLen = mpeg1 ? (nch === 1 ? 17 : 32) : (nch === 1 ? 9 : 17);
  const sideStart = off + 4 + (prot === 0 ? 2 : 0);
  if (sideStart + sideLen > buf.length || frameLen < 24) return null;
  return { mpeg1, nch, frameLen, sideStart };
}

// 프레임 내 각 global_gain 의 비트 위치를 콜백으로 전달
function eachGlobalGain(buf, fi, cb) {
  let bp = fi.sideStart * 8;
  const read = (n) => { const v = getbits(buf, bp, n); bp += n; return v; };
  const skip = (n) => { bp += n; };
  if (fi.mpeg1) {
    skip(9);                       // main_data_begin
    skip(fi.nch === 1 ? 5 : 3);    // private_bits
    skip(fi.nch * 4);              // scfsi
    for (let gr = 0; gr < 2; gr++) for (let ch = 0; ch < fi.nch; ch++) {
      skip(12); skip(9);           // part2_3_length, big_values
      cb(bp); skip(8);             // global_gain
      skip(4);                     // scalefac_compress
      const wsf = read(1);
      if (wsf) { skip(2 + 1); skip(5 * 2); skip(3 * 3); }
      else { skip(5 * 3); skip(4); skip(3); }
      skip(1 + 1 + 1);             // preflag, scalefac_scale, count1table_select
    }
  } else {
    skip(8);                       // main_data_begin (LSF)
    skip(fi.nch === 1 ? 1 : 2);    // private_bits
    for (let ch = 0; ch < fi.nch; ch++) {   // 1 granule
      skip(12); skip(9);
      cb(bp); skip(8);             // global_gain
      skip(9);                     // scalefac_compress (LSF)
      const wsf = read(1);
      if (wsf) { skip(2 + 1); skip(5 * 2); skip(3 * 3); }
      else { skip(5 * 3); skip(4); skip(3); }
      skip(1 + 1);                 // scalefac_scale, count1table_select (no preflag in LSF)
    }
  }
}

function audioStart(buf) {
  if (buf.length >= 10 && buf.toString('latin1', 0, 3) === 'ID3') {
    const footer = (buf[5] & 0x10) ? 10 : 0;
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    const len = 10 + size + footer;
    if (len > 0 && len < buf.length) return len;
  }
  return 0;
}

function forEachFrame(buf, fn) {
  let off = audioStart(buf);
  let guard = 0;
  while (off + 4 <= buf.length) {
    const fi = frameInfo(buf, off);
    if (!fi) { off++; if (++guard > buf.length) break; continue; }
    if (off + fi.frameLen > buf.length) break;
    fn(fi);
    off += fi.frameLen;
  }
}

// 모든 global_gain 값 배열 (분석/테스트용)
function readGlobalGains(buf) {
  const out = [];
  forEachFrame(buf, (fi) => eachGlobalGain(buf, fi, (bp) => out.push(getbits(buf, bp, 8))));
  return out;
}

// steps(1.5dB 단위, 정수) 만큼 모든 global_gain 가감 (0..255 클램프). 새 버퍼 반환.
function applyGainSteps(buf, steps) {
  const out = Buffer.from(buf);
  if (!steps) return out;
  forEachFrame(out, (fi) => eachGlobalGain(out, fi, (bp) => {
    let g = getbits(out, bp, 8) + steps;
    g = g < 0 ? 0 : g > 255 ? 255 : g;
    setbits(out, bp, 8, g);
  }));
  return out;
}

const DB_PER_STEP = 1.5;

module.exports = { applyGainSteps, readGlobalGains, frameInfo, DB_PER_STEP };
