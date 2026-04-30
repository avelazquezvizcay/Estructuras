const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Database = require('better-sqlite3');

// --- DATABASE INITIALIZATION ---
const dbPath = path.join(app.getPath('userData'), 'sec_v4.db');
const db = new Database(dbPath);
console.log('--- DATABASE CONNECTED AT:', dbPath);

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS insumos (
    id TEXT PRIMARY KEY,
    nombre TEXT,
    categoria TEXT,
    tipoMedida TEXT,
    unidadBase TEXT,
    presentacionCantidad REAL,
    presentacionUnidad TEXT,
    costoPresentacionUsd TEXT,
    costoUnidadBaseUsd TEXT,
    monedaRegistro TEXT,
    proveedor TEXT,
    fechaActualizacionCosto TEXT,
    stockActual REAL,
    stockMinimo REAL
  );

  CREATE TABLE IF NOT EXISTS productos (
    id TEXT PRIMARY KEY,
    nombre TEXT,
    descripcion TEXT,
    categoria TEXT,
    rendimientoCantidad REAL,
    rendimientoUnidad TEXT,
    margenUtilidadPct TEXT,
    costoTotalUsd TEXT,
    precioVentaUsd TEXT,
    notas TEXT
  );

  CREATE TABLE IF NOT EXISTS items_receta (
    id TEXT PRIMARY KEY,
    productoFinalId TEXT,
    insumoId TEXT,
    cantidad TEXT,
    unidad TEXT,
    costoLineaUsd TEXT,
    FOREIGN KEY(productoFinalId) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY(insumoId) REFERENCES insumos(id)
  );

  CREATE TABLE IF NOT EXISTS tasas_cambio (
    id TEXT PRIMARY KEY,
    tipo TEXT,
    valor TEXT,
    fecha TEXT,
    esActiva INTEGER
  );

  CREATE TABLE IF NOT EXISTS compras (
    id TEXT PRIMARY KEY,
    proveedor TEXT,
    fecha TEXT,
    items TEXT,
    tasaUsd REAL,
    totalUsd TEXT,
    totalBes TEXT,
    metodoPago TEXT
  );

  CREATE TABLE IF NOT EXISTS presupuestos (
    id TEXT PRIMARY KEY,
    clienteNombre TEXT,
    contacto TEXT,
    fecha TEXT,
    items TEXT,
    config TEXT,
    totalUsd TEXT
  );

  CREATE TABLE IF NOT EXISTS historico_precios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insumoId TEXT,
    costoUnidadBaseUsd TEXT,
    fecha TEXT
  );

  CREATE TABLE IF NOT EXISTS tasa_historial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha TEXT,
    bcv REAL,
    binance REAL,
    euro REAL,
    source TEXT,
    manual INTEGER
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    nombre TEXT,
    role TEXT,
    passwordHash TEXT,
    createdAt TEXT
  );
`);

// --- IPC HANDLERS ---

ipcMain.handle('db-all', (event, sql, params = []) => {
  try {
    return db.prepare(sql).all(...params);
  } catch (err) {
    console.error('SQL Error (all):', err);
    throw err;
  }
});

ipcMain.handle('db-get', (event, sql, params = []) => {
  try {
    return db.prepare(sql).get(...params);
  } catch (err) {
    console.error('SQL Error (get):', err);
    throw err;
  }
});

ipcMain.handle('db-run', (event, sql, params = []) => {
  try {
    return db.prepare(sql).run(...params);
  } catch (err) {
    console.error('SQL Error (run):', err);
    throw err;
  }
});

ipcMain.handle('db-transaction', (event, statements) => {
  const transaction = db.transaction((stmts) => {
    for (const { sql, params } of stmts) {
      db.prepare(sql).run(...params);
    }
  });
  try {
    transaction(statements);
    return { success: true };
  } catch (err) {
    console.error('SQL Error (transaction):', err);
    throw err;
  }
});

let mainWindow;

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(1400, width),
    height: Math.min(900, height),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false 
    },
    icon: path.join(__dirname, '../src/favicon.ico')
  });

  // En desarrollo, cargamos desde el servidor local de Angular
  // En producción, cargamos el archivo index.html compilado
  const startUrl = isDev 
    ? 'http://localhost:4200' 
    : `file://${path.join(__dirname, '../dist/sec/browser/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Maximizar si es necesario
  // mainWindow.maximize();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Abrir DevTools en desarrollo
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
