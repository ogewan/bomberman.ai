/**
 * Electron main process — creates the application window.
 *
 * In development: loads the Vite dev server at http://localhost:3000
 * In production: loads the built web app from ../web/dist/index.html
 *
 * Uses CommonJS (.cjs) because Electron's main process does not support
 * ESM entry points in all versions.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

const DEV_URL = 'http://localhost:3000';
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: 'Bomberman 65',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Remove default menu bar for cleaner app look
  win.setMenuBarVisibility(false);

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', '..', 'web', 'dist', 'index.html');
    win.loadFile(indexPath);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
