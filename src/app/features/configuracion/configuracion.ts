import { ChangeDetectionStrategy, Component, signal, inject, ViewChild, ElementRef, OnInit } from '@angular/core';
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
import { I18nService } from '../../core/services/i18n.service';
import { createWorker } from 'tesseract.js';
import { environment } from '../../../environments/environment';

interface BackupEntry {
  name: string;
  size: number;
  date: string;
}

@Component({
  selector: 'sec-configuracion',
  imports: [CommonModule, FormsModule],
  templateUrl: './configuracion.html',
  styleUrl: './configuracion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Configuracion implements OnInit {
  private readonly tasaService = inject(TasaCambioService);
  protected readonly backupService = inject(BackupService);
  private readonly toast = inject(ToastService);
  private readonly groqAi = inject(GroqAiService);
  private readonly geminiAi = inject(GeminiAiService);
  protected readonly licenseService = inject(LicenseService);
  protected readonly settingsService = inject(SettingsService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);
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

  // Backup ZIP state
  protected readonly isCreatingBackup = signal(false);
  protected readonly backupList = signal<BackupEntry[]>([]);
  protected readonly backupEnabled = signal(false);
  protected readonly backupIntervalHours = signal(24);
  protected readonly backupMaxFiles = signal(10);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private readonly API = 'http://localhost:3000';

  ngOnInit(): void {
    this.loadBackupList();
    this.loadScheduleSettings();
  }

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

  // ═══ ZIP Backup Methods ═══

  async createZipBackup(): Promise<void> {
    this.isCreatingBackup.set(true);
    try {
      const res = await fetch(`${this.API}/api/backup/create`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.toast.success('Respaldo ZIP creado exitosamente.');
        this.loadBackupList();
      } else {
        this.toast.error('Error al crear respaldo: ' + (data.error || 'Unknown'));
      }
    } catch (e: any) {
      this.toast.error('Error de conexión al crear respaldo.');
    } finally {
      this.isCreatingBackup.set(false);
    }
  }

  async loadBackupList(): Promise<void> {
    try {
      const res = await fetch(`${this.API}/api/backup/list`);
      const data = await res.json();
      this.backupList.set(data.backups || []);
    } catch {
      // Server might not be running in dev
    }
  }

  async loadScheduleSettings(): Promise<void> {
    try {
      const res = await fetch(`${this.API}/api/backup/schedule`);
      const data = await res.json();
      this.backupEnabled.set(data.enabled || false);
      this.backupIntervalHours.set(data.intervalHours || 24);
      this.backupMaxFiles.set(data.maxBackups || 10);
    } catch {
      // Server might not be running
    }
  }

  async toggleScheduledBackup(event: Event): Promise<void> {
    const enabled = (event.target as HTMLInputElement).checked;
    this.backupEnabled.set(enabled);
    await this.saveScheduleSettings();
  }

  setBackupInterval(hours: number): void {
    this.backupIntervalHours.set(Number(hours));
  }

  setBackupMax(max: number): void {
    this.backupMaxFiles.set(Number(max));
  }

  async saveScheduleSettings(): Promise<void> {
    try {
      await fetch(`${this.API}/api/backup/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: this.backupEnabled(),
          intervalHours: this.backupIntervalHours(),
          maxBackups: this.backupMaxFiles()
        })
      });
      this.toast.success('Configuración de respaldo guardada.');
    } catch {
      this.toast.error('Error al guardar configuración de respaldo.');
    }
  }

  downloadBackup(filename: string): void {
    window.open(`${this.API}/api/backup/download/${filename}`, '_blank');
  }

  async deleteBackup(filename: string): Promise<void> {
    if (!confirm('¿Eliminar este respaldo?')) return;
    try {
      await fetch(`${this.API}/api/backup/${filename}`, { method: 'DELETE' });
      this.toast.info('Respaldo eliminado.');
      this.loadBackupList();
    } catch {
      this.toast.error('Error al eliminar respaldo.');
    }
  }

  async restoreBackup(filename: string): Promise<void> {
    if (!confirm('¿Restaurar la base de datos desde este respaldo? La aplicación necesitará reiniciarse.')) return;
    try {
      const res = await fetch(`${this.API}/api/backup/restore/${filename}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        this.toast.success('Base de datos restaurada. Reinicia la aplicación.');
      } else {
        this.toast.error('Error: ' + (data.error || 'Unknown'));
      }
    } catch {
      this.toast.error('Error al restaurar respaldo.');
    }
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ═══ RIF Scanner ═══

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
