import { ChangeDetectionStrategy, Component, signal, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TipoTasa } from '../../core/models/domain.models';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';
import { BackupService } from '../../core/services/backup.service';
import { ToastService } from '../../core/services/toast.service';
import { GroqAiService } from '../../core/services/groq-ai.service';
import { GeminiAiService } from '../../core/services/gemini-ai.service';
import { LicenseService } from '../../core/services/license.service';
import { SettingsService } from '../../core/services/settings.service';
import { AuthService } from '../../core/services/auth.service';
import { createWorker } from 'tesseract.js';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'sec-configuracion',
  imports: [CommonModule, FormsModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Configuracion {
  private readonly tasaService = inject(TasaCambioService);
  protected readonly backupService = inject(BackupService);
  private readonly toast = inject(ToastService);
  private readonly groqAi = inject(GroqAiService);
  private readonly geminiAi = inject(GeminiAiService);
  protected readonly licenseService = inject(LicenseService);
  protected readonly settingsService = inject(SettingsService);
  protected readonly auth = inject(AuthService);
  protected readonly isScanningRif = signal(false);
  protected readonly nuevoMetodo = signal('');

  protected readonly monedaPrincipal = signal<'USD' | 'VES'>('USD');
  protected readonly tasaPreferida = signal<TipoTasa>('BCV_USD');
  protected readonly decimales = signal(2);
  protected readonly idioma = signal('es');
  protected readonly backupEmail = signal('');

  // Perfil de la Empresa
  protected readonly empresaNombre = signal(localStorage.getItem('empresaNombre') || '');
  protected readonly empresaRif = signal(localStorage.getItem('empresaRif') || '');
  protected readonly empresaDireccion = signal(localStorage.getItem('empresaDireccion') || '');
  protected readonly empresaLogo = signal(localStorage.getItem('empresaLogo') || '');

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

  guardarDatosEmpresa(): void {
    localStorage.setItem('empresaNombre', this.empresaNombre());
    localStorage.setItem('empresaRif', this.empresaRif());
    localStorage.setItem('empresaDireccion', this.empresaDireccion());
    localStorage.setItem('empresaLogo', this.empresaLogo());
    this.toast.success('Datos de la empresa guardados correctamente.');
  }

  onLogoSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.empresaLogo.set(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  addMetodoPago(): void {
    if (this.nuevoMetodo().trim()) {
      this.settingsService.addMethod(this.nuevoMetodo().trim());
      this.nuevoMetodo.set('');
      this.toast.success('Método de pago añadido.');
    }
  }

  removeMetodoPago(metodo: string): void {
    this.settingsService.removeMethod(metodo);
    this.toast.info('Método de pago eliminado.');
  }

  async onRifFileSelected(event: any): Promise<void> {
    const file = event.target.files[0];
    if (!file) return;

    this.isScanningRif.set(true);
    this.toast.info('Analizando imagen del RIF...');

    try {
      const base64 = await this.fileToBase64(file);
      
      // 1. Intentar con GEMINI Vision
      if (environment.geminiApiKey) {
        const data = await this.geminiAi.analyzeRifImage(base64);
        
        if (data) {
          if (data.nombre) this.empresaNombre.set(data.nombre);
          if (data.rif) this.empresaRif.set(data.rif);
          if (data.direccion) this.empresaDireccion.set(data.direccion);
          this.toast.success('Datos extraídos exitosamente.');
          return;
        }
      }

      // 2. Fallback a Tesseract + Groq
      const worker = await createWorker('spa');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      const promptGroq = `Extrae Nombre, RIF y Dirección de este texto: "${text}". Devuelve JSON: { "nombre": "...", "rif": "...", "direccion": "..." }`;
      const responseGroq = await this.groqAi.generateContent(promptGroq);
      const dataGroq = this.parseJsonResponse(responseGroq);

      if (dataGroq) {
        if (dataGroq.nombre) this.empresaNombre.set(dataGroq.nombre);
        if (dataGroq.rif) this.empresaRif.set(dataGroq.rif);
        if (dataGroq.direccion) this.empresaDireccion.set(dataGroq.direccion);
        this.toast.success('Datos extraídos con OCR.');
      } else {
        this.toast.warning('No se pudieron extraer los datos automáticamente.');
      }
    } catch (error) {
      this.toast.error('Error al procesar la imagen.');
    } finally {
      this.isScanningRif.set(false);
    }
  }

  private parseJsonResponse(text: string): any {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? JSON.parse(match[0]) : null;
    } catch {
      return null;
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }
}
