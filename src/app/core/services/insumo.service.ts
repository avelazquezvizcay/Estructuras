import { Injectable, signal, computed, inject } from '@angular/core';
import Decimal from 'decimal.js';
import { type InsumoRecord, type HistoricoPrecioInsumoRecord } from '../data/database';
import { ToastService } from './toast.service';
import { I18nService } from './i18n.service';
import { SqliteDatabaseService } from './sqlite-database.service';

export interface InsumoView {
  id: string;
  nombre: string;
  categoria: string;
  tipoMedida: 'peso' | 'volumen' | 'cantidad';
  unidadBase: string;
  presentacion: string;
  costoPresentacionUsd: Decimal;
  costoUnidadBaseUsd: Decimal;
  monedaRegistro: 'USD' | 'VES';
  proveedor: string;
  fecha: string;
  stockActual: number;
  stockMinimo: number;
  isLowStock: boolean;
}

@Injectable({ providedIn: 'root' })
export class InsumoService {
  private readonly _insumos = signal<InsumoView[]>([]);
  private readonly _loading = signal(false);

  readonly insumos = this._insumos.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly count = computed(() => this._insumos().length);
  readonly lowStockInsumos = computed(() => this._insumos().filter(i => i.isLowStock));


  readonly categorias = computed(() => {
    const cats = new Set(this._insumos().map(i => i.categoria));
    return ['Todas', ...Array.from(cats).sort()];
  });

  constructor(
    private toast: ToastService,
    private i18n: I18nService,
    private sqlite: SqliteDatabaseService
  ) {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this._loading.set(true);
    try {
      const records = await this.sqlite.all<InsumoRecord>('SELECT * FROM insumos ORDER BY nombre ASC');
      this._insumos.set(records.map(r => this.toView(r)));
    } catch (e) {
      console.error('Error loading insumos:', e);
    } finally {
      this._loading.set(false);
    }
  }

  async create(data: Omit<InsumoRecord, 'id' | 'costoUnidadBaseUsd'>): Promise<InsumoRecord> {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const costoUnidadBaseUsd = new Decimal(data.costoPresentacionUsd)
      .div(data.presentacionCantidad)
      .toString();

    const record: InsumoRecord = {
      ...data,
      id,
      costoUnidadBaseUsd,
      fechaActualizacionCosto: new Date().toISOString()
    };

    const sql = `
      INSERT INTO insumos (
        id, nombre, categoria, tipoMedida, unidadBase, 
        presentacionCantidad, presentacionUnidad, costoPresentacionUsd, 
        costoUnidadBaseUsd, monedaRegistro, proveedor, 
        fechaActualizacionCosto, stockActual, stockMinimo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
      record.id, record.nombre, record.categoria, record.tipoMedida, record.unidadBase,
      record.presentacionCantidad, record.presentacionUnidad, record.costoPresentacionUsd,
      record.costoUnidadBaseUsd, record.monedaRegistro, record.proveedor,
      record.fechaActualizacionCosto, record.stockActual, record.stockMinimo
    ];

    await this.sqlite.run(sql, params);
    this._insumos.update(list => [...list, this.toView(record)]);
    this.toast.success(`Insumo "${data.nombre}" creado exitosamente`);
    return record;
  }

  async update(id: string, data: Partial<InsumoRecord>): Promise<void> {
    const existing = await this.sqlite.get<InsumoRecord>('SELECT * FROM insumos WHERE id = ?', [id]);
    if (!existing) return;

    const updated = { ...existing, ...data };
    let priceChanged = false;
    
    if (data.costoPresentacionUsd || data.presentacionCantidad) {
      const cost = new Decimal(updated.costoPresentacionUsd);
      updated.costoUnidadBaseUsd = cost.div(updated.presentacionCantidad).toString();
      priceChanged = true;
    }
    updated.fechaActualizacionCosto = new Date().toISOString();

    const sql = `
      UPDATE insumos SET 
        nombre = ?, categoria = ?, tipoMedida = ?, unidadBase = ?, 
        presentacionCantidad = ?, presentacionUnidad = ?, costoPresentacionUsd = ?, 
        costoUnidadBaseUsd = ?, monedaRegistro = ?, proveedor = ?, 
        fechaActualizacionCosto = ?, stockActual = ?, stockMinimo = ?
      WHERE id = ?
    `;
    const params = [
      updated.nombre, updated.categoria, updated.tipoMedida, updated.unidadBase,
      updated.presentacionCantidad, updated.presentacionUnidad, updated.costoPresentacionUsd,
      updated.costoUnidadBaseUsd, updated.monedaRegistro, updated.proveedor,
      updated.fechaActualizacionCosto, updated.stockActual, updated.stockMinimo,
      id
    ];

    await this.sqlite.run(sql, params);

    if (priceChanged) {
      await this.sqlite.run(
        'INSERT INTO historico_precios (insumoId, costoUnidadBaseUsd, fecha) VALUES (?, ?, ?)',
        [id, updated.costoUnidadBaseUsd, updated.fechaActualizacionCosto]
      );
    }

    this._insumos.update(list =>
      list.map(i => i.id === id ? this.toView(updated) : i)
    );
    this.toast.success(`Insumo "${updated.nombre}" actualizado`);
  }

  async getPriceHistory(insumoId: string): Promise<HistoricoPrecioInsumoRecord[]> {
    return await this.sqlite.all<HistoricoPrecioInsumoRecord>(
      'SELECT * FROM historico_precios WHERE insumoId = ? ORDER BY fecha ASC', 
      [insumoId]
    );
  }

  async delete(id: string): Promise<void> {
    // Check referential integrity
    const res = await this.sqlite.get('SELECT COUNT(*) as count FROM items_receta WHERE insumoId = ?', [id]);
    const usedIn = res.count;
    if (usedIn > 0) {
      this.toast.error(`No se puede eliminar: el insumo está usado en ${usedIn} receta(s)`);
      return;
    }

    const insumo = this._insumos().find(i => i.id === id);
    await this.sqlite.run('DELETE FROM insumos WHERE id = ?', [id]);
    this._insumos.update(list => list.filter(i => i.id !== id));
    this.toast.warning(`Insumo "${insumo?.nombre}" eliminado`);
  }

  async updateStockAndPrice(id: string, cantidadEntrada: number, nuevoCostoUsd: Decimal): Promise<void> {
    const insumo = await this.sqlite.get<InsumoRecord>('SELECT * FROM insumos WHERE id = ?', [id]);
    if (!insumo) return;

    const nuevoStock = new Decimal(insumo.stockActual || 0).plus(cantidadEntrada).toNumber();
    const costoAnterior = new Decimal(insumo.costoUnidadBaseUsd);
    const fecha = new Date().toISOString();

    await this.sqlite.run(
      'UPDATE insumos SET stockActual = ?, costoUnidadBaseUsd = ?, fechaActualizacionCosto = ? WHERE id = ?',
      [nuevoStock, nuevoCostoUsd.toString(), fecha, id]
    );

    if (!costoAnterior.equals(nuevoCostoUsd)) {
      await this.sqlite.run(
        'INSERT INTO historico_precios (insumoId, costoUnidadBaseUsd, fecha) VALUES (?, ?, ?)',
        [id, nuevoCostoUsd.toString(), fecha]
      );
    }

    await this.loadAll();
  }

  async revertirStock(id: string, cantidadSalida: number): Promise<void> {
    const insumo = await this.sqlite.get<InsumoRecord>('SELECT * FROM insumos WHERE id = ?', [id]);
    if (!insumo) return;

    const nuevoStock = new Decimal(insumo.stockActual || 0).minus(cantidadSalida).toNumber();
    
    await this.sqlite.run('UPDATE insumos SET stockActual = ? WHERE id = ?', [nuevoStock, id]);
    await this.loadAll();
  }

  getById(id: string): InsumoView | undefined {
    return this._insumos().find(i => i.id === id);
  }

  private toView(r: InsumoRecord): InsumoView {
    return {
      id: r.id!,
      nombre: r.nombre,
      categoria: r.categoria,
      tipoMedida: r.tipoMedida,
      unidadBase: r.unidadBase,
      presentacion: `${r.presentacionCantidad} ${r.presentacionUnidad}`,
      costoPresentacionUsd: new Decimal(r.costoPresentacionUsd),
      costoUnidadBaseUsd: new Decimal(r.costoUnidadBaseUsd),
      monedaRegistro: r.monedaRegistro,
      proveedor: r.proveedor,
      fecha: r.fechaActualizacionCosto?.split('T')[0] || '',
      stockActual: r.stockActual || 0,
      stockMinimo: r.stockMinimo || 0,
      isLowStock: (r.stockActual || 0) <= (r.stockMinimo || 0)
    };
  }

  /** Seed demo data if DB is empty */
  async seedIfEmpty(): Promise<void> {
    const res = await this.sqlite.get('SELECT COUNT(*) as count FROM insumos');
    if (res.count > 0) return;

    const demoData: Omit<InsumoRecord, 'id' | 'costoUnidadBaseUsd'>[] = [
      { nombre: 'Harina de Trigo Robin Hood', categoria: 'Harinas', tipoMedida: 'peso', unidadBase: 'g', presentacionCantidad: 1000, presentacionUnidad: 'g', costoPresentacionUsd: '1.20', monedaRegistro: 'USD', proveedor: 'Distribuidora ABC', fechaActualizacionCosto: new Date().toISOString(), stockActual: 5000, stockMinimo: 2000 },
      { nombre: 'Azúcar Refinada', categoria: 'Endulzantes', tipoMedida: 'peso', unidadBase: 'g', presentacionCantidad: 1000, presentacionUnidad: 'g', costoPresentacionUsd: '0.80', monedaRegistro: 'USD', proveedor: 'Central Azucarera', fechaActualizacionCosto: new Date().toISOString(), stockActual: 3000, stockMinimo: 1000 },
      { nombre: 'Huevos de Gallina', categoria: 'Proteínas', tipoMedida: 'cantidad', unidadBase: 'unidad', presentacionCantidad: 30, presentacionUnidad: 'unid', costoPresentacionUsd: '7.50', monedaRegistro: 'USD', proveedor: 'Granja El Sol', fechaActualizacionCosto: new Date().toISOString(), stockActual: 60, stockMinimo: 30 },
      { nombre: 'Mantequilla Sin Sal', categoria: 'Grasas', tipoMedida: 'peso', unidadBase: 'g', presentacionCantidad: 500, presentacionUnidad: 'g', costoPresentacionUsd: '4.75', monedaRegistro: 'USD', proveedor: 'Lácteos Premium', fechaActualizacionCosto: new Date().toISOString(), stockActual: 200, stockMinimo: 500 },
      { nombre: 'Leche Entera', categoria: 'Lácteos', tipoMedida: 'volumen', unidadBase: 'ml', presentacionCantidad: 1000, presentacionUnidad: 'ml', costoPresentacionUsd: '1.80', monedaRegistro: 'USD', proveedor: 'Lácteos Premium', fechaActualizacionCosto: new Date().toISOString(), stockActual: 5000, stockMinimo: 2000 },
      { nombre: 'Cacao en Polvo', categoria: 'Saborizantes', tipoMedida: 'peso', unidadBase: 'g', presentacionCantidad: 250, presentacionUnidad: 'g', costoPresentacionUsd: '3.50', monedaRegistro: 'USD', proveedor: 'Importadora Gourmet', fechaActualizacionCosto: new Date().toISOString(), stockActual: 1000, stockMinimo: 500 },
      { nombre: 'Polvo para Hornear', categoria: 'Otros', tipoMedida: 'peso', unidadBase: 'g', presentacionCantidad: 200, presentacionUnidad: 'g', costoPresentacionUsd: '1.10', monedaRegistro: 'USD', proveedor: 'Distribuidora ABC', fechaActualizacionCosto: new Date().toISOString(), stockActual: 100, stockMinimo: 200 },
      { nombre: 'Vainilla Extracto', categoria: 'Saborizantes', tipoMedida: 'volumen', unidadBase: 'ml', presentacionCantidad: 120, presentacionUnidad: 'ml', costoPresentacionUsd: '2.90', monedaRegistro: 'USD', proveedor: 'Importadora Gourmet', fechaActualizacionCosto: new Date().toISOString(), stockActual: 500, stockMinimo: 100 },
      { nombre: 'Caja para Torta 24cm', categoria: 'Empaques', tipoMedida: 'cantidad', unidadBase: 'unidad', presentacionCantidad: 50, presentacionUnidad: 'unid', costoPresentacionUsd: '25.00', monedaRegistro: 'USD', proveedor: 'Cajas Express', fechaActualizacionCosto: new Date().toISOString(), stockActual: 100, stockMinimo: 20 },
      { nombre: 'Base de Cartón Oro', categoria: 'Empaques', tipoMedida: 'cantidad', unidadBase: 'unidad', presentacionCantidad: 100, presentacionUnidad: 'unid', costoPresentacionUsd: '15.00', monedaRegistro: 'USD', proveedor: 'Cajas Express', fechaActualizacionCosto: new Date().toISOString(), stockActual: 200, stockMinimo: 50 },
      { nombre: 'Velas Cumpleaños (Paquete)', categoria: 'Decoración', tipoMedida: 'cantidad', unidadBase: 'unidad', presentacionCantidad: 24, presentacionUnidad: 'unid', costoPresentacionUsd: '2.40', monedaRegistro: 'USD', proveedor: 'Party City', fechaActualizacionCosto: new Date().toISOString(), stockActual: 48, stockMinimo: 12 },
    ];

    for (const item of demoData) {
      await this.create(item);
    }
  }



  async registrarMerma(insumoId: string, cantidad: number, motivo: string, usuarioId: string): Promise<boolean> {
    const record = await this.sqlite.get<InsumoRecord>('SELECT * FROM insumos WHERE id = ?', [insumoId]);
    if (!record) {
      this.toast.error('Insumo no encontrado');
      return false;
    }

    if (cantidad <= 0 || cantidad > record.stockActual) {
      this.toast.error('Cantidad de merma inválida');
      return false;
    }

    const costoUnit = new Decimal(record.costoUnidadBaseUsd);
    const costoPerdido = costoUnit.mul(cantidad).toString();
    const newStock = record.stockActual - cantidad;
    const mermaId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    const fecha = new Date().toISOString();

    const statements = [
      {
        sql: 'UPDATE insumos SET stockActual = ? WHERE id = ?',
        params: [newStock, insumoId]
      },
      {
        sql: 'INSERT INTO mermas (id, insumoId, cantidad, unidad, motivo, costoPerdidoUsd, fecha, usuarioId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        params: [mermaId, insumoId, cantidad, record.unidadBase, motivo, costoPerdido, fecha, usuarioId]
      }
    ];

    try {
      await this.sqlite.transaction(statements);
      await this.loadAll();
      this.toast.success('Merma registrada y stock actualizado');
      return true;
    } catch (e) {
      console.error('Error al registrar merma', e);
      this.toast.error('Error al registrar la merma');
      return false;
    }
  }
}
