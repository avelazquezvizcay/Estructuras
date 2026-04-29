import { ChangeDetectionStrategy, Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Modal } from '../../shared/modal/modal';
import { InsumoService, InsumoView } from '../../core/services/insumo.service';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';
import { ChartConfiguration } from 'chart.js';
import { ChartComponent } from '../../shared/components/chart/chart';
import Decimal from 'decimal.js';

@Component({
  selector: 'sec-insumos',
  imports: [CommonModule, FormsModule, Modal, ChartComponent],
  templateUrl: './insumos.html',
  styleUrl: './insumos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Insumos implements OnInit {
  protected readonly insumoService = inject(InsumoService);
  protected readonly tasaService = inject(TasaCambioService);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly searchTerm = signal('');
  protected readonly categoriaFilter = signal('Todas');
  protected readonly showModal = signal(false);
  protected readonly showDeleteConfirm = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly deletingInsumo = signal<InsumoView | null>(null);

  // Form fields
  protected readonly formNombre = signal('');
  protected readonly formCategoria = signal('');
  protected readonly formTipoMedida = signal<'peso' | 'volumen' | 'cantidad'>('peso');
  protected readonly formUnidadBase = signal('g');
  protected readonly formPresentacionCantidad = signal(1000);
  protected readonly formPresentacionUnidad = signal('g');
  protected readonly formCosto = signal('');
  protected readonly formMoneda = signal<'USD' | 'VES'>('USD');
  protected readonly formProveedor = signal('');
  protected readonly formStockActual = signal(0);
  protected readonly formStockMinimo = signal(0);
  protected readonly priceHistory = signal<{fecha: string, costo: number}[]>([]);

  protected readonly filteredInsumos = computed(() => {
    let list = this.insumoService.insumos();
    const cat = this.categoriaFilter();
    const search = this.searchTerm().toLowerCase();

    if (cat !== 'Todas') {
      list = list.filter(i => i.categoria === cat);
    }
    if (search) {
      list = list.filter(i =>
        i.nombre.toLowerCase().includes(search) ||
        i.proveedor.toLowerCase().includes(search)
      );
    }
    return list;
  });

  protected readonly unidadesDisponibles = computed(() => {
    const tipo = this.formTipoMedida();
    if (tipo === 'peso') return ['g', 'kg'];
    if (tipo === 'volumen') return ['ml', 'l'];
    return ['unidad', 'docena'];
  });

  protected readonly costoConvertido = computed(() => {
    const costo = this.formCosto();
    const moneda = this.formMoneda();
    if (!costo || isNaN(Number(costo))) return '';

    if (moneda === 'VES') {
      const tasa = this.tasaService.tasaActiva();
      if (tasa) {
        const usd = new Decimal(costo).div(tasa.valor);
        return `≈ $${usd.toFixed(2)} USD`;
      }
      return 'Sin tasa activa';
    }
    // USD → show Bs equivalent
    const tasa = this.tasaService.tasaActiva();
    if (tasa) {
      const bs = new Decimal(costo).mul(tasa.valor);
      return `≈ ${bs.toFixed(2)} Bs`;
    }
    return '';
  });

  protected readonly chartTrendConfig = computed<ChartConfiguration | null>(() => {
    const history = this.priceHistory();
    if (history.length < 1) return null;

    return {
      type: 'line',
      data: {
        labels: history.map(h => h.fecha),
        datasets: [{
          label: 'Costo Unitario (USD)',
          data: history.map(h => h.costo),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: false } }
      }
    };
  });

  ngOnInit(): void {
    this.insumoService.seedIfEmpty();
  }

  openCreateModal(): void {
    this.editingId.set(null);
    this.resetForm();
    this.showModal.set(true);
  }

  openEditModal(insumo: InsumoView): void {
    this.editingId.set(insumo.id);
    this.formNombre.set(insumo.nombre);
    this.formCategoria.set(insumo.categoria);
    this.formTipoMedida.set(insumo.tipoMedida);
    this.formUnidadBase.set(insumo.unidadBase);
    const parts = insumo.presentacion.split(' ');
    this.formPresentacionCantidad.set(Number(parts[0]) || 1);
    this.formPresentacionUnidad.set(parts[1] || 'g');
    this.formCosto.set(insumo.costoPresentacionUsd.toString());
    this.formMoneda.set(insumo.monedaRegistro);
    this.formProveedor.set(insumo.proveedor);
    this.formStockActual.set(insumo.stockActual);
    this.formStockMinimo.set(insumo.stockMinimo);
    this.showModal.set(true);
    
    // Cargar historial
    this.insumoService.getPriceHistory(insumo.id).then(history => {
      this.priceHistory.set(history.map(h => ({
        fecha: h.fecha.split('T')[0],
        costo: parseFloat(h.costoUnidadBaseUsd)
      })));
    });
  }

  confirmDelete(insumo: InsumoView): void {
    this.deletingInsumo.set(insumo);
    this.showDeleteConfirm.set(true);
  }

  async executeDelete(): Promise<void> {
    const insumo = this.deletingInsumo();
    if (insumo) {
      await this.insumoService.delete(insumo.id);
    }
    this.showDeleteConfirm.set(false);
    this.deletingInsumo.set(null);
  }

  async saveInsumo(): Promise<void> {
    const nombre = this.formNombre().trim();
    if (!nombre) {
      this.toast.error('El nombre es requerido');
      return;
    }
    if (!this.formCosto() || isNaN(Number(this.formCosto()))) {
      this.toast.error('El costo debe ser un número válido');
      return;
    }

    // Convert Bs to USD if needed
    let costoUsd = this.formCosto();
    if (this.formMoneda() === 'VES') {
      const tasa = this.tasaService.tasaActiva();
      if (!tasa) {
        this.toast.error('Se necesita una tasa activa para convertir Bs a USD');
        return;
      }
      costoUsd = new Decimal(this.formCosto()).div(tasa.valor).toString();
    }

    const data = {
      nombre,
      categoria: this.formCategoria() || 'Otros',
      tipoMedida: this.formTipoMedida(),
      unidadBase: this.formUnidadBase(),
      presentacionCantidad: this.formPresentacionCantidad(),
      presentacionUnidad: this.formPresentacionUnidad(),
      costoPresentacionUsd: costoUsd,
      monedaRegistro: this.formMoneda(),
      proveedor: this.formProveedor(),
      fechaActualizacionCosto: new Date().toISOString(),
      stockActual: this.formStockActual(),
      stockMinimo: this.formStockMinimo()
    };

    const editId = this.editingId();
    if (editId) {
      await this.insumoService.update(editId, data);
    } else {
      await this.insumoService.create(data);
    }

    this.showModal.set(false);
    this.resetForm();
  }

  closeModal(): void {
    this.showModal.set(false);
    this.resetForm();
  }

  setCategoria(cat: string): void {
    this.categoriaFilter.set(cat);
  }

  private resetForm(): void {
    this.formNombre.set('');
    this.formCategoria.set('');
    this.formTipoMedida.set('peso');
    this.formUnidadBase.set('g');
    this.formPresentacionCantidad.set(1000);
    this.formPresentacionUnidad.set('g');
    this.formCosto.set('');
    this.formMoneda.set('USD');
    this.formProveedor.set('');
    this.formStockActual.set(0);
    this.formStockMinimo.set(0);
  }

  formatCostBase(insumo: InsumoView): string {
    return `$${insumo.costoUnidadBaseUsd.toFixed(4)}/${insumo.unidadBase}`;
  }

  formatCostPresentacion(insumo: InsumoView): string {
    return `$${insumo.costoPresentacionUsd.toFixed(2)}`;
  }
}
