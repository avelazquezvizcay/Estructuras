import { Routes } from '@angular/router';
import { Layout } from './shared/layout/layout';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then(m => m.Login),
    canActivate: [guestGuard],
    title: 'Iniciar Sesión — SEC'
  },
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard),
        title: 'Dashboard — SEC'
      },
      {
        path: 'insumos',
        loadComponent: () => import('./features/insumos/insumos').then(m => m.Insumos),
        title: 'Insumos — SEC'
      },
      {
        path: 'productos',
        loadComponent: () => import('./features/productos/productos').then(m => m.Productos),
        title: 'Productos — SEC'
      },
      {
        path: 'presupuestos',
        loadComponent: () => import('./features/presupuestos/presupuestos').then(m => m.Presupuestos),
        title: 'Presupuestos — SEC'
      },
      {
        path: 'tasas',
        loadComponent: () => import('./features/tasas/tasas').then(m => m.Tasas),
        title: 'Tasas de Cambio — SEC'
      },
      {
        path: 'reportes',
        loadComponent: () => import('./features/reportes/reportes').then(m => m.Reportes),
        title: 'Reportes — SEC'
      },
      {
        path: 'configuracion',
        loadComponent: () => import('./features/configuracion/configuracion').then(m => m.Configuracion),
        title: 'Configuración — SEC'
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./features/usuarios/usuarios').then(m => m.Usuarios),
        title: 'Gestión de Usuarios — SEC'
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
