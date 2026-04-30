import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import Decimal from 'decimal.js';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../core/services/toast.service';
import { ProductoService } from '../../core/services/producto.service';
import { InsumoService } from '../../core/services/insumo.service';
import { ExportService } from '../../core/services/export.service';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';

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
  protected readonly productoService = inject(ProductoService);
  private readonly exportService = inject(ExportService);
  private readonly tasaService = inject(TasaCambioService);
  private readonly insumoService = inject(InsumoService);

  protected readonly activeReport = signal<string | null>(null);

  protected readonly totalInventarioUsd = computed(() => {
    return this.insumoService.insumos().reduce((total, i) => {
      return total.plus(i.costoUnidadBaseUsd.mul(i.stockActual));
    }, new Decimal(0));
  });

  protected readonly totalInsumosStock = computed(() => {
    return this.insumoService.insumos().filter(i => i.stockActual > 0).length;
  });

  protected readonly promedioMargen = computed(() => {
    const prods = this.productoService.productos();
    if (!prods.length) return 0;
    const sum = prods.reduce((acc, p) => acc + parseFloat(p.precios[0]?.margenPct || '0'), 0);
    return (sum / prods.length).toFixed(1);
  });

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
      id: 'inventory-value',
      nombre: 'Valorización de Inventario',
      descripcion: 'Cálculo del valor total de tus insumos en stock. Ideal para balances mensuales.',
      icono: 'inventory',
      color: 'warning'
    },
    {
      id: 'price-inflation',
      nombre: 'Historial de Inflación',
      descripcion: 'Seguimiento de la variación de precios de tus insumos en el tiempo.',
      icono: 'trending_up',
      color: 'danger'
    }
  ]);

  exportar(tipo: string, id: string): void {
    if (id === 'price-list') {
      this.exportarListaPrecios(tipo);
    } else if (id === 'cost-structure') {
      this.exportarEstructuraCostos(tipo);
    } else if (id === 'inventory-value') {
      this.exportarValorInventario(tipo);
    } else if (id === 'price-inflation') {
      this.exportarInflacion(tipo);
    } else {
      this.toast.info(`La exportación de "${id}" a ${tipo} está en desarrollo.`);
    }
  }

  private exportarListaPrecios(tipo: string): void {
    const productos = this.productoService.productos();
    const tasa = this.tasaService.tasaBcv()?.valor || 1;

    if (tipo === 'CSV' || tipo === 'Excel') {
      const headers = ['Producto', 'Categoría', 'Costo (USD)', 'Detalle (USD)', 'Detalle (BS)', 'Mayor (USD)', 'Super Mayor (USD)'];
      const rows = productos.map(p => [
        p.nombre,
        p.categoria,
        p.costoTotalUsd.toFixed(2),
        p.precios[0]?.precioUsd || '0',
        new Decimal(p.precios[0]?.precioUsd || '0').mul(tasa).toFixed(2),
        p.precios[1]?.precioUsd || '0',
        p.precios[2]?.precioUsd || '0'
      ]);
      this.exportService.exportToCsv('Lista_de_Precios', [headers, ...rows]);
      this.toast.success('Lista de precios exportada exitosamente (CSV/Excel)');
    } else if (tipo === 'PDF') {
      const headers = ['Producto', 'Categoría', 'Costo (USD)', 'Detalle (USD)', 'Detalle (BS)', 'Mayor (USD)', 'Super Mayor (USD)'];
      const rows = productos.map(p => [
        p.nombre, p.categoria, p.costoTotalUsd.toFixed(2), p.precios[0]?.precioUsd || '0', new Decimal(p.precios[0]?.precioUsd || '0').mul(tasa).toFixed(2), p.precios[1]?.precioUsd || '0', p.precios[2]?.precioUsd || '0'
      ]);
      this.exportService.exportToPdf('Lista_de_Precios', 'Lista de Precios', headers, rows);
      this.toast.success('Lista de precios exportada a PDF');
    } else {
      this.toast.info('Vista previa interactiva en desarrollo');
    }
  }

  private exportarEstructuraCostos(tipo: string): void {
    const productos = this.productoService.productos();
    if (tipo === 'CSV' || tipo === 'Excel') {
      const rows: string[][] = [['Estructura de Costos Completa'], []];
      
      productos.forEach(p => {
        rows.push([`Producto: ${p.nombre}`, `Categoría: ${p.categoria}`]);
        rows.push(['Insumo', 'Cantidad', 'Costo Línea (USD)']);
        p.receta.forEach(r => {
          rows.push([r.insumoNombre, `${r.cantidad} ${r.unidad}`, r.costoLineaUsd.toFixed(2)]);
        });
        rows.push(['', 'TOTAL COSTO:', p.costoTotalUsd.toFixed(2)]);
        rows.push([]); // Espacio en blanco
      });

      this.exportService.exportToCsv('Estructura_de_Costos', rows);
      this.toast.success('Estructura de costos exportada exitosamente (CSV/Excel)');
    } else if (tipo === 'PDF') {
      const headers = ['Producto / Insumo', 'Categoría / Cantidad', 'Costo Línea (USD)'];
      const rows: string[][] = [];
      productos.forEach(p => {
        rows.push([`Producto: ${p.nombre}`, `Categoría: ${p.categoria}`, '']);
        p.receta.forEach(r => {
          rows.push([`  - ${r.insumoNombre}`, `${r.cantidad} ${r.unidad}`, r.costoLineaUsd.toFixed(2)]);
        });
        rows.push(['', 'TOTAL COSTO:', p.costoTotalUsd.toFixed(2)]);
        rows.push(['-', '-', '-']);
      });
      this.exportService.exportToPdf('Estructura_de_Costos', 'Estructura de Costos', headers, rows);
      this.toast.success('Estructura de costos exportada a PDF');
    } else {
      this.toast.info('Vista previa interactiva en desarrollo');
    }
  }

  private exportarValorInventario(tipo: string): void {
    const insumos = this.insumoService.insumos();
    const headers = ['Insumo', 'Categoría', 'Stock Actual', 'Unidad', 'Costo Unitario (USD)', 'Valor Total (USD)'];
    let totalInversion = new Decimal(0);

    const rows = insumos.map(i => {
      const valor = i.costoUnidadBaseUsd.mul(i.stockActual);
      totalInversion = totalInversion.plus(valor);
      return [
        i.nombre,
        i.categoria,
        i.stockActual.toString(),
        i.unidadBase,
        i.costoUnidadBaseUsd.toFixed(4),
        valor.toFixed(2)
      ];
    });

    rows.push(['', '', '', '', 'VALOR TOTAL:', totalInversion.toFixed(2)]);

    if (tipo === 'CSV' || tipo === 'Excel') {
      this.exportService.exportToCsv('Valorizacion_Inventario', [headers, ...rows]);
      this.toast.success('Reporte de inventario generado (CSV/Excel)');
    } else if (tipo === 'PDF') {
      this.exportService.exportToPdf('Valorizacion_Inventario', 'Valorización de Inventario', headers, rows);
      this.toast.success('Reporte de inventario generado a PDF');
    } else {
      this.toast.info('Vista previa interactiva en desarrollo');
    }
  }

  private async exportarInflacion(tipo: string): Promise<void> {
    const insumos = this.insumoService.insumos();
    const rows: string[][] = [['Insumo', 'Fecha', 'Costo Base (USD)', 'Variación %']];

    for (const ins of insumos) {
      const history = await this.insumoService.getPriceHistory(ins.id);
      if (history.length < 2) continue;

      history.forEach((h, index) => {
        let variacion = '0%';
        if (index > 0) {
          const prev = new Decimal(history[index - 1].costoUnidadBaseUsd);
          const curr = new Decimal(h.costoUnidadBaseUsd);
          variacion = curr.minus(prev).div(prev).mul(100).toFixed(2) + '%';
        }
        rows.push([ins.nombre, h.fecha.split('T')[0], h.costoUnidadBaseUsd, variacion]);
      });
      rows.push([]); // Espacio entre insumos
    }

    if (tipo === 'CSV' || tipo === 'Excel') {
      this.exportService.exportToCsv('Historial_Inflacion', rows);
      this.toast.success('Reporte de inflación generado (CSV/Excel)');
    } else if (tipo === 'PDF') {
      const headers = ['Insumo', 'Fecha', 'Costo Base (USD)', 'Variación %'];
      const pdfRows = rows.filter(r => r.length > 0 && r[0] !== 'Insumo');
      this.exportService.exportToPdf('Historial_Inflacion', 'Historial de Inflación', headers, pdfRows);
      this.toast.success('Reporte de inflación generado a PDF');
    } else {
      this.toast.info('Vista previa interactiva en desarrollo');
    }
  }

  private exportarProyeccion(tipo: string): void {
    const productos = this.productoService.productos();
    const headers = ['Producto', 'Costo (USD)', 'Precio Venta (USD)', 'Utilidad x Unidad (USD)', 'Margen %'];
    
    const rows = productos.map(p => {
      const precio = new Decimal(p.precios[0]?.precioUsd || '0');
      const utilidad = precio.minus(p.costoTotalUsd);
      return [
        p.nombre,
        p.costoTotalUsd.toFixed(2),
        precio.toFixed(2),
        utilidad.toFixed(2),
        p.precios[0]?.margenPct + '%'
      ];
    });

    if (tipo === 'CSV' || tipo === 'Excel') {
      this.exportService.exportToCsv('Proyeccion_Ganancias', [headers, ...rows]);
      this.toast.success('Reporte de ganancias generado (CSV/Excel)');
    } else if (tipo === 'PDF') {
      this.exportService.exportToPdf('Proyeccion_Ganancias', 'Proyección de Ganancias', headers, rows);
      this.toast.success('Reporte de ganancias generado a PDF');
    } else {
      this.toast.info('Vista previa interactiva en desarrollo');
    }
  }
}
