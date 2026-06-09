'use strict';

// ---------- 상태 ----------
const state = {
  lines: [],          // { time: number|null, text: string }
  selected: -1,
  lrcPath: null,
  audioUrl: null,
};

const audio = document.getElementById('audio');

// 순수 LRC 로직은 lrc-core.js(window.LRC) 에서 공유
const { fmt, parseLrc } = window.LRC;
const serializeLrc = () => window.LRC.serializeLrc(state.lines);

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
    ts.title = '클릭=그 시각으로 이동 · 더블클릭=시간 편집 (mm:ss.xx)';
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
      const t = (e.clipboardData || window.clipboardData).getData('text/plain').trim();
      document.execCommand('insertText', false, t);
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
        setStatus('시간 형식이 올바르지 않습니다 — mm:ss.xx (예: 01:23.45). 저장하지 않음.');
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
      setStatus('시간 수정됨: ' + fmt(sec));
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
      const t = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\r?\n/g, ' ');
      document.execCommand('insertText', false, t);
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
    del.title = '줄 삭제';
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
  btn.title = ok ? '단축키: S' : '먼저 가사 줄을 선택하세요';
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

function setStatus(msg) { document.getElementById('statusText').textContent = msg; }

async function loadAudioFromPath(filePath, name) {
  const ab = await window.api.readAudio(filePath);
  const blob = new Blob([ab], { type: 'audio/mpeg' });
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(blob);
  audio.src = state.audioUrl;
  document.getElementById('trackName').textContent = name || filePath;
  setStatus('오디오 로드됨: ' + (name || filePath));
}

function loadAudioFromBuffer(ab, name) {
  const blob = new Blob([ab], { type: 'audio/mpeg' });
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(blob);
  audio.src = state.audioUrl;
  document.getElementById('trackName').textContent = name;
  setStatus('오디오 로드됨: ' + name);
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
  document.getElementById('trackName').textContent = '로드된 파일 없음';
  seek.value = 0; seek.max = 100;
  curTimeEl.textContent = fmt(0);
  durTimeEl.textContent = fmt(0);
  playBtn.textContent = '▶︎ 재생';
  lastActive = -1;
  setStatus('mp3 해제됨 — 다른 mp3를 열거나 끌어다 놓으세요');
}

// 빈 LRC로 새로 시작 (읽어오기 없이 바로 작성)
function startNewLrc() {
  state.lines = [{ time: null, text: '' }];
  state.selected = 0;
  state.lrcPath = null;
  lastActive = -1;
  render();
  setStatus('빈 LRC로 시작 — 가사 영역을 클릭해 입력하고 재생 중 S로 시간을 찍으세요');
}

// 현재 가사 해제 → 다른 lrc 첨부 가능 상태로
function clearLrc() {
  state.lines = [];
  state.selected = -1;
  state.lrcPath = null;
  lastActive = -1;
  render();
  setStatus('가사 해제됨 — 다른 lrc를 열거나 끌어다 놓으세요');
}

audio.addEventListener('loadedmetadata', () => {
  seek.max = audio.duration || 0;
  durTimeEl.textContent = fmt(audio.duration);
});
audio.addEventListener('timeupdate', () => {
  curTimeEl.textContent = fmt(audio.currentTime);
  if (!seeking) seek.value = audio.currentTime;
  highlightActive();
});
audio.addEventListener('play', () => { playBtn.textContent = '⏸ 일시정지'; });
audio.addEventListener('pause', () => { playBtn.textContent = '▶︎ 재생'; });
audio.addEventListener('ended', () => { playBtn.textContent = '▶︎ 재생'; });

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
  if (res) { state.lines = parseLrc(res.content); state.lrcPath = res.path; state.selected = 0; render(); setStatus('LRC 로드됨: ' + res.name); }
});

document.getElementById('saveLrc').addEventListener('click', async () => {
  const content = serializeLrc();
  const def = state.lrcPath || 'lyrics.lrc';
  const saved = await window.api.saveLrc(content, def);
  if (saved) { state.lrcPath = saved; setStatus('저장됨: ' + saved); }
});

document.getElementById('newLrc').addEventListener('click', () => {
  if (state.lines.length > 0 &&
      !window.confirm('빈 LRC로 새로 시작할까요? 저장하지 않은 현재 가사는 사라집니다.')) return;
  startNewLrc();
});

document.getElementById('clearMp3').addEventListener('click', () => {
  if (!state.audioUrl) { setStatus('해제할 mp3가 없습니다'); return; }
  clearAudio();
});

document.getElementById('clearLrc').addEventListener('click', () => {
  if (state.lines.length === 0) { setStatus('해제할 가사가 없습니다'); return; }
  if (!window.confirm('현재 가사를 해제할까요? 저장하지 않은 변경은 사라집니다.')) return;
  clearLrc();
});

document.getElementById('loadSample').addEventListener('click', async () => {
  const res = await window.api.loadSample();
  if (!res) { setStatus('샘플을 찾을 수 없습니다'); return; }
  loadAudioFromBuffer(res.audio, res.audioName);
  state.lines = parseLrc(res.lrc);
  state.lrcPath = res.lrcPath;
  state.selected = 0;
  render();
  setStatus('샘플 로드됨: ' + res.audioName);
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
      setStatus('LRC 로드됨: ' + file.name);
    } else {
      await loadAudioFromPath(p, file.name);
    }
  }
});

render();
