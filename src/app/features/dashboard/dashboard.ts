import { ChangeDetectionStrategy, Component, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';
import { DashboardKpi } from '../../core/models/domain.models';

@Component({
  selector: 'sec-dashboard',
  imports: [FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Dashboard {
  protected readonly tasaService = inject(TasaCambioService);

  protected readonly kpis = signal<DashboardKpi[]>([
    {
      label: 'Productos Registrados',
      value: '24',
      subvalue: '3 nuevos este mes',
      icon: 'bakery_dining',
      trend: 'up',
      trendValue: '+14%',
      color: 'primary'
    },
    {
      label: 'Insumos Activos',
      value: '87',
      subvalue: '12 categorías',
      icon: 'inventory_2',
      trend: 'up',
      trendValue: '+6',
      color: 'success'
    },
    {
      label: 'Costo Promedio',
      value: '$12.45',
      subvalue: 'por producto',
      icon: 'trending_up',
      trend: 'down',
      trendValue: '-2.3%',
      color: 'warning'
    },
    {
      label: 'Margen Promedio',
      value: '42%',
      subvalue: 'de utilidad',
      icon: 'percent',
      trend: 'up',
      trendValue: '+1.5%',
      color: 'info'
    }
  ]);

  protected readonly topProductos = signal([
    { nombre: 'Torta de Chocolate 1kg', costo: 8.50, venta: 14.45, margen: 70 },
    { nombre: 'Pan de Jamón 500g', costo: 5.20, venta: 8.84, margen: 70 },
    { nombre: 'Galletas de Avena x12', costo: 3.80, venta: 6.08, margen: 60 },
    { nombre: 'Brownie Premium', costo: 6.10, venta: 10.37, margen: 70 },
    { nombre: 'Cheesecake 1.5kg', costo: 12.30, venta: 22.14, margen: 80 },
  ]);

  protected readonly filtroProductos = signal<'mayor_margen' | 'menor_costo'>('mayor_margen');

  protected readonly productosFiltrados = computed(() => {
    const prods = [...this.topProductos()];
    if (this.filtroProductos() === 'mayor_margen') {
      return prods.sort((a, b) => b.margen - a.margen);
    } else {
      return prods.sort((a, b) => a.costo - b.costo);
    }
  });

  protected readonly topInsumos = signal([
    { nombre: 'Harina de Trigo', categoria: 'Harinas', usos: 18, costoBase: '$0.0012/g' },
    { nombre: 'Azúcar Refinada', categoria: 'Endulzantes', usos: 16, costoBase: '$0.0008/g' },
    { nombre: 'Huevos', categoria: 'Proteínas', usos: 15, costoBase: '$0.25/unid' },
    { nombre: 'Mantequilla', categoria: 'Lácteos', usos: 14, costoBase: '$0.0095/g' },
    { nombre: 'Leche Entera', categoria: 'Lácteos', usos: 12, costoBase: '$0.0018/ml' },
  ]);

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
}
