'use strict';

// ---------- 상태 ----------
const state = {
  lines: [],          // { time: number|null, text: string }
  selected: -1,
  lrcPath: null,
  audioUrl: null,
  audioName: null,    // 로드된 mp3 파일명 (저장 기본 파일명에 사용)
  audioPath: null,    // 로드된 mp3 전체 경로 (태그 비우기 등 파일 작업용)
  tags: null,         // { title, artist, album, pictureDataUrl }
  loudness: null,     // { peakDb, rmsDb } — Web Audio 측정
};

const audio = document.getElementById('audio');

// 순수 LRC 로직은 lrc-core.js(window.LRC) 에서 공유
const { fmt, parseLrc } = window.LRC;
const serializeLrc = () => window.LRC.serializeLrc(state.lines);

// 언어팩 단축 헬퍼
const t = (key, params) => window.I18N.t(key, params);

// ---------- 렌더링 ----------
const linesEl = document.getElementById('lines');
let dragIndex = -1; // 드래그로 순서 변경 중인 줄 인덱스

// from 위치의 줄을 to 위치(제거 전 기준 삽입 인덱스)로 이동
function moveLine(from, to) {
  const item = state.lines[from];
  state.lines.splice(from, 1);
  if (to > from) to -= 1;                       // 제거로 인덱스가 한 칸 당겨짐
  to = Math.max(0, Math.min(to, state.lines.length));
  state.lines.splice(to, 0, item);
  state.selected = to;
  render();
}

function render() {
  linesEl.innerHTML = '';
  state.lines.forEach((row, i) => {
    const li = document.createElement('li');
    li.className = 'row' + (i === state.selected ? ' selected' : '');
    li.dataset.idx = i;

    // 드래그 핸들로 줄 순서 변경 (편집과 충돌 방지)
    const handle = document.createElement('span');
    handle.className = 'drag';
    handle.textContent = '⠿';
    handle.title = t('tip.drag');
    handle.draggable = true;
    handle.addEventListener('dragstart', (e) => {
      dragIndex = i;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
      e.dataTransfer.setDragImage(li, 16, 12);
    });
    handle.addEventListener('dragend', () => {
      dragIndex = -1;
      linesEl.querySelectorAll('.row').forEach((r) => r.classList.remove('dragging', 'drop-before', 'drop-after'));
    });
    li.addEventListener('dragover', (e) => {
      if (dragIndex < 0) return;
      e.preventDefault();
      const rect = li.getBoundingClientRect();
      const after = (e.clientY - rect.top) > rect.height / 2;
      linesEl.querySelectorAll('.row').forEach((r) => r.classList.remove('drop-before', 'drop-after'));
      if (i !== dragIndex) li.classList.add(after ? 'drop-after' : 'drop-before');
    });
    li.addEventListener('drop', (e) => {
      if (dragIndex < 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = li.getBoundingClientRect();
      const after = (e.clientY - rect.top) > rect.height / 2;
      moveLine(dragIndex, i + (after ? 1 : 0));
    });

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

    li.append(handle, ts, txt, del);
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
  state.audioPath = filePath;
  audio.src = state.audioUrl;
  document.getElementById('trackName').textContent = state.audioName;
  setStatus(t('status.audioLoaded', { name: state.audioName }));
  applyTags(filePath); // ID3 태그 비동기 로드 (실패해도 재생엔 영향 없음)
  state.loudness = null; updateGainUI();
  measureLoudness(ab).then((l) => { state.loudness = l; updateGainUI(); }); // 비동기 볼륨 측정
}

// Web Audio 로 디코드 → ReplayGain(MP3Gain 호환) 측정: { volume, trackGain, peak }
async function measureLoudness(arrayBuffer) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const buf = await ctx.decodeAudioData(arrayBuffer);
    const sr = buf.sampleRate;
    const L = buf.getChannelData(0);
    const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    ctx.close();
    return window.ReplayGain.measure(L, R, sr) || window.ReplayGain.measure(L, R, 44100);
  } catch { return null; }
}

function gainTargetVal() {
  const v = parseFloat(document.getElementById('gainTarget').value);
  return isFinite(v) ? v : window.ReplayGain.REF;
}

function updateGainUI() {
  const el = document.getElementById('gainNow');
  if (!el) return;
  if (!state.audioUrl) { el.textContent = '—'; return; }
  const l = state.loudness;
  if (!l) { el.textContent = t('gain.analyzing'); return; }
  const apply = gainTargetVal() - l.volume;   // 목표까지 적용할 보정(dB)
  el.textContent = t('gain.now', { vol: l.volume.toFixed(1), gain: (apply >= 0 ? '+' : '') + apply.toFixed(1) });
}

// 드롭한 이미지를 앨범 표지로 설정 (확인 → ≤300px JPEG 변환 → mp3 삽입 → 재표기)
async function applyCover(imagePath) {
  if (!state.audioPath) { setStatus(t('cover.noMp3')); return; }
  if (!window.confirm(t('cover.confirm'))) return;
  const res = await window.api.setCover(state.audioPath, imagePath);
  if (res && res.ok) {
    state.tags = Object.assign({ title: null, artist: null, album: null }, state.tags || {}, { pictureDataUrl: res.pictureDataUrl });
    updateMetaUI();                                          // 반영된 표지 다시 표기
    if (demoOpen) updateDemoMeta();
    setStatus(t('cover.done', { kb: Math.round((res.bytes || 0) / 1024) }));
  } else {
    setStatus(t('cover.fail') + (res && res.error ? ': ' + res.error : ''));
  }
}

// mp3 태그 읽어 메타 UI 갱신
async function applyTags(filePath) {
  try { state.tags = await window.api.readTags(filePath); }
  catch { state.tags = null; }
  updateMetaUI();
}
function updateMetaUI() {
  const tg = state.tags || {};
  document.getElementById('mTitle').textContent = tg.title || '';
  document.getElementById('mArtist').textContent = tg.artist || '';
  document.getElementById('mAlbum').textContent = tg.album || '';
  const cover = document.getElementById('coverArt');
  if (tg.pictureDataUrl) { cover.src = tg.pictureDataUrl; cover.hidden = false; }
  else { cover.removeAttribute('src'); cover.hidden = true; }
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
  state.audioPath = null;
  state.tags = null;
  state.loudness = null;
  updateMetaUI();
  updateGainUI();
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
  // 선택된 줄이 있으면 그 아래, 없으면 맨 끝
  const at = (state.selected >= 0 && state.selected < state.lines.length) ? state.selected + 1 : state.lines.length;
  state.lines.splice(at, 0, { time: null, text: '' });
  state.selected = at;
  render();
  const sel = linesEl.querySelector('.row.selected');
  if (sel) sel.scrollIntoView({ block: 'nearest' });
});

// ---------- 여러 줄 추가 모달 ----------
const multiModal = document.getElementById('multiModal');
const multiInput = document.getElementById('multiInput');
const multiPreview = document.getElementById('multiPreview');
const multiCount = document.getElementById('multiCount');
const multiAdd = document.getElementById('multiAdd');

function multiLines() {
  return multiInput.value.split(/\r?\n/).map((s) => s.trim()).filter((s) => s.length > 0);
}
function updateMultiPreview() {
  const lines = multiLines();
  multiPreview.innerHTML = '';
  for (const tx of lines) {
    const li = document.createElement('li');
    li.className = 'prev-row';
    const ts = document.createElement('span'); ts.className = 'prev-ts'; ts.textContent = '--:--.--';
    const tt = document.createElement('span'); tt.className = 'prev-tx'; tt.textContent = tx;
    li.append(ts, tt);
    multiPreview.appendChild(li);
  }
  multiCount.textContent = t('multi.preview', { n: lines.length });
  multiAdd.textContent = t('multi.add', { n: lines.length });
  multiAdd.disabled = lines.length === 0;
}
function openMulti() { multiInput.value = ''; updateMultiPreview(); multiModal.hidden = false; multiInput.focus(); }
function closeMulti() { multiModal.hidden = true; }
function commitMulti() {
  const lines = multiLines();
  if (!lines.length) return;
  // 선택된 줄이 있으면 그 아래에 삽입, 없으면 맨 끝
  const at = (state.selected >= 0 && state.selected < state.lines.length) ? state.selected + 1 : state.lines.length;
  state.lines.splice(at, 0, ...lines.map((tx) => ({ time: null, text: tx }))); // 시간은 선택 → null
  state.selected = at;          // 새로 추가된 첫 줄 선택
  render();
  closeMulti();
  setStatus(t('multi.added', { n: lines.length }));
}
document.getElementById('addMulti').addEventListener('click', openMulti);
document.getElementById('multiClose').addEventListener('click', closeMulti);
document.getElementById('multiCancel').addEventListener('click', closeMulti);
multiAdd.addEventListener('click', commitMulti);
multiInput.addEventListener('input', updateMultiPreview);
multiModal.addEventListener('mousedown', (e) => { if (e.target === multiModal) closeMulti(); }); // 바깥 클릭 닫기
document.getElementById('demoMode').addEventListener('change', () => { lastActive = -1; highlightActive(); });

// 단축키
document.addEventListener('keydown', (e) => {
  if (!multiModal.hidden) {                         // 여러 줄 모달 열림
    if (e.key === 'Escape') { e.preventDefault(); closeMulti(); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitMulti(); }
    return;
  }
  if (!document.getElementById('tagClearModal').hidden) { // 태그 비우기 모달 열림
    if (e.key === 'Escape') { e.preventDefault(); document.getElementById('tagClearModal').hidden = true; }
    return;
  }
  if (demoOpen) {
    if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeDemo(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(audio.currentTime - 5); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(audio.currentTime + 5); }
    return;
  }
  const ae = document.activeElement;
  const editing = ae && (ae.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName));
  if (editing) return;
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); stampCurrent(); }
  else if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); selectRow(Math.min(state.selected + 1, state.lines.length - 1)); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); selectRow(Math.max(state.selected - 1, 0)); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(audio.currentTime - 5); }   // 5초 뒤로
  else if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(audio.currentTime + 5); }    // 5초 앞으로
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

document.getElementById('gainTarget').addEventListener('input', updateGainUI); // 목표 바꾸면 보정값 갱신
document.getElementById('gainApply').addEventListener('click', async () => {
  if (!state.audioPath) { setStatus(t('gain.noMp3')); return; }
  if (!state.loudness) { setStatus(t('gain.analyzing')); return; }
  const raw = document.getElementById('gainTarget').value;
  if (String(raw).trim() === '' || !isFinite(parseFloat(raw))) { setStatus(t('gain.invalid')); return; }
  const steps = Math.round((parseFloat(raw) - state.loudness.volume) / 1.5); // 1 step = 1.5dB
  if (steps === 0) { setStatus(t('gain.already')); return; }
  const res = await window.api.applyGain(state.audioPath, steps);
  if (res && res.ok) {
    const db = steps * 1.5;
    await loadAudioFromPath(state.audioPath, state.audioName); // 파일 변경됨 → 재로드+재측정
    setStatus(t('gain.applied', { db: (db > 0 ? '+' : '') + db.toFixed(1) }));
  } else {
    setStatus(t('gain.fail') + (res && res.error ? ': ' + res.error : ''));
  }
});

// 태그 비우기: 표지 유지/전부 비우기 선택 모달
const tagClearModal = document.getElementById('tagClearModal');
function closeTagClear() { tagClearModal.hidden = true; }
async function doClearTags(keepCover) {
  closeTagClear();
  const res = await window.api.clearTags(state.audioPath, keepCover);
  if (res && res.ok) {
    const cover = keepCover ? (state.tags && state.tags.pictureDataUrl) || null : null;
    state.tags = { title: null, artist: null, album: null, pictureDataUrl: cover };
    updateMetaUI();
    setStatus(t(keepCover ? 'tagclear.doneKept' : 'tagclear.done', { name: state.audioName }));
  } else {
    setStatus(t('tagclear.fail') + (res && res.error ? ': ' + res.error : ''));
  }
}
document.getElementById('tagClear').addEventListener('click', () => {
  if (!state.audioPath) { setStatus(t('tagclear.noMp3')); return; }
  tagClearModal.hidden = false;
});
document.getElementById('tcClose').addEventListener('click', closeTagClear);
document.getElementById('tcCancel').addEventListener('click', closeTagClear);
document.getElementById('tcKeepCover').addEventListener('click', () => doClearTags(true));
document.getElementById('tcAll').addEventListener('click', () => doClearTags(false));
tagClearModal.addEventListener('mousedown', (e) => { if (e.target === tagClearModal) closeTagClear(); });

document.getElementById('clearLrc').addEventListener('click', () => {
  if (state.lines.length === 0) { setStatus(t('status.noLrcToClear')); return; }
  if (!window.confirm(t('confirm.clearLrc'))) return;
  clearLrc();
});

// ---------- 드래그앤드롭 (창 어디에 놔도 확장자로 자동 분기) ----------
const dropOverlay = document.getElementById('dropOverlay');
let dragDepth = 0; // 자식 요소 위를 지날 때 dragleave 깜빡임 방지용 카운터

function dragHasFiles(e) {
  return e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
}
window.addEventListener('dragenter', (e) => {
  if (!dragHasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  dropOverlay.hidden = false;
});
window.addEventListener('dragover', (e) => { if (dragHasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', (e) => {
  if (!dragHasFiles(e)) return;
  e.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) dropOverlay.hidden = true;
});
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragDepth = 0;
  dropOverlay.hidden = true;
  const files = Array.from(e.dataTransfer.files || []);
  for (const file of files) {
    const p = window.api.pathForFile(file);
    const lower = (file.name || p).toLowerCase();
    if (lower.endsWith('.lrc') || lower.endsWith('.txt')) {
      const content = await window.api.readLrc(p);
      state.lines = parseLrc(content); state.lrcPath = p; state.selected = 0; render();
      setStatus(t('status.lrcLoaded', { name: file.name }));   // lrc → 편집기
    } else if (/\.(png|jpe?g)$/.test(lower)) {
      await applyCover(p);                                      // 이미지 → 표지
    } else {
      await loadAudioFromPath(p, file.name);                    // mp3 등 → 재생기
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
const dNext1 = document.getElementById('dNext1');
const dNext2 = document.getElementById('dNext2');
const dSetA = document.getElementById('dSetA');
const dSetB = document.getElementById('dSetB');
const dClearAB = document.getElementById('dClearAB');
const dABInfo = document.getElementById('dABInfo');
const dClose = document.getElementById('dClose');

let demoOpen = false;
let demoSeeking = false;
let loopA = null, loopB = null;
let lastDemoIdx = -99;
const D_FONT_CUR = 52, D_FONT_SIDE = 30, D_FONT_MIN = 16; // px

// 슬롯 높이는 CSS로 고정 → 텍스트가 길어 넘치면 폰트를 줄여 높이 유지
function fitFont(span, maxPx) {
  const box = span.parentElement;
  let f = maxPx;
  span.style.fontSize = f + 'px';
  let guard = 40;
  while (span.scrollHeight > box.clientHeight && f > D_FONT_MIN && guard-- > 0) {
    f -= 2; span.style.fontSize = f + 'px';
  }
}

function setDemoLine(span, text, maxPx, animate) {
  span.textContent = text || '';
  fitFont(span, maxPx);
  if (animate && text) { span.classList.remove('rolling'); void span.offsetWidth; span.classList.add('rolling'); }
}

// 시간이 있는 가사만 시간순으로
function timedLines() {
  return state.lines.filter((l) => l.time != null && l.text).sort((a, b) => a.time - b.time);
}

function openDemo() {
  if (!state.audioUrl || timedLines().length === 0) { setStatus(t('demo.noData')); return; }
  demoOpen = true;
  lastDemoIdx = -99;
  demoOverlay.hidden = false;
  dSeek.max = audio.duration || 0;
  dDur.textContent = fmt(audio.duration);
  updateDemoMeta();
  updateDemoLines();
  audio.play();
}

// 데모 상단의 앨범아트/제목/아티스트
function updateDemoMeta() {
  const tg = state.tags || {};
  const dc = document.getElementById('dCover');
  if (tg.pictureDataUrl) { dc.src = tg.pictureDataUrl; dc.hidden = false; }
  else { dc.removeAttribute('src'); dc.hidden = true; }
  document.getElementById('dTitle').textContent = tg.title || state.audioName || '';
  document.getElementById('dArtist').textContent = [tg.artist, tg.album].filter(Boolean).join(' · ');
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
  dCur.textContent = fmt(tc);
  if (!demoSeeking) dSeek.value = tc;
  if (idx === lastDemoIdx) return;               // 같은 줄이면 갱신/애니메이션 안 함
  const advanced = idx === lastDemoIdx + 1;       // 한 줄 자연 진행일 때만 롤업(탐색 점프는 즉시)
  lastDemoIdx = idx;
  const at = (i) => (i >= 0 && i < lines.length) ? lines[i].text : '';
  setDemoLine(dPrev, at(idx - 1), D_FONT_SIDE, advanced);
  setDemoLine(dCurLine, idx >= 0 ? lines[idx].text : '', D_FONT_CUR, advanced);
  setDemoLine(dNext1, at(idx + 1), D_FONT_SIDE, advanced);
  setDemoLine(dNext2, at(idx + 2), D_FONT_SIDE, advanced);
}

// 창 크기 변경 시 고정 높이(vh)가 바뀌므로 폰트 재맞춤
window.addEventListener('resize', () => { if (demoOpen) { lastDemoIdx = -99; updateDemoLines(); } });

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
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
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
  if (multiModal && !multiModal.hidden) updateMultiPreview(); // 모달 열린 채 언어 변경 시 라벨/카운트 갱신
  updateGainUI();
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
