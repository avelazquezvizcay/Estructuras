import { ChangeDetectionStrategy, Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GeminiAiService } from '../../core/services/gemini-ai.service';
import { ProductoService } from '../../core/services/producto.service';
import { InsumoService } from '../../core/services/insumo.service';
import { I18nService } from '../../core/services/i18n.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'sec-asesor-ia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asesor-ia.html',
  styleUrl: './asesor-ia.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AsesorIa implements OnInit {
  protected readonly aiService = inject(GeminiAiService);
  private readonly productoService = inject(ProductoService);
  private readonly insumoService = inject(InsumoService);
  protected readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly advice = signal<string>('');
  protected readonly formattedAdvice = signal<string>('');

  ngOnInit(): void {
    // Optionally trigger analysis automatically or wait for user click
  }

  async analyzeBusiness(): Promise<void> {
    if (this.aiService.isLoading()) return;

    this.toast.info('Recopilando datos del negocio y contactando a la IA...');
    
    // Prepare business data context
    const productos = this.productoService.productos().map(p => ({
      nombre: p.nombre,
      categoria: p.categoria,
      costo: p.costoTotalUsd,
      precio: p.precios[0]?.precioUsd || 0,
      margenPct: p.precios[0]?.margenPct || 0
    }));

    const insumosAlertas = this.insumoService.lowStockInsumos().map(i => ({
      nombre: i.nombre,
      stockActual: i.stockActual,
      stockMinimo: i.stockMinimo
    }));

    const contextData = JSON.stringify({
      resumen_productos: productos,
      alertas_inventario: insumosAlertas
    }, null, 2);

    try {
      const response = await this.aiService.generateFinancialAdvice(contextData);
      this.advice.set(response);
      this.formatMarkdown(response);
      this.toast.success('Análisis completado');
    } catch (error) {
      this.toast.error('Error al generar el análisis');
    }
  }

  private formatMarkdown(text: string) {
    // Very basic markdown to HTML converter for bold and line breaks
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
    
    html = `<p>${html}</p>`;
    // Convert lists
    html = html.replace(/<p>- (.*?)<\/p>/g, '<ul><li>$1</li></ul>');
    html = html.replace(/<br>- (.*?)/g, '<li>$1</li>');
    html = html.replace(/<\/ul><ul>/g, ''); // merge adjacent lists

    this.formattedAdvice.set(html);
  }
}
