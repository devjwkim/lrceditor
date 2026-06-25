'use strict';
// 의존성 없는 최소 ID3v2(2.3/2.4) 파서 — 제목/아티스트/앨범/앨범아트(APIC) 추출.
// 메인 프로세스(Node Buffer)에서 사용.

function swap16(buf) {
  const b = Buffer.from(buf);
  for (let i = 0; i + 1 < b.length; i += 2) { const t = b[i]; b[i] = b[i + 1]; b[i + 1] = t; }
  return b;
}

function decodeText(buf, enc) {
  if (!buf || !buf.length) return '';
  try {
    if (enc === 0) return buf.toString('latin1').replace(/\0+$/, '');
    if (enc === 3) return buf.toString('utf8').replace(/\0+$/, '');
    if (enc === 1) { // UTF-16 with BOM
      if (buf[0] === 0xFF && buf[1] === 0xFE) return buf.slice(2).toString('utf16le').replace(/\0+$/, '');
      if (buf[0] === 0xFE && buf[1] === 0xFF) return swap16(buf.slice(2)).toString('utf16le').replace(/\0+$/, '');
      return buf.toString('utf16le').replace(/\0+$/, '');
    }
    if (enc === 2) return swap16(buf).toString('utf16le').replace(/\0+$/, ''); // UTF-16BE
  } catch { return ''; }
  return '';
}

const synchsafe = (b, o) => ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f);
const plain32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function parseApic(data) {
  try {
    let p = 0;
    const enc = data[p++];
    let me = p; while (me < data.length && data[me] !== 0) me++;
    let mime = data.toString('latin1', p, me) || 'image/jpeg';
    p = me + 1;
    p += 1; // picture type
    if (enc === 1 || enc === 2) { while (p + 1 < data.length && !(data[p] === 0 && data[p + 1] === 0)) p += 2; p += 2; }
    else { while (p < data.length && data[p] !== 0) p++; p += 1; }
    const img = data.slice(p);
    if (!img.length) return null;
    if (!/^image\//i.test(mime)) mime = /png/i.test(mime) ? 'image/png' : 'image/jpeg';
    return { mime, data: img };
  } catch { return null; }
}

function parse(buf) {
  const out = { title: '', artist: '', album: '', picture: null };
  if (!buf || buf.length < 10 || buf.toString('latin1', 0, 3) !== 'ID3') return out;
  const ver = buf[3];
  const flags = buf[5];
  const size = synchsafe(buf, 6);
  const tagEnd = Math.min(10 + size, buf.length);
  let pos = 10;
  if (flags & 0x40) { // 확장 헤더 건너뛰기
    const ext = ver === 4 ? synchsafe(buf, pos) : plain32(buf, pos);
    pos += ver === 4 ? ext : ext + 4;
  }
  while (pos + 10 <= tagEnd) {
    const id = buf.toString('latin1', pos, pos + 4);
    if (!/^[A-Z0-9]{4}$/.test(id)) break; // 패딩/끝
    const fsize = ver === 4 ? synchsafe(buf, pos + 4) : plain32(buf, pos + 4);
    const dstart = pos + 10;
    if (fsize <= 0 || dstart + fsize > buf.length) break;
    const data = buf.slice(dstart, dstart + fsize);
    if (id === 'TIT2' || id === 'TPE1' || id === 'TALB') {
      const txt = decodeText(data.slice(1), data[0]);
      if (id === 'TIT2') out.title = txt;
      else if (id === 'TPE1') out.artist = txt;
      else out.album = txt;
    } else if (id === 'APIC' && !out.picture) {
      out.picture = parseApic(data);
    }
    pos = dstart + fsize;
  }
  return out;
}

// 모든 ID3 태그 제거(앞쪽 ID3v2 + 끝 ID3v1) → 오디오 프레임만 남긴 새 버퍼 반환
function strip(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  let start = 0, end = buf.length;
  // 앞쪽 ID3v2 (헤더 10B + size + 푸터 10B[v2.4 flag 0x10])
  if (buf.length >= 10 && buf.toString('latin1', 0, 3) === 'ID3') {
    const footer = (buf[5] & 0x10) ? 10 : 0;
    const len = 10 + synchsafe(buf, 6) + footer;
    if (len > 0 && len <= buf.length) start = len;
  }
  // 끝쪽 ID3v1 (128B, 'TAG')
  if (end - start >= 128 && buf.toString('latin1', end - 128, end - 125) === 'TAG') {
    end -= 128;
  }
  return buf.slice(start, end);
}

// ----- ID3v2.4 태그 작성 (제목/아티스트/앨범 텍스트 + APIC 표지) -----
const encSync = (n) => Buffer.from([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]);

function frame(id, body) {
  return Buffer.concat([Buffer.from(id, 'latin1'), encSync(body.length), Buffer.from([0, 0]), body]);
}
function textFrame(id, text) {
  if (!text) return null;
  return frame(id, Buffer.concat([Buffer.from([0x03]), Buffer.from(String(text), 'utf8')])); // enc 3 = UTF-8
}
function apicFrame(mime, data) {
  const head = Buffer.concat([
    Buffer.from([0x03]),                          // 텍스트 인코딩(UTF-8)
    Buffer.from(mime || 'image/jpeg', 'latin1'), Buffer.from([0x00]), // MIME + null
    Buffer.from([0x03]),                          // 그림 종류 0x03 = 앞표지
    Buffer.from([0x00]),                          // 설명(빈값) + null
  ]);
  return frame('APIC', Buffer.concat([head, data]));
}

// meta: { title, artist, album, picture:{mime,data} } → ID3v2.4 태그 버퍼
function build(meta) {
  meta = meta || {};
  const frames = [
    textFrame('TIT2', meta.title),
    textFrame('TPE1', meta.artist),
    textFrame('TALB', meta.album),
    (meta.picture && meta.picture.data && meta.picture.data.length)
      ? apicFrame(meta.picture.mime, meta.picture.data) : null,
  ].filter(Boolean);
  const body = Buffer.concat(frames);
  const header = Buffer.concat([
    Buffer.from('ID3', 'latin1'), Buffer.from([0x04, 0x00, 0x00]), encSync(body.length),
  ]);
  return Buffer.concat([header, body]);
}

module.exports = { parse, strip, build };
