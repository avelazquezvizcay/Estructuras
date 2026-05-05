import { ChangeDetectionStrategy, Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InsumoService } from '../../core/services/insumo.service';
import { CompraService, ItemCompra } from '../../core/services/compra.service';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';
import { ToastService } from '../../core/services/toast.service';
import { Modal } from '../../shared/modal/modal';
import Decimal from 'decimal.js';
import { createWorker } from 'tesseract.js';
import { GroqAiService } from '../../core/services/groq-ai.service';
import { GeminiAiService } from '../../core/services/gemini-ai.service';
import { SettingsService } from '../../core/services/settings.service';
import { AuthService } from '../../core/services/auth.service';
import { I18nService } from '../../core/services/i18n.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'sec-compras',
  standalone: true,
  imports: [CommonModule, FormsModule, Modal],
  templateUrl: './compras.html',
  styleUrl: './compras.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Compras implements OnInit {
  protected readonly insumoService = inject(InsumoService);
  protected readonly compraService = inject(CompraService);
  protected readonly tasaService = inject(TasaCambioService);
  private readonly groqAi = inject(GroqAiService);
  private readonly geminiAi = inject(GeminiAiService);
  protected readonly settingsService = inject(SettingsService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);

  // UI State
  protected readonly showModal = signal(false);
  protected readonly showDeleteModal = signal(false);
  protected readonly selectedCompraId = signal<string | null>(null);
  protected readonly deleteMotivo = signal('');
  protected readonly isScanning = signal(false);
  protected readonly imagePreviewUrl = signal<string | null>(null);

  // Form State
  protected readonly formProveedor = signal('');
  protected readonly formFecha = signal(new Date().toISOString().split('T')[0]);
  protected readonly formMetodoPago = signal('Efectivo');
  protected readonly formItems = signal<ItemCompra[]>([]);
  protected readonly formTasa = signal<number>(1);

  // Computed totals
  protected readonly totalCompraUsd = computed(() => {
    return this.formItems().reduce((sum, item) => sum.plus(item.subtotalUsd), new Decimal(0));
  });

  ngOnInit() {
    this.compraService.loadCompras();
  }

  openNuevaCompra() {
    this.formProveedor.set('');
    this.formFecha.set(new Date().toISOString().split('T')[0]);
    this.formItems.set([]);
    this.formTasa.set(this.tasaService.tasaActiva()?.valor.toNumber() || 1);
    this.formMetodoPago.set(this.settingsService.metodosPago()[0] || 'Efectivo');
    this.imagePreviewUrl.set(null);
    this.showModal.set(true);
  }

  addItem() {
    const allInsumos = this.insumoService.insumos();
    const firstInsumo = allInsumos[0];
    
    this.formItems.update(list => [
      ...list,
      {
        insumoId: firstInsumo?.id || '',
        nombre: firstInsumo?.nombre || 'Seleccionar insumo...',
        cantidad: 1,
        costoUnitarioUsd: firstInsumo?.costoUnidadBaseUsd.toString() || '0',
        subtotalUsd: firstInsumo?.costoUnidadBaseUsd.toString() || '0'
      }
    ]);
  }

  updateItem(index: number, field: keyof ItemCompra, value: any) {
    this.formItems.update(list => {
      const newList = [...list];
      const item = { ...newList[index], [field]: value };
      
      // Auto-update subtotal
      if (field === 'cantidad' || field === 'costoUnitarioUsd') {
        item.subtotalUsd = new Decimal(item.costoUnitarioUsd).mul(item.cantidad).toString();
      }
      
      // Auto-update name if insumoId changed
      if (field === 'insumoId') {
        const ins = this.insumoService.getById(value);
        if (ins) {
          item.nombre = ins.nombre;
          item.costoUnitarioUsd = ins.costoUnidadBaseUsd.toString();
          item.subtotalUsd = new Decimal(item.costoUnitarioUsd).mul(item.cantidad).toString();
        }
      }

      newList[index] = item;
      return newList;
    });
  }

  removeItem(index: number) {
    this.formItems.update(list => list.filter((_, i) => i !== index));
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) {
      this.imagePreviewUrl.set(null);
      return;
    }

    // Set preview URL
    const previewUrl = URL.createObjectURL(file);
    this.imagePreviewUrl.set(previewUrl);

    this.isScanning.set(true);
    this.toast.info('Analizando factura con IA...');

    try {
      const insumosSimples = this.insumoService.insumos().map(i => ({ id: i.id, nombre: i.nombre }));
      const tasaVenta = this.formTasa();

      // 1. Intentar con GEMINI (Visión directa) si hay API Key
      if (environment.geminiApiKey) {
        this.toast.info('Gemini analizando imagen directamente...');
        const base64 = await this.fileToBase64(file);
        const result = await this.geminiAi.analyzeInvoiceImage(base64, insumosSimples, tasaVenta);
        
        if (result && result.items && result.items.length > 0) {
          this.formItems.set(result.items);
          if (result.proveedor && result.proveedor !== 'Nombre del Supermercado o Tienda') {
            this.formProveedor.set(result.proveedor);
          }
          if (result.fecha && result.fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
            this.formFecha.set(result.fecha);
          }
          this.toast.success('Gemini detectó los productos exitosamente.');
          this.isScanning.set(false);
          return;
        }
      }

      // 2. Fallback a OCR Local + Groq (Lo que teníamos antes)
      this.toast.info('Usando OCR local + Groq...');
      const worker = await createWorker('spa'); 
      const { data: { text } } = await worker.recognize(file);
      console.log('--- OCR EXTRACTED TEXT ---');
      console.log(text);
      console.log('--------------------------');
      await worker.terminate();

      const detectedItems = await this.groqAi.parseInvoiceText(text, insumosSimples, tasaVenta);

      if (detectedItems && detectedItems.length > 0) {
        this.formItems.set(detectedItems);
        this.toast.success('IA detectó los productos exitosamente.');
      } else {
        this.parseOCRText(text);
      }
    } catch (error) {
      console.error(error);
      this.toast.error('Error al leer la imagen. Intenta con una foto más clara.');
    } finally {
      this.isScanning.set(false);
    }
  }

  private parseOCRText(text: string) {
    console.log('Texto detectado:', text);
    const lines = text.split('\n');
    const detectedItems: ItemCompra[] = [];
    const allInsumos = this.insumoService.insumos();

    // Intentar extraer proveedor (primera línea no vacía suele ser el nombre)
    const possibleProvider = lines.find(l => l.trim().length > 5);
    if (possibleProvider) this.formProveedor.set(possibleProvider.trim());

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      // Buscar coincidencia de nombre de insumo en la línea
      const matchedInsumo = allInsumos.find(ins => 
        lowerLine.includes(ins.nombre.toLowerCase())
      );

      if (matchedInsumo) {
        // Intentar buscar números en la línea (cantidad y precio)
        const numbers = line.match(/\d+[.,]\d+/g) || line.match(/\d+/g);
        
        if (numbers && numbers.length >= 1) {
          const cantidad = parseFloat(numbers[0].replace(',', '.'));
          const precio = numbers[1] ? parseFloat(numbers[1].replace(',', '.')) : parseFloat(matchedInsumo.costoUnidadBaseUsd.toString());

          detectedItems.push({
            insumoId: matchedInsumo.id,
            nombre: matchedInsumo.nombre,
            cantidad: cantidad,
            costoUnitarioUsd: precio.toString(),
            subtotalUsd: new Decimal(precio).mul(cantidad).toString()
          });
        }
      }
    }

    if (detectedItems.length > 0) {
      this.formItems.set(detectedItems);
    } else {
      this.toast.warning('No se detectaron productos conocidos. Intenta cargarlos manualmente.');
    }
  }

  aceptarSugerencia(index: number) {
    const item = this.formItems()[index];
    if (item.sugerenciaId) {
      this.updateItem(index, 'insumoId', item.sugerenciaId);
      // Limpiamos la sugerencia una vez aceptada
      this.updateItem(index, 'sugerenciaId', undefined);
      this.updateItem(index, 'sugerenciaNombre', undefined);
      this.toast.success('Producto vinculado correctamente');
    }
  }

  async guardarCompra() {
    if (!this.formProveedor() || this.formItems().length === 0) {
      this.toast.error('Datos incompletos');
      return;
    }

    const tasa = this.formTasa();

    try {
      await this.compraService.registrarCompra({
        proveedor: this.formProveedor(),
        fecha: this.formFecha(),
        items: this.formItems(),
        tasaUsd: tasa,
        metodoPago: this.formMetodoPago()
      });
      this.showModal.set(false);
    } catch (error) {
      // El error ya fue notificado por el servicio
      console.error('Error en guardarCompra:', error);
    }
  }

  async executeDelete() {
    const id = this.selectedCompraId();
    if (!id) return;

    await this.compraService.eliminarCompra(id);
    this.showDeleteModal.set(false);
    this.selectedCompraId.set(null);
    this.deleteMotivo.set('');
  }

  confirmDelete(id: string) {
    this.selectedCompraId.set(id);
    this.deleteMotivo.set('');
    this.showDeleteModal.set(true);
  }

  parseItems(json: string): ItemCompra[] {
    try {
      return JSON.parse(json);
    } catch {
      return [];
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
