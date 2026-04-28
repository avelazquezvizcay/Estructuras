import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'sec-reportes',
  templateUrl: './reportes.html',
  styleUrl: './reportes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Reportes {
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
}
