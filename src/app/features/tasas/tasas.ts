import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';

@Component({
  selector: 'sec-tasas',
  imports: [DatePipe, FormsModule],
  templateUrl: './tasas.html',
  styleUrl: './tasas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Tasas {
  protected readonly tasaService = inject(TasaCambioService);

  protected readonly showManualModal = signal(false);
  protected readonly manualBcv = signal<number>(0);
  protected readonly manualBinance = signal<number>(0);
  protected readonly manualEuro = signal<number>(0);

  openManualModal(): void {
    // Pre-fill with current values
    const bcv = this.tasaService.tasaBcv();
    const bin = this.tasaService.tasaBinance();
    const eur = this.tasaService.tasaEuro();
    this.manualBcv.set(bcv ? bcv.valor.toNumber() : 0);
    this.manualBinance.set(bin ? bin.valor.toNumber() : 0);
    this.manualEuro.set(eur ? eur.valor.toNumber() : 0);
    this.showManualModal.set(true);
  }

  saveManualRate(): void {
    if (this.manualBcv() <= 0) return;
    this.tasaService.setManualRate(this.manualBcv(), this.manualBinance(), this.manualEuro());
    this.showManualModal.set(false);
  }

  refreshRates(): void {
    this.tasaService.fetchRates(true);
  }

  deleteHistorial(id: number): void {
    this.tasaService.deleteHistorialEntry(id);
  }

  getSourceLabel(source: string): string {
    const labels: Record<string, string> = {
      dolarapi: 'DolarAPI',
      pydolarve: 'PyDolarVe',
      manual: 'Manual',
      cache: 'Caché',
      fallback: 'Predeterminado'
    };
    return labels[source] || source;
  }

  getSourceClass(source: string): string {
    const classes: Record<string, string> = {
      dolarapi: 'badge--success',
      pydolarve: 'badge--info',
      manual: 'badge--warning',
      cache: 'badge--purple',
      fallback: 'badge--default'
    };
    return classes[source] || 'badge--default';
  }
}
