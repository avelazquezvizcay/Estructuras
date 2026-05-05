import { ChangeDetectionStrategy, Component, signal, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Modal } from '../../shared/modal/modal';
import { ProductoService, ProductoView } from '../../core/services/producto.service';
import { InsumoService } from '../../core/services/insumo.service';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { ExportService } from '../../core/services/export.service';
import { AuthService } from '../../core/services/auth.service';
import Decimal from 'decimal.js';

@Component({
  selector: 'sec-productos',
  imports: [FormsModule, Modal],
  templateUrl: './productos.html',
  styleUrl: './productos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Productos implements OnInit {
  protected readonly productoService = inject(ProductoService);
  protected readonly insumoService = inject(InsumoService);
  protected readonly tasaService = inject(TasaCambioService);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly exportService = inject(ExportService);
  protected readonly auth = inject(AuthService);

  protected readonly viewMode = signal<'grid' | 'table'>('grid');
  protected readonly showModal = signal(false);
  protected readonly showDetailModal = signal(false);
  protected readonly showShareModal = signal(false);
  protected readonly showDeleteConfirm = signal(false);
  protected readonly showProduccionModal = signal(false);
  protected readonly produccionCantidad = signal(1);
  protected readonly selectedProduct = signal<ProductoView | null>(null);
  protected readonly deletingProduct = signal<ProductoView | null>(null);
  protected readonly monedaDisplay = signal<'USD' | 'VES'>('USD');

  // Share Modal State
  protected readonly shareIncludeRecipe = signal(true);
  protected readonly sharePrices = signal<Record<'detalle' | 'mayor' | 'super_mayor', boolean>>({
    detalle: true,
    mayor: true,
    super_mayor: false
  });

  // Form
  protected readonly formNombre = signal('');
  protected readonly formDescripcion = signal('');
  protected readonly formCategoria = signal('');
  protected readonly formRendimiento = signal(1);
  protected readonly formRendimientoUnidad = signal('unidad');
  protected readonly formMargenDetalle = signal('70');
  protected readonly formMargenMayor = signal('50');
  protected readonly formMargenSuperMayor = signal('35');
  protected readonly formNotas = signal('');
  protected readonly formReceta = signal<{ insumoId: string; cantidad: string; unidad: string }[]>([]);

  protected readonly costoRecetaTotal = computed(() => {
    let total = new Decimal(0);
    for (const item of this.formReceta()) {
      const insumo = this.insumoService.getById(item.insumoId);
      if (insumo && item.cantidad) {
        total = total.plus(insumo.costoUnidadBaseUsd.mul(item.cantidad));
      }
    }
    return total;
  });

  ngOnInit(): void {
    this.productoService.seedIfEmpty();
  }

  openCreateModal(): void {
    this.resetForm();
    this.showModal.set(true);
  }

  openDetailModal(product: ProductoView): void {
    this.selectedProduct.set(product);
    this.showDetailModal.set(true);
  }

  confirmDelete(product: ProductoView): void {
    this.deletingProduct.set(product);
    this.showDeleteConfirm.set(true);
  }

  async executeDelete(): Promise<void> {
    const p = this.deletingProduct();
    if (p) await this.productoService.delete(p.id);
    this.showDeleteConfirm.set(false);
  }

  addRecetaItem(): void {
    const insumos = this.insumoService.insumos();
    if (!insumos.length) {
      this.toast.error('Primero debes crear insumos');
      return;
    }
    this.formReceta.update(list => [
      ...list,
      { insumoId: insumos[0].id, cantidad: '', unidad: insumos[0].unidadBase }
    ]);
  }

  removeRecetaItem(index: number): void {
    this.formReceta.update(list => list.filter((_, i) => i !== index));
  }

  updateRecetaItem(index: number, field: 'insumoId' | 'cantidad' | 'unidad', value: string): void {
    this.formReceta.update(list => {
      const updated = [...list];
      updated[index] = { ...updated[index], [field]: value };
      // Update unit when insumo changes
      if (field === 'insumoId') {
        const insumo = this.insumoService.getById(value);
        if (insumo) updated[index].unidad = insumo.unidadBase;
      }
      return updated;
    });
  }

  async saveProducto(): Promise<void> {
    const nombre = this.formNombre().trim();
    if (!nombre) { this.toast.error('El nombre es requerido'); return; }
    if (this.formReceta().length === 0) { this.toast.error('Agrega al menos un insumo a la receta'); return; }

    await this.productoService.create({
      nombre,
      descripcion: this.formDescripcion(),
      categoria: this.formCategoria() || 'General',
      rendimientoCantidad: this.formRendimiento(),
      rendimientoUnidad: this.formRendimientoUnidad(),
      margenes: {
        detalle: this.formMargenDetalle(),
        mayor: this.formMargenMayor(),
        super_mayor: this.formMargenSuperMayor()
      },
      notas: this.formNotas(),
      receta: this.formReceta().filter(r => r.cantidad)
    });

    this.showModal.set(false);
  }

  closeModal(): void { this.showModal.set(false); }

  toggleMoneda(): void {
    this.monedaDisplay.update(m => m === 'USD' ? 'VES' : 'USD');
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

  openShareModal(product: ProductoView): void {
    this.selectedProduct.set(product);
    this.showShareModal.set(true);
  }

  toggleSharePrice(nivel: 'detalle' | 'mayor' | 'super_mayor'): void {
    this.sharePrices.update(current => ({ ...current, [nivel]: !current[nivel] }));
  }

  async exportPdf(): Promise<void> {
    const product = this.selectedProduct();
    if (!product) return;

    const pricesToInclude = (['detalle', 'mayor', 'super_mayor'] as const)
      .filter(nivel => this.sharePrices()[nivel]);

    await this.exportService.exportProductPdf(product, {
      includeRecipe: this.shareIncludeRecipe(),
      pricesToInclude
    });
    this.toast.success('PDF generado exitosamente');
    this.showShareModal.set(false);
  }

  async shareText(): Promise<void> {
    const product = this.selectedProduct();
    if (!product) return;

    const includeRecipe = this.shareIncludeRecipe();
    const prices = this.sharePrices();

    let text = `📊 *${product.nombre}*\n`;
    if (product.descripcion) text += `${product.descripcion}\n`;
    text += `\n`;

    if (prices.detalle) {
      const p = product.precios.find(pr => pr.nivel === 'detalle');
      if (p) text += `🏷️ Detalle: $${new Decimal(p.precioUsd).toFixed(2)}\n`;
    }
    if (prices.mayor) {
      const p = product.precios.find(pr => pr.nivel === 'mayor');
      if (p) text += `📦 Mayor: $${new Decimal(p.precioUsd).toFixed(2)}\n`;
    }
    if (prices.super_mayor) {
      const p = product.precios.find(pr => pr.nivel === 'super_mayor');
      if (p) text += `🏭 Super Mayor: $${new Decimal(p.precioUsd).toFixed(2)}\n`;
    }

    if (includeRecipe) {
      text += `\n📝 *Estructura*\n`;
      text += `Costo Total: $${product.costoTotalUsd.toFixed(2)}\n`;
      text += `Insumos: ${product.receta.length}\n`;
    }

    text += `\n— SEC | Sistema de Estructura de Costos`;

    try {
      if (navigator.share) {
        await navigator.share({ text, title: product.nombre });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        this.toast.success('Copiado al portapapeles');
      }
    } catch {
      this.toast.info('Compartir cancelado o no disponible');
    }
    this.showShareModal.set(false);
  }

  openProduccionModal(product: ProductoView): void {
    this.selectedProduct.set(product);
    this.produccionCantidad.set(product.rendimientoCantidad || 1);
    this.showProduccionModal.set(true);
  }

  async executeProduccion(): Promise<void> {
    const p = this.selectedProduct();
    if (!p) return;
    
    await this.productoService.registrarProduccion(p.id, this.produccionCantidad());
    this.showProduccionModal.set(false);
  }

  private resetForm(): void {
    this.formNombre.set('');
    this.formDescripcion.set('');
    this.formCategoria.set('');
    this.formRendimiento.set(1);
    this.formRendimientoUnidad.set('unidad');
    this.formMargenDetalle.set('70');
    this.formMargenMayor.set('50');
    this.formMargenSuperMayor.set('35');
    this.formNotas.set('');
    this.formReceta.set([]);
  }
}
