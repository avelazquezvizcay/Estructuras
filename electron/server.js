const express = require('express');
const cors = require('cors');
const sqlite = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Log errors to a file for debugging in production
const logPath = path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share'), 'sec-server-log.txt');
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logPath, line);
  console.log(msg);
}

log('Server module loading...');
let electronApp;
try {
  const electron = require('electron');
  electronApp = electron.app;
} catch (e) {
  // Not running in Electron
  electronApp = null;
}

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// In production, the DB should be saved in the user's appData folder so it persists across updates
// Check if running inside Electron or standalone Node
const isDev = electronApp && electronApp.isPackaged !== undefined 
  ? !electronApp.isPackaged 
  : true;

const dbPath = !isDev && electronApp && electronApp.getPath
  ? path.join(electronApp.getPath('userData'), 'database.sqlite')
  : path.join(__dirname, '..', 'database.sqlite');

const db = new sqlite(dbPath);
log('Connected to SQLite database at: ' + dbPath);

// Initialize schema
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
    stockActual REAL DEFAULT 0,
    stockMinimo REAL DEFAULT 0
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

  CREATE TABLE IF NOT EXISTS mermas (
    id TEXT PRIMARY KEY,
    insumoId TEXT,
    cantidad REAL,
    unidad TEXT,
    motivo TEXT,
    costoPerdidoUsd TEXT,
    fecha TEXT,
    usuarioId TEXT,
    FOREIGN KEY(insumoId) REFERENCES insumos(id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    nombre TEXT,
    role TEXT,
    passwordHash TEXT,
    createdAt TEXT
  );
`);

// API endpoints
app.post('/api/db/all', (req, res) => {
  try {
    const { sql, params = [] } = req.body;
    const result = db.prepare(sql).all(...params);
    res.json(result);
  } catch (err) {
    log('SQL Error (all): ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/get', (req, res) => {
  try {
    const { sql, params = [] } = req.body;
    const result = db.prepare(sql).get(...params);
    res.json(result || null);
  } catch (err) {
    console.error('SQL Error (get):', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/run', (req, res) => {
  try {
    const { sql, params = [] } = req.body;
    const result = db.prepare(sql).run(...params);
    res.json({ lastInsertRowid: result.lastInsertRowid.toString(), changes: result.changes });
  } catch (err) {
    console.error('SQL Error (run):', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/transaction', (req, res) => {
  try {
    const { statements } = req.body;
    if (!statements || !Array.isArray(statements)) {
      return res.status(400).json({ error: 'statements array is required' });
    }
    const runTx = db.transaction((stmts) => {
      for (const stmt of stmts) {
        db.prepare(stmt.sql).run(...(stmt.params || []));
      }
    });
    runTx(statements);
    res.json({ success: true });
  } catch (err) {
    console.error('SQL Error (transaction):', err);
    res.status(500).json({ error: err.message, success: false });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SEC Embedded API Server is running' });
});

// ═══════════════════════════════════════════════
// ═══ Backup System (ZIP, Scheduled, Restore) ═══
// ═══════════════════════════════════════════════
const { execSync } = require('child_process');
const archiver = require('archiver');

const backupDir = path.join(path.dirname(dbPath), 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Scheduled backup state
let backupInterval = null;
const backupSettingsPath = path.join(path.dirname(dbPath), 'backup-settings.json');

function loadBackupSettings() {
  try {
    if (fs.existsSync(backupSettingsPath)) {
      return JSON.parse(fs.readFileSync(backupSettingsPath, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return { enabled: false, intervalHours: 24, maxBackups: 10 };
}

function saveBackupSettings(settings) {
  fs.writeFileSync(backupSettingsPath, JSON.stringify(settings, null, 2));
}

function createBackupFile() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipName = `sec-backup-${timestamp}.zip`;
  const zipPath = path.join(backupDir, zipName);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      log(`Backup created: ${zipName} (${archive.pointer()} bytes)`);
      resolve({ name: zipName, path: zipPath, size: archive.pointer(), date: new Date().toISOString() });
    });

    archive.on('error', (err) => reject(err));
    archive.pipe(output);

    // Backup the database file
    if (fs.existsSync(dbPath)) {
      archive.file(dbPath, { name: 'database.sqlite' });
    }

    // Also backup settings from localStorage (exported as JSON from the frontend)
    const settingsExport = {
      backupDate: new Date().toISOString(),
      appVersion: require('../package.json').version || '1.0.0'
    };
    archive.append(JSON.stringify(settingsExport, null, 2), { name: 'backup-metadata.json' });

    archive.finalize();
  });
}

function enforceMaxBackups(maxBackups) {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('sec-backup-') && f.endsWith('.zip'))
      .sort()
      .reverse();

    if (files.length > maxBackups) {
      const toDelete = files.slice(maxBackups);
      toDelete.forEach(f => {
        fs.unlinkSync(path.join(backupDir, f));
        log(`Old backup removed: ${f}`);
      });
    }
  } catch (e) {
    log('Error cleaning old backups: ' + e.message);
  }
}

function startScheduledBackup(intervalHours, maxBackups) {
  stopScheduledBackup();
  const ms = intervalHours * 60 * 60 * 1000;
  log(`Scheduled backup every ${intervalHours} hour(s)`);
  backupInterval = setInterval(async () => {
    try {
      await createBackupFile();
      enforceMaxBackups(maxBackups);
      log('Scheduled backup completed successfully.');
    } catch (e) {
      log('Scheduled backup failed: ' + e.message);
    }
  }, ms);
}

function stopScheduledBackup() {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}

// Initialize scheduled backup on server start
const initialSettings = loadBackupSettings();
if (initialSettings.enabled) {
  startScheduledBackup(initialSettings.intervalHours, initialSettings.maxBackups);
}

// ── Backup API Endpoints ──

// Create a backup now
app.post('/api/backup/create', async (req, res) => {
  try {
    const result = await createBackupFile();
    const settings = loadBackupSettings();
    enforceMaxBackups(settings.maxBackups || 10);
    res.json({ success: true, backup: result });
  } catch (err) {
    log('Backup error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// List all backups
app.get('/api/backup/list', (req, res) => {
  try {
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('sec-backup-') && f.endsWith('.zip'))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stats.size, date: stats.mtime.toISOString() };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    res.json({ backups: files, directory: backupDir });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Download a specific backup
app.get('/api/backup/download/:filename', (req, res) => {
  const filePath = path.join(backupDir, req.params.filename);
  if (fs.existsSync(filePath) && req.params.filename.endsWith('.zip')) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'Backup not found' });
  }
});

// Delete a specific backup
app.delete('/api/backup/:filename', (req, res) => {
  const filePath = path.join(backupDir, req.params.filename);
  if (fs.existsSync(filePath) && req.params.filename.startsWith('sec-backup-')) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Backup not found' });
  }
});

// Get/Set schedule settings
app.get('/api/backup/schedule', (req, res) => {
  res.json(loadBackupSettings());
});

app.post('/api/backup/schedule', (req, res) => {
  const { enabled, intervalHours = 24, maxBackups = 10 } = req.body;
  const settings = { enabled: !!enabled, intervalHours, maxBackups };
  saveBackupSettings(settings);

  if (settings.enabled) {
    startScheduledBackup(settings.intervalHours, settings.maxBackups);
  } else {
    stopScheduledBackup();
  }

  res.json({ success: true, settings });
});

// Restore from a backup file
app.post('/api/backup/restore/:filename', (req, res) => {
  const filePath = path.join(backupDir, req.params.filename);
  if (!fs.existsSync(filePath) || !req.params.filename.endsWith('.zip')) {
    return res.status(404).json({ error: 'Backup not found' });
  }

  try {
    // Close the current database connection
    db.close();

    // Extract the ZIP and replace the database
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(filePath);
    const dbEntry = zip.getEntry('database.sqlite');
    if (!dbEntry) {
      return res.status(400).json({ error: 'No database found in backup' });
    }
    fs.writeFileSync(dbPath, dbEntry.getData());
    log('Database restored from: ' + req.params.filename);
    res.json({ success: true, message: 'Database restored. Please restart the application.' });
  } catch (err) {
    log('Restore error: ' + err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════

let serverInstance = null;

function startServer() {
  if (!serverInstance) {
    serverInstance = app.listen(port, '0.0.0.0', () => {
      log(`SEC Embedded Backend running on port ${port}`);
    });
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
