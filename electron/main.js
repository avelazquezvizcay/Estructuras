const { app, BrowserWindow, Tray, Menu, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const isDev = !app.isPackaged;
const { startServer } = require('./server');

let mainWindow;
let tray = null;
let isQuitting = false;

// ═══ Auto-Updater Configuration ═══
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
  if (isDev) return; // Skip in development

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] App is up to date.');
  });

  autoUpdater.on('download-progress', (progress) => {
    const msg = `Downloading update: ${Math.round(progress.percent)}%`;
    console.log('[Updater]', msg);
    if (mainWindow) {
      mainWindow.setProgressBar(progress.percent / 100);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version);
    if (mainWindow) {
      mainWindow.setProgressBar(-1); // Remove progress bar
    }

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Actualización disponible',
      message: `SEC v${info.version} está lista para instalar.`,
      detail: 'La actualización se instalará al reiniciar la aplicación. ¿Deseas reiniciar ahora?',
      buttons: ['Reiniciar ahora', 'Más tarde'],
      defaultId: 0
    }).then((result) => {
      if (result.response === 0) {
        isQuitting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message);
  });

  // Check for updates after a short delay
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch(err => {
      console.error('[Updater] Check failed:', err.message);
    });
  }, 5000);
}

function createWindow() {
  const { width, height } = require('electron').screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false 
    },
    icon: path.join(__dirname, '../public/sec_icon.png')
  });

  const startUrl = isDev 
    ? 'http://localhost:4200' 
    : `file://${path.join(__dirname, '../dist/sec/browser/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', function (event) {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/sec_icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Abrir SEC', 
      click: () => {
        mainWindow.show();
      } 
    },
    { type: 'separator' },
    {
      label: 'Buscar actualizaciones',
      click: () => {
        if (!isDev) {
          autoUpdater.checkForUpdatesAndNotify();
        }
      }
    },
    { type: 'separator' },
    { 
      label: 'Salir', 
      click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('SEC - Estructura de Costos');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow.show();
  });
}

app.on('ready', () => {
  // Start the embedded backend server
  startServer();
  createWindow();
  createTray();
  setupAutoUpdater();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    // We don't quit here because we want to stay in background (tray)
    // app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
