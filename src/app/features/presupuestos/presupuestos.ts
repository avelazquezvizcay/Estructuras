import { ChangeDetectionStrategy, Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductoService } from '../../core/services/producto.service';
import { InsumoService } from '../../core/services/insumo.service';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { GeneradorPdfService, PresupuestoConfig } from './generador-pdf.service';
import { ProductoFinal } from '../../core/models/domain.models';
import Decimal from 'decimal.js';

interface PresupuestoItem {
  productoId: string;
  cantidad: number;
  precioNivel: 'detalle' | 'mayor' | 'super_mayor';
  descuentoPct: number;
}

@Component({
  selector: 'sec-presupuestos',
  imports: [FormsModule],
  templateUrl: './presupuestos.html',
  styleUrl: './presupuestos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Presupuestos implements OnInit {
  protected readonly productoService = inject(ProductoService);
  protected readonly insumoService = inject(InsumoService);
  protected readonly tasaService = inject(TasaCambioService);
  protected readonly i18n = inject(I18nService);
  protected readonly generadorPdfService = inject(GeneradorPdfService);
  private readonly toast = inject(ToastService);

  // Form State
  protected readonly clienteNombre = signal('');
  protected readonly clienteContacto = signal('');
  protected readonly notasPresupuesto = signal('Presupuesto válido por 5 días hábiles.');
  
  // Lista de IDs de productos seleccionados
  protected readonly productosSeleccionados = signal<{productoId: string; cantidad: number}[]>([]);
  
  protected readonly monedaDisplay = signal<'USD' | 'VES'>('USD');
  protected readonly showSimulacion = signal(true); // Siempre mostrar simulacion por defecto

  // Opciones del PDF
  protected readonly configPdf = signal<PresupuestoConfig>({
    incluirReceta: false,
    mostrarPrecioDetal: true,
    mostrarPrecioMayor: true,
    mostrarPrecioGranMayor: true,
    monedaReporte: 'USD'
  });

  // View Computeds
  protected readonly itemsView = computed(() => {
    return this.productosSeleccionados().map((item, index) => {
      const prod = this.productoService.getById(item.productoId);
      return prod ? { _index: index, producto: prod, cantidad: item.cantidad } : null;
    }).filter(i => i !== null) as { _index: number, producto: any, cantidad: number }[];
  });

  ngOnInit(): void {
    if (this.productosSeleccionados().length === 0 && this.productoService.productos().length > 0) {
      this.addItem();
    }
  }

  addItem(): void {
    const productos = this.productoService.productos();
    if (!productos.length) {
      this.toast.warning('Debe crear productos primero.');
      return;
    }
    this.productosSeleccionados.update(list => [
      ...list,
      { productoId: productos[0].id, cantidad: 1 }
    ]);
  }

  removeItem(index: number): void {
    this.productosSeleccionados.update(list => list.filter((_, i) => i !== index));
  }

  updateItem(index: number, field: 'productoId' | 'cantidad', value: string | number): void {
    this.productosSeleccionados.update(list => {
      const newList = [...list];
      newList[index] = { ...newList[index], [field]: value };
      return newList;
    });
  }

  /**
   * Calcula la suma consolidada de todos los materiales necesarios
   */
  protected readonly materialesConsolidados = computed(() => {
    const consolidado: Record<string, { nombre: string; cantidad: Decimal; unidad: string; insumoId: string }> = {};

    for (const item of this.productosSeleccionados()) {
      const prod = this.productoService.getById(item.productoId);
      if (!prod) continue;

      for (const r of prod.receta) {
        const cantTotal = r.cantidad.mul(item.cantidad);
        if (consolidado[r.insumoId]) {
          consolidado[r.insumoId].cantidad = consolidado[r.insumoId].cantidad.plus(cantTotal);
        } else {
          consolidado[r.insumoId] = {
            insumoId: r.insumoId,
            nombre: r.insumoNombre,
            cantidad: cantTotal,
            unidad: r.unidad
          };
        }
      }
    }

    // Comparar con el stock actual de InsumoService
    return Object.values(consolidado).map(m => {
      const insumo = this.insumoService.getById(m.insumoId);
      const stockActual = insumo?.stockActual || 0;
      const falta = Decimal.max(0, m.cantidad.minus(stockActual));
      
      return {
        ...m,
        stockActual,
        falta: falta.toNumber(),
        tieneSuficiente: falta.isZero(),
        costoFaltante: insumo ? falta.mul(insumo.costoUnidadBaseUsd).toNumber() : 0
      };
    });
  });

  protected readonly costoTotalSimulado = computed(() => {
    return this.materialesConsolidados().reduce((sum, m) => sum + m.costoFaltante, 0);
  });

  updateConfig(key: keyof PresupuestoConfig, value: boolean | string): void {
    this.configPdf.update(c => ({ ...c, [key]: value }));
  }

  toggleMoneda(): void {
    const nuevaMoneda = this.monedaDisplay() === 'USD' ? 'VES' : 'USD';
    this.monedaDisplay.set(nuevaMoneda);
    this.updateConfig('monedaReporte', nuevaMoneda);
  }

  formatPrice(usdValue: string | Decimal, addSymbol = true): string {
    const val = typeof usdValue === 'string' ? new Decimal(usdValue) : usdValue;
    if (this.monedaDisplay() === 'VES') {
      const tasa = this.tasaService.tasaActiva();
      if (tasa) {
        const bs = val.mul(tasa.valor);
        return addSymbol ? `${bs.toFixed(2)} Bs` : bs.toFixed(2);
      }
    }
    return addSymbol ? `$${val.toFixed(2)}` : val.toFixed(2);
  }

  generarPdf(): void {
    const productosList = this.itemsView().map(i => i.producto);

    if (productosList.length === 0) {
      this.toast.error('El presupuesto no tiene productos seleccionados');
      return;
    }

    const tasa = this.tasaService.tasaActiva()?.valor.toNumber() || 1;
    const empresaNombre = this.clienteNombre().trim() ? `Para: ${this.clienteNombre()}` : 'SEC - Generador de Presupuestos';

    // Generar PDF con el servicio delegado
    this.generadorPdfService.generarPresupuestoProductos(
      productosList,
      this.configPdf(),
      tasa,
      empresaNombre
    );

    this.toast.success('Catálogo de Presupuesto PDF generado');
  }

  limpiar(): void {
    this.clienteNombre.set('');
    this.clienteContacto.set('');
    this.productosSeleccionados.set([]);
    this.addItem();
  }
}
