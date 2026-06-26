'use strict';

const { app, BrowserWindow, ipcMain, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const id3 = require('./id3');
const mp3gain = require('./mp3gain');

let mainWindow = null;

// 런타임 아이콘 (Win/Linux 창 아이콘 · macOS dev 독 아이콘에 사용)
const ICON_PATH = path.join(__dirname, 'build', 'icon.png');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'LRC EDITOR',
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });

  // 스모크 테스트: SMOKE=1 이면 렌더러 콘솔/에러를 출력하고 자동 종료
  if (process.env.SMOKE) {
    mainWindow.webContents.on('console-message', (_e, level, msg) => {
      console.log('[renderer]', msg);
    });
    mainWindow.webContents.on('render-process-gone', (_e, d) => {
      console.error('[render-process-gone]', d.reason);
      process.exitCode = 1;
    });
    mainWindow.webContents.on('did-finish-load', async () => {
      try {
        // 렌더러에서 LRC/언어팩 공용 로직이 로드/동작하는지 검증
        const n = await mainWindow.webContents.executeJavaScript(`(() => {
          const lines = window.LRC.parseLrc('[00:00.00]a\\n[00:01.50]b');
          window.I18N.setLang('ko');
          const ko = window.I18N.t('btn.save');
          window.I18N.setLang('en');
          return { lines: lines.length, t: window.LRC.parseTimeStr('01:23.45'), langs: window.I18N.langs.length, ko };
        })()`);
        console.log('[smoke] parsedLines=' + n.lines + ' parseTimeStr=' + n.t + ' langs=' + n.langs + ' ko.save=' + n.ko);
        console.log('[smoke] OK');
      } catch (err) {
        console.error('[smoke] FAIL', err && err.message);
        process.exitCode = 1;
      } finally {
        setTimeout(() => app.quit(), 300);
      }
    });
  }
}

app.whenReady().then(() => {
  // macOS: 패키징 전 dev 실행에서도 독 아이콘이 보이도록 설정
  if (process.platform === 'darwin' && app.dock) {
    try { app.dock.setIcon(ICON_PATH); } catch { /* 아이콘 로드 실패는 무시 */ }
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC: 파일 입출력 ----

// mp3 열기 대화상자 → 경로 반환
ipcMain.handle('dialog:openMp3', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'MP3 열기',
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'm4a', 'wav', 'flac', 'ogg'] }],
  });
  if (canceled || filePaths.length === 0) return null;
  return { path: filePaths[0], name: path.basename(filePaths[0]) };
});

// lrc 열기 대화상자 → {path, content}
ipcMain.handle('dialog:openLrc', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'LRC 열기',
    properties: ['openFile'],
    filters: [{ name: 'LRC', extensions: ['lrc', 'txt'] }],
  });
  if (canceled || filePaths.length === 0) return null;
  const content = await fs.readFile(filePaths[0], 'utf8');
  return { path: filePaths[0], name: path.basename(filePaths[0]), content };
});

// 경로로 오디오 바이트 읽기 → renderer 에서 Blob URL 생성
ipcMain.handle('file:readAudio', async (_evt, filePath) => {
  const buf = await fs.readFile(filePath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
});

// 경로로 lrc 텍스트 읽기 (드래그앤드롭 등)
ipcMain.handle('file:readLrc', async (_evt, filePath) => {
  return fs.readFile(filePath, 'utf8');
});

// 무손실 게인: 모든 프레임 global_gain 을 steps(1.5dB 단위) 만큼 가감 후 저장
ipcMain.handle('file:applyGain', async (_evt, filePath, steps) => {
  try {
    const buf = await fs.readFile(filePath);
    const out = mp3gain.applyGainSteps(buf, Math.round(steps));
    await fs.writeFile(filePath, out);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// 이미지를 앨범 표지로 설정 (작은 기기용으로 ≤300px JPEG 변환 후 mp3에 삽입)
// c.sh 기준: 300x300 이내 축소, JPEG q80. 기존 제목/아티스트/앨범은 보존.
ipcMain.handle('file:setCover', async (_evt, filePath, imagePath) => {
  try {
    let img = nativeImage.createFromPath(imagePath);
    if (img.isEmpty()) return { ok: false, error: 'unsupported image' };
    const { width, height } = img.getSize();
    const MAX = 300;
    if (Math.max(width, height) > MAX) {
      const s = MAX / Math.max(width, height);
      img = img.resize({ width: Math.round(width * s), height: Math.round(height * s), quality: 'good' });
    }
    const jpeg = img.toJPEG(80);
    const buf = await fs.readFile(filePath);
    const old = id3.parse(buf);
    const audio = id3.strip(buf);
    const tag = id3.build({
      title: old.title, artist: old.artist, album: old.album,
      picture: { mime: 'image/jpeg', data: jpeg },
    });
    await fs.writeFile(filePath, Buffer.concat([tag, audio]));
    return { ok: true, pictureDataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`, bytes: jpeg.length };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// mp3 ID3 태그 제거. keepCover=true 면 앨범 표지(APIC)만 남기고 텍스트 태그 제거.
ipcMain.handle('file:clearTags', async (_evt, filePath, keepCover) => {
  try {
    const buf = await fs.readFile(filePath);
    const audio = id3.strip(buf);
    let out = audio;
    if (keepCover) {
      const old = id3.parse(buf);
      if (old.picture && old.picture.data && old.picture.data.length) {
        out = Buffer.concat([id3.build({ picture: { mime: old.picture.mime, data: old.picture.data } }), audio]);
      }
    }
    await fs.writeFile(filePath, out);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// mp3 ID3 태그 초기화: 표지(APIC)는 유지, 나머지 텍스트 태그는 비우고 제목을 파일명으로 채움.
ipcMain.handle('file:resetTags', async (_evt, filePath, title) => {
  try {
    const buf = await fs.readFile(filePath);
    const audio = id3.strip(buf);
    const old = id3.parse(buf);
    const meta = { title: title || '' };
    if (old.picture && old.picture.data && old.picture.data.length) {
      meta.picture = { mime: old.picture.mime, data: old.picture.data };
    }
    await fs.writeFile(filePath, Buffer.concat([id3.build(meta), audio]));
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
});

// mp3 ID3 태그 읽기 → {title, artist, album, pictureDataUrl}
ipcMain.handle('file:readTags', async (_evt, filePath) => {
  try {
    const buf = await fs.readFile(filePath);
    const tg = id3.parse(buf);
    const pictureDataUrl = tg.picture
      ? `data:${tg.picture.mime};base64,${tg.picture.data.toString('base64')}` : null;
    return { title: tg.title || null, artist: tg.artist || null, album: tg.album || null, pictureDataUrl };
  } catch {
    return { title: null, artist: null, album: null, pictureDataUrl: null };
  }
});

// lrc 저장 대화상자
ipcMain.handle('dialog:saveLrc', async (_evt, { content, defaultPath }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'LRC 저장',
    defaultPath: defaultPath || 'lyrics.lrc',
    filters: [{ name: 'LRC', extensions: ['lrc'] }],
  });
  if (canceled || !filePath) return null;
  await fs.writeFile(filePath, content, 'utf8');
  return filePath;
});
