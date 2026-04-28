import { ChangeDetectionStrategy, Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductoService } from '../../core/services/producto.service';
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
  protected readonly tasaService = inject(TasaCambioService);
  protected readonly i18n = inject(I18nService);
  protected readonly generadorPdfService = inject(GeneradorPdfService);
  private readonly toast = inject(ToastService);

  // Form State
  protected readonly clienteNombre = signal('');
  protected readonly clienteContacto = signal('');
  protected readonly notasPresupuesto = signal('Presupuesto válido por 5 días hábiles.');
  
  // Lista de IDs de productos seleccionados
  protected readonly productosSeleccionados = signal<{productoId: string}[]>([]);
  
  protected readonly monedaDisplay = signal<'USD' | 'VES'>('USD');

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
      return prod ? { _index: index, producto: prod as unknown as ProductoFinal } : null;
    }).filter(i => i !== null) as { _index: number, producto: ProductoFinal }[];
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
      { productoId: productos[0].id }
    ]);
  }

  removeItem(index: number): void {
    this.productosSeleccionados.update(list => list.filter((_, i) => i !== index));
  }

  updateItem(index: number, productoId: string): void {
    this.productosSeleccionados.update(list => {
      const newList = [...list];
      newList[index] = { productoId };
      return newList;
    });
  }

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
