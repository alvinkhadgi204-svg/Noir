const { app, BrowserWindow, nativeTheme } = require('electron');
const path = require('path');

nativeTheme.themeSource = 'dark';

const APP_URL = process.env.AURORA_VIBES_URL || 'https://ais-pre-j3xyu7jjrknrb77qfr3zsm-274530213594.asia-northeast1.run.app';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    title: 'Aurora Vibes',
    icon: path.join(__dirname, '..', 'public', 'pwa-512x512.png'),
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.AURORA_USE_LOCAL_DIST === '1') {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    win.loadURL(APP_URL);
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
