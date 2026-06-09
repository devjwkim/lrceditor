'use strict';

// ---------- 상태 ----------
const state = {
  lines: [],          // { time: number|null, text: string }
  selected: -1,
  lrcPath: null,
  audioUrl: null,
  audioName: null,    // 로드된 mp3 파일명 (저장 기본 파일명에 사용)
};

const audio = document.getElementById('audio');

// 순수 LRC 로직은 lrc-core.js(window.LRC) 에서 공유
const { fmt, parseLrc } = window.LRC;
const serializeLrc = () => window.LRC.serializeLrc(state.lines);

// 언어팩 단축 헬퍼
const t = (key, params) => window.I18N.t(key, params);

// ---------- 렌더링 ----------
const linesEl = document.getElementById('lines');

function render() {
  linesEl.innerHTML = '';
  state.lines.forEach((row, i) => {
    const li = document.createElement('li');
    li.className = 'row' + (i === state.selected ? ' selected' : '');
    li.dataset.idx = i;

    const ts = document.createElement('span');
    ts.className = 'ts' + (row.time == null ? ' empty' : '');
    ts.textContent = row.time == null ? '--:--.--' : fmt(row.time);
    ts.title = t('tip.ts');
    const resetTs = () => {
      ts.textContent = state.lines[i].time == null ? '--:--.--' : fmt(state.lines[i].time);
      ts.classList.toggle('empty', state.lines[i].time == null);
    };
    ts.addEventListener('click', (e) => {
      e.stopPropagation();
      if (ts.isContentEditable) return;
      if (state.lines[i].time != null) seekTo(state.lines[i].time);
    });
    ts.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (ts.isContentEditable) return;
      selectRow(i);
      ts.textContent = state.lines[i].time == null ? '00:00.00' : fmt(state.lines[i].time);
      ts.classList.remove('empty');
      ts.contentEditable = 'true';
      ts.focus();
      const r = document.createRange(); r.selectNodeContents(ts); r.collapse(false);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    });
    ts.addEventListener('paste', (e) => {
      e.preventDefault();
      const clip = (e.clipboardData || window.clipboardData).getData('text/plain').trim();
      document.execCommand('insertText', false, clip);
    });
    ts.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); ts.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); ts.dataset.cancel = '1'; ts.blur(); }
    });
    ts.addEventListener('blur', () => {
      ts.contentEditable = 'false';
      if (ts.dataset.cancel === '1') { delete ts.dataset.cancel; resetTs(); return; }
      const sec = window.LRC.parseTimeStr(ts.textContent);
      if (sec == null) {
        setStatus(t('status.timeInvalid'));
        resetTs();
        return;
      }
      state.lines[i].time = sec;
      // 시간이 바뀌면 시간순으로 재정렬 (편집한 줄은 계속 선택 유지)
      const edited = state.lines[i];
      state.lines = window.LRC.sortLines(state.lines);
      state.selected = state.lines.indexOf(edited);
      render();
      const selEl = linesEl.querySelector('.row.selected');
      if (selEl) selEl.scrollIntoView({ block: 'nearest' });
      setStatus(t('status.timeFixed', { t: fmt(sec) }));
    });

    const txt = document.createElement('span');
    txt.className = 'txt';
    txt.textContent = row.text;
    const beginEdit = (e) => {
      if (e) e.stopPropagation();
      if (txt.isContentEditable) return;
      selectRow(i);
      txt.contentEditable = 'true';
      txt.focus();
      // 커서(프롬프트)를 텍스트 맨 앞으로 — 커서는 기본 깜빡임
      const r = document.createRange();
      r.selectNodeContents(txt); r.collapse(true);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    };
    // 가사 영역은 한 번 클릭으로 바로 편집 (글자가 없어도)
    txt.addEventListener('click', beginEdit);
    // 붙여넣기는 항상 순수 텍스트로 (색상/서식 유입 방지)
    txt.addEventListener('paste', (e) => {
      e.preventDefault();
      const clip = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r?\n/g, ' ');
      document.execCommand('insertText', false, clip);
    });
    txt.addEventListener('blur', () => {
      txt.contentEditable = 'false';
      const plain = txt.textContent.trim();
      state.lines[i].text = plain;
      txt.textContent = plain; // 남아있을 수 있는 인라인 서식 제거
    });
    txt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); txt.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); txt.textContent = state.lines[i].text; txt.blur(); }
    });

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '✕';
    del.title = t('tip.del');
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      state.lines.splice(i, 1);
      if (state.selected >= state.lines.length) state.selected = state.lines.length - 1;
      render();
    });

    li.addEventListener('click', () => selectRow(i));

    li.append(ts, txt, del);
    linesEl.appendChild(li);
  });
  highlightActive();
  updateStampBtn();
}

// 선택 변경은 전체 재렌더 없이 클래스만 토글 (재렌더 시 더블클릭 편집이 깨지는 문제 방지)
function selectRow(i) {
  state.selected = i;
  linesEl.querySelectorAll('.row').forEach((r, idx) => r.classList.toggle('selected', idx === i));
  updateStampBtn();
}

// 줄이 선택돼 있어야 타임스탬프를 찍을 수 있음 → 아니면 버튼 비활성화
function updateStampBtn() {
  const ok = state.lines.length > 0 && state.selected >= 0;
  const btn = document.getElementById('stampBtn');
  btn.disabled = !ok;
  btn.title = ok ? t('tip.stampEnabled') : t('tip.stampDisabled');
}

// ---------- 데모: 현재 재생 줄 강조 ----------
function activeIndex(t) {
  let idx = -1;
  state.lines.forEach((r, i) => {
    if (r.time != null && r.time <= t + 1e-3) idx = i;
  });
  return idx;
}

let lastActive = -1;
function highlightActive() {
  const demo = document.getElementById('demoMode').checked;
  const rows = linesEl.querySelectorAll('.row');
  rows.forEach((r) => r.classList.remove('active'));
  if (!demo) { lastActive = -1; return; }
  // 시간순 정렬 인덱스가 아니라 표시순과 동일하므로 그대로 사용
  const sorted = state.lines
    .map((r, i) => ({ ...r, i }))
    .filter((r) => r.time != null)
    .sort((a, b) => a.time - b.time);
  let activeI = -1;
  for (const r of sorted) { if (r.time <= audio.currentTime + 1e-3) activeI = r.i; }
  if (activeI >= 0 && rows[activeI]) {
    rows[activeI].classList.add('active');
    if (activeI !== lastActive) {
      rows[activeI].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      lastActive = activeI;
    }
  }
}

// ---------- 오디오 ----------
const seek = document.getElementById('seek');
const playBtn = document.getElementById('playBtn');
const curTimeEl = document.getElementById('curTime');
const durTimeEl = document.getElementById('durTime');

// dirty=true(기본)면 사용자 동작에 의한 메시지로 표시 → 언어전환 시 초기문구로 덮어쓰지 않음
let statusDirty = false;
function setStatus(msg, dirty = true) {
  if (dirty) statusDirty = true;
  document.getElementById('statusText').textContent = msg;
}

async function loadAudioFromPath(filePath, name) {
  const ab = await window.api.readAudio(filePath);
  const blob = new Blob([ab], { type: 'audio/mpeg' });
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(blob);
  state.audioName = name || filePath.split(/[\\/]/).pop();
  audio.src = state.audioUrl;
  document.getElementById('trackName').textContent = state.audioName;
  setStatus(t('status.audioLoaded', { name: state.audioName }));
}

function seekTo(sec) {
  if (!isFinite(audio.duration)) return;
  audio.currentTime = Math.max(0, Math.min(sec, audio.duration));
}

// 현재 mp3 해제 → 다른 mp3 첨부 가능 상태로
function clearAudio() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  if (state.audioUrl) { URL.revokeObjectURL(state.audioUrl); state.audioUrl = null; }
  state.audioName = null;
  document.getElementById('trackName').textContent = t('player.noFile');
  seek.value = 0; seek.max = 100;
  curTimeEl.textContent = fmt(0);
  durTimeEl.textContent = fmt(0);
  playBtn.textContent = t('btn.play');
  lastActive = -1;
  setStatus(t('status.mp3Cleared'));
}

// 빈 LRC로 새로 시작 (읽어오기 없이 바로 작성)
function startNewLrc() {
  state.lines = [{ time: null, text: '' }];
  state.selected = 0;
  state.lrcPath = null;
  lastActive = -1;
  render();
  setStatus(t('status.newLrc'));
}

// 현재 가사 해제 → 다른 lrc 첨부 가능 상태로
function clearLrc() {
  state.lines = [];
  state.selected = -1;
  state.lrcPath = null;
  lastActive = -1;
  render();
  setStatus(t('status.lrcCleared'));
}

audio.addEventListener('loadedmetadata', () => {
  seek.max = audio.duration || 0;
  durTimeEl.textContent = fmt(audio.duration);
});
audio.addEventListener('timeupdate', () => {
  // 구간 반복: B 도달 시 A로 점프
  if (loopA != null && loopB != null && loopB > loopA && audio.currentTime >= loopB) {
    audio.currentTime = loopA;
  }
  curTimeEl.textContent = fmt(audio.currentTime);
  if (!seeking) seek.value = audio.currentTime;
  highlightActive();
  if (demoOpen) updateDemoLines();
});
audio.addEventListener('play', () => { playBtn.textContent = t('btn.pause'); });
audio.addEventListener('pause', () => { playBtn.textContent = t('btn.play'); });
audio.addEventListener('ended', () => { playBtn.textContent = t('btn.play'); });

let seeking = false;
seek.addEventListener('input', () => { seeking = true; curTimeEl.textContent = fmt(parseFloat(seek.value)); });
seek.addEventListener('change', () => { seekTo(parseFloat(seek.value)); seeking = false; });

playBtn.addEventListener('click', () => { audio.paused ? audio.play() : audio.pause(); });
document.getElementById('back5').addEventListener('click', () => seekTo(audio.currentTime - 5));
document.getElementById('fwd5').addEventListener('click', () => seekTo(audio.currentTime + 5));
document.getElementById('rate').addEventListener('change', (e) => { audio.playbackRate = parseFloat(e.target.value); });

// ---------- 타임스탬프 찍기 ----------
function stampCurrent() {
  if (state.lines.length === 0 || state.selected < 0) return; // 선택된 줄이 있어야 동작
  state.lines[state.selected].time = audio.currentTime;
  // 다음 줄로 자동 이동
  if (state.selected < state.lines.length - 1) state.selected += 1;
  render();
}

document.getElementById('stampBtn').addEventListener('click', stampCurrent);
document.getElementById('addLine').addEventListener('click', () => {
  state.lines.push({ time: null, text: '' });
  state.selected = state.lines.length - 1;
  render();
});
document.getElementById('demoMode').addEventListener('change', () => { lastActive = -1; highlightActive(); });

// 단축키
document.addEventListener('keydown', (e) => {
  if (demoOpen) {
    if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeDemo(); }
    return;
  }
  const editing = document.activeElement && document.activeElement.isContentEditable;
  if (editing) return;
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); stampCurrent(); }
  else if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); selectRow(Math.min(state.selected + 1, state.lines.length - 1)); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); selectRow(Math.max(state.selected - 1, 0)); }
});

// ---------- 파일 버튼 ----------
document.getElementById('openMp3').addEventListener('click', async () => {
  const res = await window.api.openMp3();
  if (res) await loadAudioFromPath(res.path, res.name);
});

document.getElementById('openLrc').addEventListener('click', async () => {
  const res = await window.api.openLrc();
  if (res) { state.lines = parseLrc(res.content); state.lrcPath = res.path; state.selected = 0; render(); setStatus(t('status.lrcLoaded', { name: res.name })); }
});

document.getElementById('saveLrc').addEventListener('click', async () => {
  const content = serializeLrc();
  const saved = await window.api.saveLrc(content, defaultSaveName());
  if (saved) { state.lrcPath = saved; setStatus(t('status.saved', { path: saved })); }
});

// 저장 기본 파일명: 이미 연 lrc가 있으면 그 경로, 아니면 mp3파일명.lrc, 둘 다 없으면 lyrics.lrc
function defaultSaveName() {
  if (state.lrcPath) return state.lrcPath;
  if (state.audioName) return state.audioName.replace(/\.[^.]+$/, '') + '.lrc';
  return 'lyrics.lrc';
}

document.getElementById('newLrc').addEventListener('click', () => {
  if (state.lines.length > 0 && !window.confirm(t('confirm.newLrc'))) return;
  startNewLrc();
});

document.getElementById('clearMp3').addEventListener('click', () => {
  if (!state.audioUrl) { setStatus(t('status.noMp3ToClear')); return; }
  clearAudio();
});

document.getElementById('clearLrc').addEventListener('click', () => {
  if (state.lines.length === 0) { setStatus(t('status.noLrcToClear')); return; }
  if (!window.confirm(t('confirm.clearLrc'))) return;
  clearLrc();
});

// ---------- 드래그앤드롭 ----------
const dropZone = document.getElementById('dropZone');
['dragenter', 'dragover'].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); }));
['dragleave', 'drop'].forEach((ev) =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); }));

document.body.addEventListener('dragover', (e) => e.preventDefault());
document.body.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  for (const file of e.dataTransfer.files) {
    const p = window.api.pathForFile(file);
    const lower = (file.name || p).toLowerCase();
    if (lower.endsWith('.lrc') || lower.endsWith('.txt')) {
      const content = await window.api.readLrc(p);
      state.lines = parseLrc(content); state.lrcPath = p; state.selected = 0; render();
      setStatus(t('status.lrcLoaded', { name: file.name }));
    } else {
      await loadAudioFromPath(p, file.name);
    }
  }
});

// ---------- 데모 플레이 (노래방 오버레이) ----------
const demoOverlay = document.getElementById('demoOverlay');
const dPlay = document.getElementById('dPlay');
const dSeek = document.getElementById('dSeek');
const dCur = document.getElementById('dCur');
const dDur = document.getElementById('dDur');
const dPrev = document.getElementById('dPrev');
const dCurLine = document.getElementById('dCurLine');
const dNext = document.getElementById('dNext');
const dSetA = document.getElementById('dSetA');
const dSetB = document.getElementById('dSetB');
const dClearAB = document.getElementById('dClearAB');
const dABInfo = document.getElementById('dABInfo');
const dClose = document.getElementById('dClose');

let demoOpen = false;
let demoSeeking = false;
let loopA = null, loopB = null;

// 시간이 있는 가사만 시간순으로
function timedLines() {
  return state.lines.filter((l) => l.time != null && l.text).sort((a, b) => a.time - b.time);
}

function openDemo() {
  if (!state.audioUrl || timedLines().length === 0) { setStatus(t('demo.noData')); return; }
  demoOpen = true;
  demoOverlay.hidden = false;
  dSeek.max = audio.duration || 0;
  dDur.textContent = fmt(audio.duration);
  updateDemoLines();
  audio.play();
}

function closeDemo() {
  demoOpen = false;
  demoOverlay.hidden = true;
  audio.pause();
}

function updateDemoLines() {
  if (!demoOpen) return;
  const lines = timedLines();
  const tc = audio.currentTime;
  let idx = -1;
  for (let i = 0; i < lines.length; i++) { if (lines[i].time <= tc + 1e-3) idx = i; }
  dPrev.textContent = idx - 1 >= 0 ? lines[idx - 1].text : '';
  dCurLine.textContent = idx >= 0 ? lines[idx].text : '';
  dNext.textContent = (idx + 1) < lines.length ? lines[idx + 1].text : '';
  dCur.textContent = fmt(tc);
  if (!demoSeeking) dSeek.value = tc;
}

function updateLoopInfo() {
  const on = loopA != null && loopB != null && loopB > loopA;
  dSetA.classList.toggle('active', loopA != null);
  dSetB.classList.toggle('active', loopB != null);
  dABInfo.textContent =
    (loopA != null ? 'A ' + fmt(loopA) : '') +
    (loopB != null ? ' – B ' + fmt(loopB) : '') +
    (on ? ' ↺' : '');
}

document.getElementById('demoPlay').addEventListener('click', openDemo);
dClose.addEventListener('click', closeDemo);
dPlay.addEventListener('click', () => { audio.paused ? audio.play() : audio.pause(); });
dSeek.addEventListener('input', () => { demoSeeking = true; dCur.textContent = fmt(parseFloat(dSeek.value)); });
dSeek.addEventListener('change', () => { seekTo(parseFloat(dSeek.value)); demoSeeking = false; });
dSetA.addEventListener('click', () => { loopA = audio.currentTime; if (loopB != null && loopB <= loopA) loopB = null; updateLoopInfo(); });
dSetB.addEventListener('click', () => { loopB = audio.currentTime; if (loopA == null || loopA >= loopB) loopA = 0; updateLoopInfo(); });
dClearAB.addEventListener('click', () => { loopA = loopB = null; updateLoopInfo(); });

// 데모 재생 버튼 아이콘 동기화
function syncDemoPlayIcon() { dPlay.textContent = audio.paused ? '▶' : '⏸'; }
audio.addEventListener('play', syncDemoPlayIcon);
audio.addEventListener('pause', syncDemoPlayIcon);

// ---------- 언어팩 ----------
// 정적 요소(data-i18n)·툴팁(data-i18n-title)·동적 요소에 현재 언어 적용
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  // 힌트는 kbd 태그 포함이라 별도 처리
  const hintEl = document.querySelector('.hint');
  if (hintEl) {
    hintEl.innerHTML = t('hint')
      .split('{S}').join('<kbd>S</kbd>')
      .split('{Enter}').join('<kbd>Enter</kbd>')
      .split('{Esc}').join('<kbd>Esc</kbd>');
  }
  // 가사 placeholder(빈 줄 안내)는 CSS 변수로 전달
  linesEl.style.setProperty('--lyric-ph', JSON.stringify(t('placeholder.lyric')));
  // 동적 텍스트
  document.documentElement.lang = window.I18N.getLang();
  if (!state.audioName) document.getElementById('trackName').textContent = t('player.noFile');
  playBtn.textContent = audio.paused ? t('btn.play') : t('btn.pause');
  // 시작 안내(아직 동적 상태 메시지가 없을 때만)
  if (!statusDirty) setStatus(t('status.initial'), false);
  updateStampBtn();
}

function initI18n() {
  const saved = (typeof localStorage !== 'undefined' && localStorage.getItem('lrc.lang')) || 'en';
  window.I18N.setLang(saved);
  const sel = document.getElementById('langSelect');
  window.I18N.langs.forEach((l) => {
    const o = document.createElement('option');
    o.value = l.code; o.textContent = l.label;
    sel.appendChild(o);
  });
  sel.value = window.I18N.getLang();
  sel.addEventListener('change', () => {
    window.I18N.setLang(sel.value);
    if (typeof localStorage !== 'undefined') localStorage.setItem('lrc.lang', sel.value);
    applyI18n();
    render(); // 행 툴팁/placeholder 갱신
  });
  applyI18n();
}

initI18n();
render();
