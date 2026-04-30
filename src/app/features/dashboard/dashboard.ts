import { ChangeDetectionStrategy, Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';
import { InsumoService } from '../../core/services/insumo.service';
import { ProductoService } from '../../core/services/producto.service';
import { NotificationService } from '../../core/services/notification.service';
import { DashboardKpi } from '../../core/models/domain.models';

import { RouterLink } from '@angular/router';
import { ChartComponent } from '../../shared/components/chart/chart';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'sec-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ChartComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Dashboard {
  protected readonly tasaService = inject(TasaCambioService);
  protected readonly insumoService = inject(InsumoService);
  protected readonly productoService = inject(ProductoService);
  protected readonly notifService = inject(NotificationService);

  protected readonly kpis = computed<DashboardKpi[]>(() => [
    {
      label: 'Productos Registrados',
      value: this.productoService.count().toString(),
      subvalue: 'Activos en catálogo',
      icon: 'bakery_dining',
      trend: 'up',
      trendValue: '',
      color: 'primary'
    },
    {
      label: 'Insumos Activos',
      value: this.insumoService.count().toString(),
      subvalue: `${this.insumoService.categorias().length - 1} categorías`,
      icon: 'inventory_2',
      trend: 'up',
      trendValue: '',
      color: 'success'
    },
    {
      label: 'Costo Promedio',
      value: `$${this.productoService.promedioCosto().toFixed(2)}`,
      subvalue: 'por producto',
      icon: 'trending_up',
      trend: 'neutral',
      trendValue: '',
      color: 'warning'
    },
    {
      label: 'Margen Promedio',
      value: `${this.productoService.promedioMargen().toFixed(0)}%`,
      subvalue: 'de utilidad',
      icon: 'percent',
      trend: 'neutral',
      trendValue: '',
      color: 'info'
    }
  ]);

  protected readonly filtroProductos = signal<'mayor_margen' | 'menor_costo'>('mayor_margen');

  protected readonly productosFiltrados = computed(() => {
    return this.filtroProductos() === 'mayor_margen' 
      ? this.productoService.topPorMargen() 
      : this.productoService.menorCosto();
  });

  protected readonly topInsumos = computed(() => {
    return this.insumoService.insumos().slice(0, 5).map(i => ({
      nombre: i.nombre,
      categoria: i.categoria,
      costo: `$${i.costoUnidadBaseUsd.toFixed(4)}/${i.unidadBase}`
    }));
  });

  protected readonly chartCostos = computed<ChartConfiguration>(() => {
    const prods = this.productoService.productos().slice(0, 7);
    return {
      type: 'bar',
      data: {
        labels: prods.map(p => p.nombre.length > 15 ? p.nombre.substring(0, 12) + '...' : p.nombre),
        datasets: [
          {
            label: 'Costo (USD)',
            data: prods.map(p => p.costoTotalUsd.toNumber()),
            backgroundColor: 'rgba(99, 102, 241, 0.5)',
            borderColor: '#6366f1',
            borderWidth: 1
          },
          {
            label: 'Venta (USD)',
            data: prods.map(p => parseFloat(p.precios[0]?.precioUsd || '0')),
            backgroundColor: 'rgba(34, 197, 94, 0.5)',
            borderColor: '#22c55e',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    };
  });

  protected readonly chartCategorias = computed<ChartConfiguration>(() => {
    const counts: Record<string, number> = {};
    this.productoService.productos().forEach(p => {
      counts[p.categoria] = (counts[p.categoria] || 0) + 1;
    });

    return {
      type: 'doughnut',
      data: {
        labels: Object.keys(counts),
        datasets: [{
          data: Object.values(counts),
          backgroundColor: [
            '#6366f1', '#22c55e', '#f59e0b', '#06b6d4', '#a855f7', '#ef4444'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right' }
        }
      }
    };
  });

  protected readonly chartRentabilidad = computed<ChartConfiguration>(() => {
    const prods = this.productoService.productos().slice(0, 5);
    return {
      type: 'radar',
      data: {
        labels: prods.map(p => p.nombre),
        datasets: [
          {
            label: 'Margen (%)',
            data: prods.map(p => parseFloat(p.precios[0]?.margenPct || '0')),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
          },
          {
            label: 'Costo Relativo (x10)',
            data: prods.map(p => p.costoTotalUsd.toNumber() * 10),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    };
  });

  protected readonly chartTendenciaTasas = computed<ChartConfiguration>(() => {
    return {
      type: 'line',
      data: {
        labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
        datasets: [
          {
            label: 'BCV (Bs)',
            data: [78.5, 79.2, 80.1, 82.5, 84.0, 85.2, 86.89],
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Binance (Bs)',
            data: [80.1, 81.5, 82.0, 85.0, 86.2, 88.0, 89.5],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    };
  });

  protected readonly actividadReciente = signal([

    { tipo: 'update', texto: 'Se actualizó el costo de Harina de Trigo', tiempo: 'Hace 2 horas', icono: 'edit', color: 'primary' },
    { tipo: 'create', texto: 'Nuevo producto: Brownie Premium', tiempo: 'Hace 5 horas', icono: 'add_circle', color: 'success' },
    { tipo: 'rate', texto: 'Tasa BCV actualizada a 86.89 Bs/$', tiempo: 'Hace 8 horas', icono: 'currency_exchange', color: 'warning' },
    { tipo: 'delete', texto: 'Se eliminó receta duplicada de Pan de Jamón', tiempo: 'Ayer', icono: 'delete', color: 'danger' },
    { tipo: 'create', texto: 'Nuevo insumo: Cacao en Polvo Premium', tiempo: 'Ayer', icono: 'add_circle', color: 'success' },
  ]);

  protected getKpiGradient(color: string): string {
    const gradients: Record<string, string> = {
      'primary': 'linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(168, 85, 247, 0.06))',
      'success': 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.06))',
      'warning': 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(234, 88, 12, 0.06))',
      'info': 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(59, 130, 246, 0.06))',
      'purple': 'linear-gradient(135deg, rgba(168, 85, 247, 0.12), rgba(236, 72, 153, 0.06))',
      'danger': 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(244, 63, 94, 0.06))'
    };
    return gradients[color] || gradients['primary'];
  }

  protected getKpiIconBg(color: string): string {
    const bgs: Record<string, string> = {
      'primary': 'var(--accent-primary-subtle)',
      'success': 'var(--accent-success-subtle)',
      'warning': 'var(--accent-warning-subtle)',
      'info': 'var(--accent-info-subtle)',
      'purple': 'var(--accent-purple-subtle)',
      'danger': 'var(--accent-danger-subtle)'
    };
    return bgs[color] || bgs['primary'];
  }

  protected getKpiIconColor(color: string): string {
    const colors: Record<string, string> = {
      'primary': 'var(--accent-primary-light)',
      'success': 'var(--accent-success-light)',
      'warning': 'var(--accent-warning-light)',
      'info': 'var(--accent-info-light)',
      'purple': 'var(--accent-purple)',
      'danger': 'var(--accent-danger-light)'
    };
    return colors[color] || colors['primary'];
  }

  protected exportarDashboard() {
    this.notifService.add('Exportación', 'Generando archivo de reporte...', 'info');
    
    // 1. Recopilar datos de productos
    const productos = this.productoService.productos();
    let csvContent = "REPORTE GENERAL DE PRODUCTOS\n";
    csvContent += "Nombre,Categoria,Costo_Total_USD,Precio_Venta_USD,Margen_%\n";
    
    productos.forEach(p => {
      const precioUsd = p.precios[0]?.precioUsd || '0';
      const margen = p.precios[0]?.margenPct || '0';
      csvContent += `"${p.nombre}","${p.categoria}",${p.costoTotalUsd.toFixed(4)},${precioUsd},${margen}\n`;
    });

    // 2. Recopilar datos de Insumos
    const insumos = this.insumoService.insumos();
    csvContent += "\nREPORTE GENERAL DE INSUMOS\n";
    csvContent += "Nombre,Categoria,Stock_Actual,Stock_Minimo,Costo_Base_USD,Unidad\n";
    
    insumos.forEach(i => {
      csvContent += `"${i.nombre}","${i.categoria}",${i.stockActual},${i.stockMinimo},${i.costoUnidadBaseUsd},${i.unidadBase}\n`;
    });

    // 3. Crear y descargar el archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `sec_reporte_general_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.notifService.add('Éxito', 'El reporte ha sido descargado correctamente.', 'success');
  }
}
