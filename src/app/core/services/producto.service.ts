import { Injectable, signal, computed } from '@angular/core';
import Decimal from 'decimal.js';
import { db, type ProductoRecord, type ItemRecetaRecord } from '../data/database';
import { ToastService } from './toast.service';
import { InsumoService } from './insumo.service';

export interface PrecioVenta {
  nivel: 'detalle' | 'mayor' | 'super_mayor';
  label: string;
  margenPct: string; // Decimal string
  precioUsd: string;
}

export interface ProductoView {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  rendimiento: string;
  rendimientoCantidad: number;
  rendimientoUnidad: string;
  costoTotalUsd: Decimal;
  precios: PrecioVenta[];
  receta: RecetaItemView[];
  notas: string;
}

export interface RecetaItemView {
  id: string;
  insumoId: string;
  insumoNombre: string;
  cantidad: Decimal;
  unidad: string;
  costoLineaUsd: Decimal;
}

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private readonly _productos = signal<ProductoView[]>([]);
  private readonly _loading = signal(false);

  readonly productos = this._productos.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly count = computed(() => this._productos().length);

  readonly categorias = computed(() => {
    const cats = new Set(this._productos().map(p => p.categoria));
    return ['Todas', ...Array.from(cats).sort()];
  });

  // Dashboard aggregations
  readonly promedioCosto = computed(() => {
    const list = this._productos();
    if (!list.length) return new Decimal(0);
    const sum = list.reduce((acc, p) => acc.plus(p.costoTotalUsd), new Decimal(0));
    return sum.div(list.length);
  });

  readonly promedioMargen = computed(() => {
    const list = this._productos();
    if (!list.length) return new Decimal(0);
    const margins = list.map(p => {
      const detalle = p.precios.find(pr => pr.nivel === 'detalle');
      return detalle ? new Decimal(detalle.margenPct) : new Decimal(0);
    });
    const sum = margins.reduce((acc, m) => acc.plus(m), new Decimal(0));
    return sum.div(list.length);
  });

  readonly topPorCosto = computed(() =>
    [...this._productos()].sort((a, b) => b.costoTotalUsd.minus(a.costoTotalUsd).toNumber()).slice(0, 5)
  );

  readonly topPorMargen = computed(() =>
    [...this._productos()].sort((a, b) => {
      const mA = new Decimal(a.precios.find(p => p.nivel === 'detalle')?.margenPct || '0');
      const mB = new Decimal(b.precios.find(p => p.nivel === 'detalle')?.margenPct || '0');
      return mB.minus(mA).toNumber();
    }).slice(0, 5)
  );

  readonly menorCosto = computed(() =>
    [...this._productos()].sort((a, b) => a.costoTotalUsd.minus(b.costoTotalUsd).toNumber()).slice(0, 5)
  );

  constructor(
    private toast: ToastService,
    private insumoService: InsumoService
  ) {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this._loading.set(true);
    try {
      const records = await db.productos.toArray();
      const views: ProductoView[] = [];

      for (const r of records) {
        const recetaItems = await db.itemsReceta.where('productoFinalId').equals(r.id!).toArray();
        views.push(this.toView(r, recetaItems));
      }

      this._productos.set(views);
    } catch (e) {
      console.error('Error loading productos:', e);
    } finally {
      this._loading.set(false);
    }
  }

  async create(data: {
    nombre: string;
    descripcion: string;
    categoria: string;
    rendimientoCantidad: number;
    rendimientoUnidad: string;
    margenes: { detalle: string; mayor: string; super_mayor: string };
    notas: string;
    receta: { insumoId: string; cantidad: string; unidad: string }[];
  }): Promise<void> {
    const id = crypto.randomUUID();

    // Calculate recipe cost
    let costoTotal = new Decimal(0);
    const recetaRecords: ItemRecetaRecord[] = [];

    for (const item of data.receta) {
      const insumo = this.insumoService.getById(item.insumoId);
      if (!insumo) continue;

      const costoLinea = insumo.costoUnidadBaseUsd.mul(item.cantidad);
      costoTotal = costoTotal.plus(costoLinea);

      recetaRecords.push({
        id: crypto.randomUUID(),
        productoFinalId: id,
        insumoId: item.insumoId,
        cantidad: item.cantidad,
        unidad: item.unidad,
        costoLineaUsd: costoLinea.toString()
      });
    }

    // Calculate price tiers
    const precios = this.calcularPrecios(costoTotal, data.margenes);

    const record: ProductoRecord = {
      id,
      nombre: data.nombre,
      descripcion: data.descripcion,
      categoria: data.categoria,
      rendimientoCantidad: data.rendimientoCantidad,
      rendimientoUnidad: data.rendimientoUnidad,
      margenUtilidadPct: data.margenes.detalle,
      costoTotalUsd: costoTotal.toString(),
      precioVentaUsd: precios.find(p => p.nivel === 'detalle')?.precioUsd || '0',
      notas: data.notas
    };

    await db.productos.put(record);
    for (const ri of recetaRecords) {
      await db.itemsReceta.put(ri);
    }

    const view = this.toView(record, recetaRecords);
    this._productos.update(list => [...list, view]);
    this.toast.success(`Producto "${data.nombre}" creado exitosamente`);
  }

  /**
   * Registra la producción de un producto y descuenta los insumos del inventario
   */
  async registrarProduccion(id: string, cantidadAProducir: number): Promise<void> {
    const producto = this.getById(id);
    if (!producto) return;

    this._loading.set(true);
    try {
      // 1. Verificar si hay stock suficiente de todos los insumos (Opcional, pero recomendado)
      // Por ahora procederemos con el descuento directo.

      for (const item of producto.receta) {
        const cantidadTotalADescontar = item.cantidad.mul(cantidadAProducir).toNumber();
        const insumo = await db.insumos.get(item.insumoId);
        
        if (insumo) {
          const nuevoStock = (insumo.stockActual || 0) - cantidadTotalADescontar;
          await this.insumoService.update(item.insumoId, { stockActual: nuevoStock });
        }
      }

      this.toast.success(`Producción registrada: ${cantidadAProducir} unidades de "${producto.nombre}". Inventario actualizado.`);
    } catch (e) {
      this.toast.error('Error al registrar la producción');
      console.error(e);
    } finally {
      this._loading.set(false);
    }
  }

  async delete(id: string): Promise<void> {
    const producto = this._productos().find(p => p.id === id);
    await db.itemsReceta.where('productoFinalId').equals(id).delete();
    await db.productos.delete(id);
    this._productos.update(list => list.filter(p => p.id !== id));
    this.toast.warning(`Producto "${producto?.nombre}" eliminado`);
  }

  getById(id: string): ProductoView | undefined {
    return this._productos().find(p => p.id === id);
  }

  private calcularPrecios(costo: Decimal, margenes: { detalle: string; mayor: string; super_mayor: string }): PrecioVenta[] {
    return [
      {
        nivel: 'detalle',
        label: 'Detalle',
        margenPct: margenes.detalle,
        precioUsd: costo.mul(new Decimal(1).plus(new Decimal(margenes.detalle).div(100))).toString()
      },
      {
        nivel: 'mayor',
        label: 'Mayor',
        margenPct: margenes.mayor,
        precioUsd: costo.mul(new Decimal(1).plus(new Decimal(margenes.mayor).div(100))).toString()
      },
      {
        nivel: 'super_mayor',
        label: 'Super Mayor',
        margenPct: margenes.super_mayor,
        precioUsd: costo.mul(new Decimal(1).plus(new Decimal(margenes.super_mayor).div(100))).toString()
      }
    ];
  }

  private toView(r: ProductoRecord, recetaItems: ItemRecetaRecord[]): ProductoView {
    const costoTotal = new Decimal(r.costoTotalUsd || '0');
    const margenDetalle = r.margenUtilidadPct || '70';

    return {
      id: r.id!,
      nombre: r.nombre,
      descripcion: r.descripcion,
      categoria: r.categoria,
      rendimiento: `${r.rendimientoCantidad} ${r.rendimientoUnidad}`,
      rendimientoCantidad: r.rendimientoCantidad,
      rendimientoUnidad: r.rendimientoUnidad,
      costoTotalUsd: costoTotal,
      precios: this.calcularPrecios(costoTotal, {
        detalle: margenDetalle,
        mayor: new Decimal(margenDetalle).mul(0.7).toFixed(0),
        super_mayor: new Decimal(margenDetalle).mul(0.5).toFixed(0)
      }),
      receta: recetaItems.map(ri => {
        const insumo = this.insumoService.getById(ri.insumoId);
        return {
          id: ri.id!,
          insumoId: ri.insumoId,
          insumoNombre: insumo?.nombre || 'Insumo eliminado',
          cantidad: new Decimal(ri.cantidad),
          unidad: ri.unidad,
          costoLineaUsd: new Decimal(ri.costoLineaUsd)
        };
      }),
      notas: r.notas
    };
  }

  /** Seed demo data if DB is empty */
  async seedIfEmpty(): Promise<void> {
    const count = await db.productos.count();
    if (count > 0) return;

    const insumos = this.insumoService.insumos();
    if (insumos.length < 5) return;

    const demoProducts = [
      {
        nombre: 'Torta de Chocolate 1kg', descripcion: 'Torta húmeda de chocolate premium',
        categoria: 'Tortas', rendimientoCantidad: 1, rendimientoUnidad: 'torta',
        margenes: { detalle: '70', mayor: '50', super_mayor: '35' },
        notas: 'Producto estrella',
        receta: [
          { insumoId: insumos[0].id, cantidad: '300', unidad: 'g' },
          { insumoId: insumos[1].id, cantidad: '200', unidad: 'g' },
          { insumoId: insumos[2].id, cantidad: '4', unidad: 'unidad' },
          { insumoId: insumos[3].id, cantidad: '150', unidad: 'g' },
          { insumoId: insumos[5].id, cantidad: '50', unidad: 'g' },
        ]
      },
      {
        nombre: 'Pan de Jamón 500g', descripcion: 'Pan de jamón tradicional venezolano',
        categoria: 'Panes', rendimientoCantidad: 1, rendimientoUnidad: 'unidad',
        margenes: { detalle: '70', mayor: '50', super_mayor: '30' },
        notas: '',
        receta: [
          { insumoId: insumos[0].id, cantidad: '500', unidad: 'g' },
          { insumoId: insumos[2].id, cantidad: '2', unidad: 'unidad' },
          { insumoId: insumos[3].id, cantidad: '60', unidad: 'g' },
          { insumoId: insumos[4].id, cantidad: '100', unidad: 'ml' },
          { insumoId: insumos[1].id, cantidad: '30', unidad: 'g' },
        ]
      },
      {
        nombre: 'Galletas de Avena x12', descripcion: 'Galletas artesanales de avena y pasas',
        categoria: 'Galletas', rendimientoCantidad: 12, rendimientoUnidad: 'unidades',
        margenes: { detalle: '60', mayor: '40', super_mayor: '25' },
        notas: '',
        receta: [
          { insumoId: insumos[0].id, cantidad: '200', unidad: 'g' },
          { insumoId: insumos[1].id, cantidad: '100', unidad: 'g' },
          { insumoId: insumos[2].id, cantidad: '2', unidad: 'unidad' },
          { insumoId: insumos[3].id, cantidad: '100', unidad: 'g' },
        ]
      },
      {
        nombre: 'Brownie Premium', descripcion: 'Brownie de chocolate belga con nueces',
        categoria: 'Postres', rendimientoCantidad: 8, rendimientoUnidad: 'porciones',
        margenes: { detalle: '70', mayor: '50', super_mayor: '35' },
        notas: '',
        receta: [
          { insumoId: insumos[5].id, cantidad: '100', unidad: 'g' },
          { insumoId: insumos[3].id, cantidad: '120', unidad: 'g' },
          { insumoId: insumos[2].id, cantidad: '3', unidad: 'unidad' },
          { insumoId: insumos[1].id, cantidad: '150', unidad: 'g' },
          { insumoId: insumos[0].id, cantidad: '80', unidad: 'g' },
        ]
      },
      {
        nombre: 'Cheesecake 1.5kg', descripcion: 'Cheesecake New York style',
        categoria: 'Tortas', rendimientoCantidad: 1, rendimientoUnidad: 'torta',
        margenes: { detalle: '80', mayor: '55', super_mayor: '40' },
        notas: '',
        receta: [
          { insumoId: insumos[3].id, cantidad: '200', unidad: 'g' },
          { insumoId: insumos[2].id, cantidad: '5', unidad: 'unidad' },
          { insumoId: insumos[1].id, cantidad: '180', unidad: 'g' },
          { insumoId: insumos[4].id, cantidad: '200', unidad: 'ml' },
          { insumoId: insumos[7].id, cantidad: '10', unidad: 'ml' },
        ]
      },
      {
        nombre: 'Alfajores x6', descripcion: 'Alfajores de maicena con dulce de leche',
        categoria: 'Galletas', rendimientoCantidad: 6, rendimientoUnidad: 'unidades',
        margenes: { detalle: '60', mayor: '40', super_mayor: '25' },
        notas: '',
        receta: [
          { insumoId: insumos[0].id, cantidad: '150', unidad: 'g' },
          { insumoId: insumos[3].id, cantidad: '80', unidad: 'g' },
          { insumoId: insumos[1].id, cantidad: '60', unidad: 'g' },
          { insumoId: insumos[2].id, cantidad: '2', unidad: 'unidad' },
        ]
      }
    ];

    for (const prod of demoProducts) {
      await this.create(prod);
    }
  }
}
