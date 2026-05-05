import { Injectable, signal, computed, inject } from '@angular/core';
import Decimal from 'decimal.js';
import { TasaCambio, TipoTasa } from '../models/domain.models';
import { ToastService } from './toast.service';
import { NotificationService } from './notification.service';
import { SqliteDatabaseService } from './sqlite-database.service';
import { type TasaHistorialRecord, type InsumoRecord, type ProductoRecord, type ItemRecetaRecord, type TasaCambioRecord } from '../data/database';

export interface TasaHistorialView {
  id: number;
  fecha: Date;
  bcv: number;
  binance: number;
  euro: number;
  source: string;
  manual: boolean;
}

@Injectable({ providedIn: 'root' })
export class TasaCambioService {
  private readonly toast = inject(ToastService);
  private readonly notifService = inject(NotificationService);
  private readonly sqlite = inject(SqliteDatabaseService);

  // En Electron (file://) no hay proxy de Angular, usamos URLs directas
  private readonly isElectron = window.location.protocol === 'file:';
  private urlBcv = this.isElectron ? 'https://www.bcv.org.ve/' : '/api/bcv/';
  private urlDolar = this.isElectron ? 'https://ve.dolarapi.com/v1/dolares' : '/api/dolar';
  private urlEuro = this.isElectron ? 'https://ve.dolarapi.com/v1/euros' : '/api/euro';

  private readonly _tasas = signal<TasaCambio[]>([]);
  private readonly _tasaPreferida = signal<TipoTasa>('BCV_USD');
  private readonly _loading = signal(false);
  private readonly _lastUpdate = signal<Date | null>(null);
  private readonly _source = signal<string>('none');
  private readonly _error = signal<string | null>(null);
  private readonly _historial = signal<TasaHistorialView[]>([]);

  private lastFetchTime = 0;
  private readonly DEBOUNCE_MS = 300_000; // 5 min

  readonly tasas = this._tasas.asReadonly();
  readonly tasaPreferida = this._tasaPreferida.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly lastUpdate = this._lastUpdate.asReadonly();
  readonly source = this._source.asReadonly();
  readonly error = this._error.asReadonly();
  readonly historial = this._historial.asReadonly();

  readonly tasaActiva = computed(() => {
    const tipo = this._tasaPreferida();
    return this._tasas().find(t => t.tipo === tipo && t.esActiva) ?? null;
  });

  readonly tasaBcv = computed(() =>
    this._tasas().find(t => t.tipo === 'BCV_USD' && t.esActiva) ?? null
  );

  readonly tasaBinance = computed(() =>
    this._tasas().find(t => t.tipo === 'BINANCE_USDT' && t.esActiva) ?? null
  );

  readonly tasaEuro = computed(() =>
    this._tasas().find(t => t.tipo === 'BCV_EUR' && t.esActiva) ?? null
  );

  constructor() {
    this.loadFromCache();
    this.loadHistorial();
    this.fetchRates();
    this.startAutoRefresh();
  }

  // ─── Auto-refresh ───────────────────────────────────────────
  private startAutoRefresh(): void {
    setInterval(() => {
      const minutesSinceLast = (Date.now() - this.lastFetchTime) / 60_000;
      if (minutesSinceLast >= 15) {
        this.fetchRates();
      }
    }, 60_000);
  }

  // ─── FETCH PRINCIPAL (Multi-source cascade) ─────────────────
  async fetchRates(force = false): Promise<void> {
    const now = Date.now();
    if (!force && now - this.lastFetchTime < this.DEBOUNCE_MS) return;

    this._loading.set(true);
    this._error.set(null);

    try {
      // Prioridad 1: Scraping BCV Oficial (igual que VenePrice)
      await this.fetchBcvScraping();
      this.lastFetchTime = Date.now();
    } catch (e1) {
      console.warn('BCV Scraping falló, intentando DolarAPI...', e1);
      try {
        // Prioridad 2: DolarAPI (datos oficiales agregados)
        await this.fetchFromDolarApi();
        this.lastFetchTime = Date.now();
      } catch (e2) {
        console.warn('Todos los sources fallaron. Usando caché.', e2);
        this._error.set('Sin conexión. Usando datos en caché.');
        this._source.set('cache');
        if (this._tasas().length === 0) {
          this.loadFallbackRates();
        }
      }
    } finally {
      this._loading.set(false);
    }
  }

  // ─── Fuente 1: BCV Scraping Oficial (Prioridad) ─────────────
  private async fetchBcvScraping(): Promise<void> {
    const res = await fetch(this.urlBcv, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
    });
    if (!res.ok) throw new Error(`BCV fetch error: ${res.status}`);
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const rawUsd = doc.querySelector('#dolar strong')?.textContent ?? '0';
    const bcv = parseFloat(rawUsd.replace(',', '.').trim());

    const rawEur = doc.querySelector('#euro strong')?.textContent ?? '0';
    const euro = parseFloat(rawEur.replace(',', '.').trim());

    if (!bcv || isNaN(bcv)) throw new Error('BCV parse failed');

    // For Binance/paralelo, try DolarAPI as complement
    let binance = bcv * 1.03; // Default estimate
    try {
      const dolarRes = await fetch(this.urlDolar);
      if (dolarRes.ok) {
        const usdData = await dolarRes.json();
        const paraleloEntry = usdData.find((f: any) => f.fuente === 'paralelo' || f.entidad === 'Paralelo');
        if (paraleloEntry?.promedio) {
          binance = paraleloEntry.promedio;
        }
      }
    } catch {}

    this.commitRates(bcv, binance, euro || 0, 'bcv');
  }

  // ─── Fuente 2: DolarAPI (datos oficiales agregados) ─────────
  private async fetchFromDolarApi(): Promise<void> {
    const [usdRes, eurRes] = await Promise.all([
      fetch(this.urlDolar),
      fetch(this.urlEuro)
    ]);

    if (!usdRes.ok || !eurRes.ok) throw new Error('DolarAPI error');

    const usdData = await usdRes.json();
    const eurData = await eurRes.json();

    const bcvEntry = usdData.find((f: any) => f.fuente === 'oficial' || f.entidad === 'BCV');
    const paraleloEntry = usdData.find((f: any) => f.fuente === 'paralelo' || f.entidad === 'Paralelo');
    const euroEntry = eurData.find((f: any) => f.fuente === 'oficial' || f.entidad === 'BCV');

    const bcv = bcvEntry?.promedio || 0;
    const binance = paraleloEntry?.promedio || bcv * 1.05;
    const euro = euroEntry?.promedio || 0;

    if (!bcv) throw new Error('DolarAPI: BCV parse failed');

    this.commitRates(bcv, binance, euro, 'dolarapi');
  }

  // ─── Manual rate entry (offline mode) ───────────────────────
  async setManualRate(bcv: number, binance: number, euro: number): Promise<void> {
    this.commitRates(bcv, binance, euro, 'manual', true);
    this.toast.success('Tasa manual guardada correctamente');
    this.notifService.add(
      'Tasa Manual',
      `BCV: ${bcv.toFixed(2)} | Binance: ${binance.toFixed(2)} | EUR: ${euro.toFixed(2)}`,
      'rate_change'
    );
  }

  // ─── Commit rates to state + Dexie ──────────────────────────
  private commitRates(bcv: number, binance: number, euro: number, source: string, manual = false): void {
    const now = new Date().toISOString();

    // Detect BCV changes and notify
    const prevBcv = this.tasaBcv();
    if (prevBcv && !prevBcv.valor.eq(bcv) && bcv > 0 && !manual) {
      const diff = bcv - prevBcv.valor.toNumber();
      const direction = diff > 0 ? '📈' : '📉';
      this.toast.info(`Tasa BCV actualizada: ${bcv.toFixed(2)} Bs/$`);
      this.notifService.add(
        `${direction} Tasa BCV Actualizada`,
        `Nueva: ${bcv.toFixed(2)} Bs/$ (Anterior: ${prevBcv.valor.toFixed(2)})`,
        'rate_change'
      );
    }

    const newTasas: TasaCambio[] = [
      { id: '1', tipo: 'BCV_USD', valor: new Decimal(bcv), fecha: now, esActiva: true },
      { id: '2', tipo: 'BINANCE_USDT', valor: new Decimal(binance), fecha: now, esActiva: true },
      { id: '3', tipo: 'BCV_EUR', valor: new Decimal(euro || 0), fecha: now, esActiva: euro > 0 }
    ];

    this._tasas.set(newTasas);
    this._lastUpdate.set(new Date());
    this._source.set(source);
    this.saveToCache(newTasas, source);

    // Persist to Dexie historial
    this.appendHistorial(bcv, binance, euro, source, manual);
  }

  // ─── Historial persistence (SQLite) ──────────────────────────
  private async appendHistorial(bcv: number, binance: number, euro: number, source: string, manual: boolean): Promise<void> {
    try {
      const fecha = new Date().toISOString();
      await this.sqlite.run(
        'INSERT INTO tasa_historial (fecha, bcv, binance, euro, source, manual) VALUES (?, ?, ?, ?, ?, ?)',
        [fecha, bcv, binance, euro, source, manual ? 1 : 0]
      );

      // Keep max 200 records
      const res = await this.sqlite.get<{count: number}>('SELECT COUNT(*) as count FROM tasa_historial');
      if (res && res.count > 200) {
        const diff = res.count - 200;
        await this.sqlite.run(`DELETE FROM tasa_historial WHERE id IN (SELECT id FROM tasa_historial ORDER BY id ASC LIMIT ?)`, [diff]);
      }

      await this.loadHistorial();
    } catch (e) {
      console.warn('Error guardando historial:', e);
    }
  }

  async loadHistorial(): Promise<void> {
    try {
      const records = await this.sqlite.all<TasaHistorialRecord>(
        'SELECT * FROM tasa_historial ORDER BY id DESC LIMIT 100'
      );
      this._historial.set(records.map(r => ({
        id: r.id!,
        fecha: new Date(r.fecha),
        bcv: r.bcv,
        binance: r.binance,
        euro: r.euro,
        source: r.source,
        manual: !!r.manual
      })));
    } catch {}
  }

  async deleteHistorialEntry(id: number): Promise<void> {
    await this.sqlite.run('DELETE FROM tasa_historial WHERE id = ?', [id]);
    await this.loadHistorial();
  }

  async clearHistorial(): Promise<void> {
    await this.sqlite.run('DELETE FROM tasa_historial');
    this._historial.set([]);
  }

  // ─── Fallback rates ─────────────────────────────────────────
  private loadFallbackRates(): void {
    const now = new Date().toISOString();
    this._tasas.set([
      { id: '1', tipo: 'BCV_USD', valor: new Decimal('86.89'), fecha: now, esActiva: true },
      { id: '2', tipo: 'BINANCE_USDT', valor: new Decimal('89.50'), fecha: now, esActiva: true },
      { id: '3', tipo: 'BCV_EUR', valor: new Decimal('97.25'), fecha: now, esActiva: true }
    ]);
    this._source.set('fallback');
  }

  // ─── Cache persistence ──────────────────────────────────────
  private saveToCache(tasas: TasaCambio[], source: string): void {
    try {
      const data = tasas.map(t => ({ ...t, valor: t.valor.toString() }));
      localStorage.setItem('sec_tasas', JSON.stringify({ data, source, timestamp: Date.now() }));
    } catch {}
  }

  private loadFromCache(): void {
    try {
      const raw = localStorage.getItem('sec_tasas');
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (!cached.data?.length) return;

      this._tasas.set(cached.data.map((t: any) => ({
        ...t,
        valor: new Decimal(t.valor)
      })));
      this._source.set('cache');
      this._lastUpdate.set(cached.timestamp ? new Date(cached.timestamp) : null);
    } catch {}

    try {
      const pref = localStorage.getItem('sec_tasa_preferida');
      if (pref) this._tasaPreferida.set(pref as TipoTasa);
    } catch {}
  }

  // ─── Public methods ─────────────────────────────────────────
  setTasaPreferida(tipo: TipoTasa): void {
    this._tasaPreferida.set(tipo);
    try { localStorage.setItem('sec_tasa_preferida', tipo); } catch {}
  }

  convertirABs(usd: Decimal): Decimal | null {
    const tasa = this.tasaActiva();
    return tasa ? usd.mul(tasa.valor) : null;
  }

  getTasaLabel(tipo: TipoTasa): string {
    const labels: Record<TipoTasa, string> = {
      'BCV_USD': 'BCV',
      'BINANCE_USDT': 'Binance',
      'BCV_EUR': 'Euro BCV'
    };
    return labels[tipo];
  }

  // ─── Export all data for cloud backup ───────────────────────
  async exportAllData(): Promise<object> {
    const [insumos, productos, recetas, tasas, historial] = await Promise.all([
      this.sqlite.all('SELECT * FROM insumos'),
      this.sqlite.all('SELECT * FROM productos'),
      this.sqlite.all('SELECT * FROM items_receta'),
      this.sqlite.all('SELECT * FROM tasas_cambio'),
      this.sqlite.all('SELECT * FROM tasa_historial')
    ]);
    return {
      version: 2,
      exportDate: new Date().toISOString(),
      data: { insumos, productos, recetas, tasas, historial }
    };
  }

  async importData(backup: any): Promise<void> {
    if (!backup?.data) throw new Error('Formato de backup inválido');
    const { insumos, productos, recetas, tasas, historial } = backup.data;

    const statements: { sql: string; params: any[] }[] = [
      { sql: 'DELETE FROM items_receta', params: [] },
      { sql: 'DELETE FROM productos', params: [] },
      { sql: 'DELETE FROM insumos', params: [] },
      { sql: 'DELETE FROM tasas_cambio', params: [] },
      { sql: 'DELETE FROM tasa_historial', params: [] }
    ];

    if (insumos?.length) {
      for (const i of insumos) {
        statements.push({
          sql: 'INSERT INTO insumos (id, nombre, categoria, tipoMedida, unidadBase, presentacionCantidad, presentacionUnidad, costoPresentacionUsd, costoUnidadBaseUsd, monedaRegistro, proveedor, fechaActualizacionCosto, stockActual, stockMinimo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          params: [i.id, i.nombre, i.categoria, i.tipoMedida, i.unidadBase, i.presentacionCantidad, i.presentacionUnidad, i.costoPresentacionUsd, i.costoUnidadBaseUsd, i.monedaRegistro, i.proveedor, i.fechaActualizacionCosto, i.stockActual, i.stockMinimo]
        });
      }
    }

    if (productos?.length) {
      for (const p of productos) {
        statements.push({
          sql: 'INSERT INTO productos (id, nombre, descripcion, categoria, rendimientoCantidad, rendimientoUnidad, margenUtilidadPct, costoTotalUsd, precioVentaUsd, notas) VALUES (?,?,?,?,?,?,?,?,?,?)',
          params: [p.id, p.nombre, p.descripcion, p.categoria, p.rendimientoCantidad, p.rendimientoUnidad, p.margenUtilidadPct, p.costoTotalUsd, p.precioVentaUsd, p.notas]
        });
      }
    }

    if (recetas?.length) {
      for (const r of recetas) {
        statements.push({
          sql: 'INSERT INTO items_receta (id, productoFinalId, insumoId, cantidad, unidad, costoLineaUsd) VALUES (?,?,?,?,?,?)',
          params: [r.id, r.productoFinalId, r.insumoId, r.cantidad, r.unidad, r.costoLineaUsd]
        });
      }
    }

    await this.sqlite.transaction(statements);

    this.loadFromCache();
    await this.loadHistorial();
    this.toast.success('Datos importados correctamente');
  }
}
