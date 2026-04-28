import { ChangeDetectionStrategy, Component, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TipoTasa } from '../../core/models/domain.models';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';
import { BackupService } from '../../core/services/backup.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'sec-configuracion',
  imports: [FormsModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Configuracion {
  private readonly tasaService = inject(TasaCambioService);
  protected readonly backupService = inject(BackupService);
  private readonly toast = inject(ToastService);

  protected readonly monedaPrincipal = signal<'USD' | 'VES'>('USD');
  protected readonly tasaPreferida = signal<TipoTasa>('BCV_USD');
  protected readonly decimales = signal(2);
  protected readonly idioma = signal('es');
  protected readonly backupEmail = signal('');

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  setMoneda(moneda: 'USD' | 'VES'): void {
    this.monedaPrincipal.set(moneda);
  }

  setTasa(tasa: TipoTasa): void {
    this.tasaPreferida.set(tasa);
    this.tasaService.setTasaPreferida(tasa);
  }

  setDecimales(val: number): void {
    this.decimales.set(val);
  }

  exportJson(): void {
    this.backupService.exportToJson();
  }

  triggerImport(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      await this.backupService.importFromJson(input.files[0]);
      input.value = '';
    }
  }

  sendEmailBackup(): void {
    if (!this.backupEmail()) {
      this.toast.error('Ingresa tu correo electrónico');
      return;
    }
    this.backupService.sendBackupByEmail(this.backupEmail());
  }
}
