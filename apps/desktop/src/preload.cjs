/**
 * Electron preload script — runs in renderer process with contextIsolation.
 * Exposes a minimal API to the renderer via contextBridge.
 *
 * For v0, this is intentionally minimal. Future versions may expose
 * file system access, worker thread management, or IPC channels.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
