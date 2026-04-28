import { Injectable, signal, computed } from '@angular/core';
import Decimal from 'decimal.js';
import { db, type InsumoRecord } from '../data/database';
import { ToastService } from './toast.service';
import { I18nService } from './i18n.service';

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
}

@Injectable({ providedIn: 'root' })
export class InsumoService {
  private readonly _insumos = signal<InsumoView[]>([]);
  private readonly _loading = signal(false);

  readonly insumos = this._insumos.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly count = computed(() => this._insumos().length);

  readonly categorias = computed(() => {
    const cats = new Set(this._insumos().map(i => i.categoria));
    return ['Todas', ...Array.from(cats).sort()];
  });

  constructor(
    private toast: ToastService,
    private i18n: I18nService
  ) {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this._loading.set(true);
    try {
      const records = await db.insumos.toArray();
      this._insumos.set(records.map(r => this.toView(r)));
    } catch (e) {
      console.error('Error loading insumos:', e);
    } finally {
      this._loading.set(false);
    }
  }

  async create(data: Omit<InsumoRecord, 'id' | 'costoUnidadBaseUsd'>): Promise<void> {
    const id = crypto.randomUUID();
    const costoUnidadBaseUsd = new Decimal(data.costoPresentacionUsd)
      .div(data.presentacionCantidad)
      .toString();

    const record: InsumoRecord = {
      ...data,
      id,
      costoUnidadBaseUsd,
      fechaActualizacionCosto: new Date().toISOString()
    };

    await db.insumos.put(record);
    this._insumos.update(list => [...list, this.toView(record)]);
    this.toast.success(`Insumo "${data.nombre}" creado exitosamente`);
  }

  async update(id: string, data: Partial<InsumoRecord>): Promise<void> {
    const existing = await db.insumos.get(id);
    if (!existing) return;

    const updated = { ...existing, ...data };
    if (data.costoPresentacionUsd || data.presentacionCantidad) {
      const cost = new Decimal(updated.costoPresentacionUsd);
      updated.costoUnidadBaseUsd = cost.div(updated.presentacionCantidad).toString();
    }
    updated.fechaActualizacionCosto = new Date().toISOString();

    await db.insumos.put(updated);
    this._insumos.update(list =>
      list.map(i => i.id === id ? this.toView(updated) : i)
    );
    this.toast.success(`Insumo "${updated.nombre}" actualizado`);
  }

  async delete(id: string): Promise<void> {
    // Check referential integrity
    const usedIn = await db.itemsReceta.where('insumoId').equals(id).count();
    if (usedIn > 0) {
      this.toast.error(`No se puede eliminar: el insumo está usado en ${usedIn} receta(s)`);
      return;
    }

    const insumo = this._insumos().find(i => i.id === id);
    await db.insumos.delete(id);
    this._insumos.update(list => list.filter(i => i.id !== id));
    this.toast.warning(`Insumo "${insumo?.nombre}" eliminado`);
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
      fecha: r.fechaActualizacionCosto?.split('T')[0] || ''
    };
  }

  /** Seed demo data if DB is empty */
  async seedIfEmpty(): Promise<void> {
    const count = await db.insumos.count();
    if (count > 0) return;

    const demoData: Omit<InsumoRecord, 'id' | 'costoUnidadBaseUsd'>[] = [
      { nombre: 'Harina de Trigo Robin Hood', categoria: 'Harinas', tipoMedida: 'peso', unidadBase: 'g', presentacionCantidad: 1000, presentacionUnidad: 'g', costoPresentacionUsd: '1.20', monedaRegistro: 'USD', proveedor: 'Distribuidora ABC', fechaActualizacionCosto: new Date().toISOString() },
      { nombre: 'Azúcar Refinada', categoria: 'Endulzantes', tipoMedida: 'peso', unidadBase: 'g', presentacionCantidad: 1000, presentacionUnidad: 'g', costoPresentacionUsd: '0.80', monedaRegistro: 'USD', proveedor: 'Central Azucarera', fechaActualizacionCosto: new Date().toISOString() },
      { nombre: 'Huevos de Gallina', categoria: 'Proteínas', tipoMedida: 'cantidad', unidadBase: 'unidad', presentacionCantidad: 30, presentacionUnidad: 'unid', costoPresentacionUsd: '7.50', monedaRegistro: 'USD', proveedor: 'Granja El Sol', fechaActualizacionCosto: new Date().toISOString() },
      { nombre: 'Mantequilla Sin Sal', categoria: 'Grasas', tipoMedida: 'peso', unidadBase: 'g', presentacionCantidad: 500, presentacionUnidad: 'g', costoPresentacionUsd: '4.75', monedaRegistro: 'USD', proveedor: 'Lácteos Premium', fechaActualizacionCosto: new Date().toISOString() },
      { nombre: 'Leche Entera', categoria: 'Lácteos', tipoMedida: 'volumen', unidadBase: 'ml', presentacionCantidad: 1000, presentacionUnidad: 'ml', costoPresentacionUsd: '1.80', monedaRegistro: 'USD', proveedor: 'Lácteos Premium', fechaActualizacionCosto: new Date().toISOString() },
      { nombre: 'Cacao en Polvo', categoria: 'Saborizantes', tipoMedida: 'peso', unidadBase: 'g', presentacionCantidad: 250, presentacionUnidad: 'g', costoPresentacionUsd: '3.50', monedaRegistro: 'USD', proveedor: 'Importadora Gourmet', fechaActualizacionCosto: new Date().toISOString() },
      { nombre: 'Polvo para Hornear', categoria: 'Otros', tipoMedida: 'peso', unidadBase: 'g', presentacionCantidad: 200, presentacionUnidad: 'g', costoPresentacionUsd: '1.10', monedaRegistro: 'USD', proveedor: 'Distribuidora ABC', fechaActualizacionCosto: new Date().toISOString() },
      { nombre: 'Vainilla Extracto', categoria: 'Saborizantes', tipoMedida: 'volumen', unidadBase: 'ml', presentacionCantidad: 120, presentacionUnidad: 'ml', costoPresentacionUsd: '2.90', monedaRegistro: 'USD', proveedor: 'Importadora Gourmet', fechaActualizacionCosto: new Date().toISOString() },
    ];

    for (const item of demoData) {
      await this.create(item);
    }
  }
}
