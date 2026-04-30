import { Injectable, signal, computed, inject } from '@angular/core';
import { type CompraRecord } from '../data/database';
import { InsumoService } from './insumo.service';
import { ToastService } from './toast.service';
import { SqliteDatabaseService } from './sqlite-database.service';
import Decimal from 'decimal.js';

export interface ItemCompra {
  insumoId?: string; // Opcional si es nuevo
  nombre: string;
  cantidad: number;
  costoUnitarioUsd: string;
  subtotalUsd: string;
  categoria?: string; // Para nuevos
  unidad?: string;    // Obsoleto, usar los de abajo
  presentacionValor?: number;
  presentacionUnidad?: string;
  sugerenciaId?: string; // ID de un producto similar
  sugerenciaNombre?: string; // Nombre de un producto similar
}

@Injectable({ providedIn: 'root' })
export class CompraService {
  private readonly insumoService = inject(InsumoService);
  private readonly toast = inject(ToastService);
  private readonly sqlite = inject(SqliteDatabaseService);

  private readonly _compras = signal<CompraRecord[]>([]);
  readonly compras = this._compras.asReadonly();

  constructor() {
    this.loadCompras();
  }

  async loadCompras() {
    const list = await this.sqlite.all<CompraRecord>('SELECT * FROM compras ORDER BY fecha DESC');
    this._compras.set(list);
  }

  async registrarCompra(data: {
    proveedor: string,
    fecha: string,
    items: ItemCompra[],
    tasaUsd: number,
    metodoPago: string
  }) {
    try {
      this.toast.info('Procesando compra...');
      let totalUsd = new Decimal(0);
      
      // 1. Procesar items
      for (const item of data.items) {
        const subtotal = new Decimal(item.costoUnitarioUsd || 0).mul(item.cantidad || 0);
        totalUsd = totalUsd.plus(subtotal);

        let targetInsumoId = item.insumoId;

        // Si no tiene ID, lo creamos como un nuevo insumo automáticamente
        if (!targetInsumoId) {
          const newInsumo = await this.insumoService.create({
            nombre: item.nombre,
            proveedor: data.proveedor,
            categoria: item.categoria || 'Otros',
            tipoMedida: item.presentacionUnidad === 'unidad' ? 'cantidad' : (['g', 'kg'].includes(item.presentacionUnidad || '') ? 'peso' : 'volumen'),
            unidadBase: item.presentacionUnidad || 'unidad',
            presentacionCantidad: item.presentacionValor || 1,
            presentacionUnidad: item.presentacionUnidad || 'unidad',
            costoPresentacionUsd: item.costoUnitarioUsd,
            stockActual: 0,
            stockMinimo: 0,
            monedaRegistro: 'USD',
            fechaActualizacionCosto: new Date().toISOString()
          });
          targetInsumoId = newInsumo.id;
          item.insumoId = targetInsumoId;
        }

        // Actualizar stock y precio base del insumo
        await this.insumoService.updateStockAndPrice(
          targetInsumoId!, 
          item.cantidad, 
          new Decimal(item.costoUnitarioUsd)
        );
      }

      const totalBes = totalUsd.mul(data.tasaUsd);

      const record: CompraRecord = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        proveedor: data.proveedor,
        fecha: data.fecha,
        items: JSON.stringify(data.items),
        tasaUsd: data.tasaUsd,
        totalUsd: totalUsd.toString(),
        totalBes: totalBes.toString(),
        metodoPago: data.metodoPago
      };

      const sql = `INSERT INTO compras (id, proveedor, fecha, items, tasaUsd, totalUsd, totalBes, metodoPago) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [record.id, record.proveedor, record.fecha, record.items, record.tasaUsd, record.totalUsd, record.totalBes, record.metodoPago];
      
      await this.sqlite.run(sql, params);
      await this.loadCompras();
      
      this.toast.success('Compra registrada e inventario actualizado');
      return true;
    } catch (error) {
      console.error('Error al registrar compra:', error);
      this.toast.error('Ocurrió un error crítico al guardar. Revisa la consola.');
      throw error;
    }
  }

  async eliminarCompra(id: string): Promise<void> {
    try {
      const compra = await this.sqlite.get<CompraRecord>('SELECT * FROM compras WHERE id = ?', [id]);
      if (!compra) return;

      const items: ItemCompra[] = JSON.parse(compra.items);
      
      for (const item of items) {
        if (item.insumoId) {
          await this.insumoService.revertirStock(item.insumoId, item.cantidad);
        }
      }

      await this.sqlite.run('DELETE FROM compras WHERE id = ?', [id]);
      await this.loadCompras();
      this.toast.warning('Factura eliminada e inventario revertido');
    } catch (error) {
      console.error('Error al eliminar compra:', error);
      this.toast.error('No se pudo eliminar la factura');
    }
  }
}
