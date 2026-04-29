import { Injectable, signal, computed, inject } from '@angular/core';
import { db, type CompraRecord } from '../data/database';
import { InsumoService } from './insumo.service';
import { ToastService } from './toast.service';
import Decimal from 'decimal.js';

export interface ItemCompra {
  insumoId?: string; // Opcional si es nuevo
  nombre: string;
  cantidad: number;
  costoUnitarioUsd: string;
  subtotalUsd: string;
  categoria?: string; // Para nuevos
  unidad?: string;    // Para nuevos
  sugerenciaId?: string; // ID de un producto similar
  sugerenciaNombre?: string; // Nombre de un producto similar
}

@Injectable({ providedIn: 'root' })
export class CompraService {
  private readonly insumoService = inject(InsumoService);
  private readonly toast = inject(ToastService);

  private readonly _compras = signal<CompraRecord[]>([]);
  readonly compras = this._compras.asReadonly();

  constructor() {
    this.loadCompras();
  }

  async loadCompras() {
    const list = await db.compras.reverse().toArray();
    this._compras.set(list);
  }

  async registrarCompra(data: {
    proveedor: string,
    fecha: string,
    items: ItemCompra[],
    tasaUsd: number,
    metodoPago: string
  }) {
    let totalUsd = new Decimal(0);
    
    // 1. Procesar items
    for (const item of data.items) {
      const subtotal = new Decimal(item.costoUnitarioUsd).mul(item.cantidad);
      totalUsd = totalUsd.plus(subtotal);

      let targetInsumoId = item.insumoId;

      // Si no tiene ID, lo creamos como un nuevo insumo automáticamente
      if (!targetInsumoId) {
        this.toast.info(`Creando nuevo insumo: ${item.nombre}...`);
        const newInsumo = await this.insumoService.create({
          nombre: item.nombre,
          proveedor: data.proveedor,
          categoria: item.categoria || 'Otros',
          tipoMedida: item.unidad === 'unidad' ? 'cantidad' : (['g', 'kg'].includes(item.unidad || '') ? 'peso' : 'volumen'),
          unidadBase: item.unidad || 'unidad',
          presentacionCantidad: 1,
          presentacionUnidad: item.unidad || 'unidad',
          costoPresentacionUsd: item.costoUnitarioUsd,
          stockActual: 0,
          stockMinimo: 0,
          monedaRegistro: 'USD',
          fechaActualizacionCosto: new Date().toISOString()
        });
        targetInsumoId = newInsumo.id;
        item.insumoId = targetInsumoId; // Actualizamos la referencia en el item de compra
      }

      // Actualizar stock y precio base del insumo (nuevo o existente)
      await this.insumoService.updateStockAndPrice(
        targetInsumoId!, 
        item.cantidad, 
        new Decimal(item.costoUnitarioUsd)
      );
    }

    const totalBes = totalUsd.mul(data.tasaUsd);

    const record: CompraRecord = {
      proveedor: data.proveedor,
      fecha: data.fecha,
      items: JSON.stringify(data.items),
      tasaUsd: data.tasaUsd,
      totalUsd: totalUsd.toString(),
      totalBes: totalBes.toString(),
      metodoPago: data.metodoPago
    };

    await db.compras.add(record);
    await this.loadCompras();
    
    this.toast.success('Compra registrada e inventario actualizado');
  }
}
