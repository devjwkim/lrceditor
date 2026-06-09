'use strict';

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'LRC EDITOR',
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
        // 샘플 로드 IPC + LRC 파싱이 렌더러에서 동작하는지 검증
        const n = await mainWindow.webContents.executeJavaScript(`(async () => {
          const r = await window.api.loadSample();
          const lines = window.LRC.parseLrc(r.lrc);
          return { audioBytes: r.audio.byteLength, lines: lines.length };
        })()`);
        console.log('[smoke] sample audioBytes=' + n.audioBytes + ' parsedLines=' + n.lines);
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

// 동봉된 샘플(../sample) 로드 → {audio, audioName, lrc, lrcPath}
ipcMain.handle('sample:load', async () => {
  const dir = path.join(__dirname, '..', 'sample');
  const mp3 = path.join(dir, 'cherry.mp3');
  const lrc = path.join(dir, 'cherry.lrc');
  try {
    const buf = await fs.readFile(mp3);
    const lrcText = await fs.readFile(lrc, 'utf8');
    return {
      audio: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      audioName: 'cherry.mp3',
      lrc: lrcText,
      lrcPath: lrc,
    };
  } catch {
    return null;
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
