'use strict';
// 브라우저(script 태그)와 Node(require) 양쪽에서 쓰는 순수 LRC 로직.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // Node / 테스트
  root.LRC = api;                                                            // 브라우저 window
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {

  // 초 → "mm:ss.xx"
  function fmt(sec) {
    if (sec == null || isNaN(sec)) return '--:--.--';
    if (sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    let cs = Math.round((sec - Math.floor(sec)) * 100);
    if (cs === 100) cs = 99; // 반올림 경계 보정
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  function lrcTag(sec) { return `[${fmt(sec)}]`; }

  // "mm:ss.xx" 문자열 → 초. 형식이 정확히 맞지 않으면 null (저장 거부용).
  //   mm: 1~2자리, ss: 00~59 두 자리, xx: 두 자리(센티초)
  function parseTimeStr(str) {
    const m = /^(\d{1,2}):([0-5]\d)\.(\d{2})$/.exec(String(str).trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseInt(m[3], 10) / 100;
  }

  // [mm:ss.xx] / [mm:ss.xxx] 시간태그. 한 줄에 여러 개 가능(반복 가사).
  const TIME_RE = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

  function parseLrc(text) {
    const out = [];
    for (const line of String(text).split(/\r?\n/)) {
      TIME_RE.lastIndex = 0;
      const tags = [];
      let m;
      while ((m = TIME_RE.exec(line)) !== null) {
        const min = parseInt(m[1], 10);
        const sec = parseInt(m[2], 10);
        let frac = 0;
        if (m[3] != null) {
          frac = m[3].length === 3 ? parseInt(m[3], 10) / 1000 : parseInt(m[3], 10) / 100;
        }
        tags.push(min * 60 + sec + frac);
      }
      const txt = line.replace(TIME_RE, '').trim();
      if (tags.length > 0) {
        for (const t of tags) out.push({ time: t, text: txt });
      } else if (txt.length > 0 && !/^\[[a-zA-Z]+:/.test(line)) {
        out.push({ time: null, text: txt }); // 시간 없는 일반 줄 ([ti:] 등 id 태그 제외)
      }
    }
    return sortLines(out);
  }

  function sortLines(lines) {
    return [...lines].sort((a, b) => {
      if (a.time == null) return 1;
      if (b.time == null) return -1;
      return a.time - b.time;
    });
  }

  function serializeLrc(lines) {
    return sortLines(lines)
      .map((r) => (r.time == null ? r.text : `${lrcTag(r.time)}${r.text}`))
      .join('\n') + '\n';
  }

  return { fmt, lrcTag, parseTimeStr, parseLrc, serializeLrc, sortLines };
});
