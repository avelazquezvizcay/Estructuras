import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'sec-reportes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reportes.html',
  styleUrl: './reportes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Reportes {
  private readonly toast = inject(ToastService);

  protected readonly reportes = signal([
    {
      id: 'cost-structure',
      nombre: 'Estructura de Costos',
      descripcion: 'Desglose completo del costo de producción por producto, incluyendo cada insumo y su peso en el costo total.',
      icono: 'pie_chart',
      color: 'primary'
    },
    {
      id: 'price-list',
      nombre: 'Lista de Precios',
      descripcion: 'Listado de todos los productos con sus precios de venta en USD y Bs según la tasa seleccionada.',
      icono: 'request_quote',
      color: 'success'
    },
    {
      id: 'insumo-usage',
      nombre: 'Uso de Insumos',
      descripcion: 'Análisis de qué insumos son más utilizados en recetas y su impacto en costos.',
      icono: 'analytics',
      color: 'info'
    },
    {
      id: 'margin-analysis',
      nombre: 'Análisis de Márgenes',
      descripcion: 'Comparativa de márgenes de utilidad entre productos para identificar los más rentables.',
      icono: 'monitoring',
      color: 'warning'
    },
    {
      id: 'rate-history',
      nombre: 'Histórico de Tasas',
      descripcion: 'Evolución de las tasas de cambio BCV, Binance y Euro a lo largo del tiempo.',
      icono: 'show_chart',
      color: 'purple'
    },
    {
      id: 'ficha-tecnica',
      nombre: 'Ficha Técnica',
      descripcion: 'Documento imprimible con la ficha técnica completa de un producto seleccionado.',
      icono: 'description',
      color: 'danger'
    }
  ]);

  exportar(tipo: string): void {
    this.toast.info(`La exportación a ${tipo} está en desarrollo.`);
  }
}
