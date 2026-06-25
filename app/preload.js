'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openMp3: () => ipcRenderer.invoke('dialog:openMp3'),
  openLrc: () => ipcRenderer.invoke('dialog:openLrc'),
  readAudio: (filePath) => ipcRenderer.invoke('file:readAudio', filePath),
  readLrc: (filePath) => ipcRenderer.invoke('file:readLrc', filePath),
  readTags: (filePath) => ipcRenderer.invoke('file:readTags', filePath),
  clearTags: (filePath) => ipcRenderer.invoke('file:clearTags', filePath),
  saveLrc: (content, defaultPath) => ipcRenderer.invoke('dialog:saveLrc', { content, defaultPath }),
  // 드래그앤드롭된 File 객체 → 실제 파일 경로 (Electron 32: file.path 제거됨)
  pathForFile: (file) => webUtils.getPathForFile(file),
});
