import { ChangeDetectionStrategy, Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InsumoService, InsumoView } from '../../core/services/insumo.service';
import { ToastService } from '../../core/services/toast.service';
import Decimal from 'decimal.js';

@Component({
  selector: 'sec-inventario-masivo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventario-masivo.html',
  styleUrl: './inventario-masivo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventarioMasivo implements OnInit {
  private readonly insumoService = inject(InsumoService);
  private readonly toast = inject(ToastService);

  protected readonly searchTerm = signal('');
  protected readonly categoriaFilter = signal('Todas');
  
  // Track changes: Map<id, newStockValue>
  protected readonly pendingChanges = signal<Map<string, number>>(new Map());

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

  protected readonly categorias = computed(() => this.insumoService.categorias());
  
  protected readonly hasChanges = computed(() => this.pendingChanges().size > 0);
  protected readonly changesCount = computed(() => this.pendingChanges().size);

  ngOnInit(): void {
    this.insumoService.loadAll();
  }

  onStockChange(id: string, value: string, originalValue: number): void {
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) return;

    this.pendingChanges.update(map => {
      const newMap = new Map(map);
      if (numValue === originalValue) {
        newMap.delete(id);
      } else {
        newMap.set(id, numValue);
      }
      return newMap;
    });
  }

  getStockValue(insumo: InsumoView): number {
    const changedValue = this.pendingChanges().get(insumo.id);
    return changedValue !== undefined ? changedValue : insumo.stockActual;
  }

  getDiff(insumo: InsumoView): string {
    const changedValue = this.pendingChanges().get(insumo.id);
    if (changedValue === undefined) return '';
    
    const diff = changedValue - insumo.stockActual;
    if (diff === 0) return '';
    
    const prefix = diff > 0 ? '+' : '';
    return `(${prefix}${diff})`;
  }

  async saveChanges(): Promise<void> {
    const changes = this.pendingChanges();
    if (changes.size === 0) return;

    try {
      for (const [id, newStock] of changes.entries()) {
        await this.insumoService.update(id, { stockActual: newStock });
      }
      
      this.toast.success(`${changes.size} insumos actualizados correctamente`);
      this.pendingChanges.set(new Map());
    } catch (error) {
      this.toast.error('Error al guardar los cambios');
      console.error(error);
    }
  }

  cancelChanges(): void {
    this.pendingChanges.set(new Map());
    this.toast.info('Cambios descartados');
  }
}
