const express = require('express');
const cors = require('cors');
const sqlite = require('better-sqlite3');
const path = require('path');
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
console.log('Connected to SQLite database at:', dbPath);

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
    console.error('SQL Error (all):', err);
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

let serverInstance = null;

function startServer() {
  if (!serverInstance) {
    serverInstance = app.listen(port, '0.0.0.0', () => {
      console.log(`SEC Embedded Backend running on port ${port}`);
    });
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
