import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from './toast.service';

export type UserRole = 'master' | 'admin' | 'user';

export interface AppUser {
  id: string;
  email: string;
  nombre: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
}

export interface ModuleConfig {
  id: string;
  label: string;
  icon: string;
  route: string;
  enabled: boolean;
  rolesAllowed: UserRole[];
}

const DEFAULT_MODULES: ModuleConfig[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '/dashboard', enabled: true, rolesAllowed: ['master', 'admin', 'user'] },
  { id: 'insumos', label: 'Insumos', icon: 'inventory_2', route: '/insumos', enabled: true, rolesAllowed: ['master', 'admin', 'user'] },
  { id: 'productos', label: 'Productos', icon: 'bakery_dining', route: '/productos', enabled: true, rolesAllowed: ['master', 'admin', 'user'] },
  { id: 'presupuestos', label: 'Presupuestos', icon: 'request_quote', route: '/presupuestos', enabled: true, rolesAllowed: ['master', 'admin'] },
  { id: 'tasas', label: 'Tasas de Cambio', icon: 'currency_exchange', route: '/tasas', enabled: true, rolesAllowed: ['master', 'admin', 'user'] },
  { id: 'reportes', label: 'Reportes', icon: 'bar_chart', route: '/reportes', enabled: true, rolesAllowed: ['master', 'admin'] },
  { id: 'configuracion', label: 'Configuración', icon: 'settings', route: '/configuracion', enabled: true, rolesAllowed: ['master'] },
  { id: 'asistente_ia', label: 'Asistente IA (Groq)', icon: 'smart_toy', route: '', enabled: true, rolesAllowed: ['master', 'admin', 'user'] },
];

const DEFAULT_MASTER: AppUser = {
  id: 'master-001',
  email: 'admin@sec.local',
  nombre: 'Administrador',
  role: 'master',
  createdAt: new Date().toISOString()
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _currentUser = signal<AppUser | null>(null);
  private readonly _users = signal<AppUser[]>([]);
  private readonly _modules = signal<ModuleConfig[]>(DEFAULT_MODULES);
  private readonly _isLoggedIn = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly users = this._users.asReadonly();
  readonly modules = this._modules.asReadonly();
  readonly isLoggedIn = this._isLoggedIn.asReadonly();

  readonly isMaster = computed(() => this._currentUser()?.role === 'master');
  readonly isAdmin = computed(() => {
    const role = this._currentUser()?.role;
    return role === 'master' || role === 'admin';
  });

  readonly visibleModules = computed(() => {
    const user = this._currentUser();
    if (!user) return [];
    return this._modules().filter(m =>
      m.enabled && m.rolesAllowed.includes(user.role)
    );
  });

  hasModule(moduleId: string): boolean {
    const user = this._currentUser();
    if (!user) return false;
    const mod = this._modules().find(m => m.id === moduleId);
    return mod ? (mod.enabled && mod.rolesAllowed.includes(user.role)) : false;
  }

  constructor(
    private toast: ToastService,
    private router: Router
  ) {
    this.loadState();
  }

  // ─── Login ──────────────────────────────────────────────────
  login(email: string, password: string): boolean {
    const users = this._users();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      this.toast.error('Usuario no encontrado');
      return false;
    }

    // Simple password check (stored hashed in real app)
    const storedPass = this.getStoredPassword(user.id);
    if (storedPass && storedPass !== this.simpleHash(password)) {
      this.toast.error('Contraseña incorrecta');
      return false;
    }

    this._currentUser.set(user);
    this._isLoggedIn.set(true);
    this.saveState();
    this.toast.success(`Bienvenido, ${user.nombre}`);
    return true;
  }

  logout(): void {
    this._currentUser.set(null);
    this._isLoggedIn.set(false);
    localStorage.removeItem('sec_session');
    this.toast.info('Sesión cerrada');
    this.router.navigate(['/login']);
  }

  // ─── User Registration ──────────────────────────────────────
  register(data: { email: string; nombre: string; password: string; role?: UserRole }): boolean {
    const existing = this._users().find(u => u.email.toLowerCase() === data.email.toLowerCase());
    if (existing) {
      this.toast.error('El correo ya está registrado');
      return false;
    }

    const newUser: AppUser = {
      id: crypto.randomUUID(),
      email: data.email,
      nombre: data.nombre,
      role: data.role || 'user',
      createdAt: new Date().toISOString()
    };

    this._users.update(list => [...list, newUser]);
    this.setStoredPassword(newUser.id, this.simpleHash(data.password));
    this.saveState();
    this.toast.success(`Usuario "${data.nombre}" creado`);
    return true;
  }

  // ─── User Management (Master only) ──────────────────────────
  updateUserRole(userId: string, newRole: UserRole): void {
    this._users.update(list =>
      list.map(u => u.id === userId ? { ...u, role: newRole } : u)
    );
    this.saveState();
    this.toast.success('Rol actualizado');
  }

  deleteUser(userId: string): void {
    const user = this._users().find(u => u.id === userId);
    if (user?.role === 'master') {
      this.toast.error('No puedes eliminar al usuario master');
      return;
    }
    this._users.update(list => list.filter(u => u.id !== userId));
    localStorage.removeItem(`sec_pass_${userId}`);
    this.saveState();
    this.toast.warning(`Usuario eliminado`);
  }

  // ─── Module Management (Master only) ────────────────────────
  toggleModule(moduleId: string, enabled: boolean): void {
    this._modules.update(list =>
      list.map(m => m.id === moduleId ? { ...m, enabled } : m)
    );
    this.saveState();
  }

  updateModuleRoles(moduleId: string, roles: UserRole[]): void {
    this._modules.update(list =>
      list.map(m => m.id === moduleId ? { ...m, rolesAllowed: roles } : m)
    );
    this.saveState();
  }

  // ─── Persistence ────────────────────────────────────────────
  private saveState(): void {
    try {
      localStorage.setItem('sec_users', JSON.stringify(this._users()));
      localStorage.setItem('sec_modules', JSON.stringify(this._modules()));
      if (this._currentUser()) {
        localStorage.setItem('sec_session', JSON.stringify(this._currentUser()));
      }
    } catch {}
  }

  private loadState(): void {
    try {
      // Load users
      const usersRaw = localStorage.getItem('sec_users');
      if (usersRaw) {
        this._users.set(JSON.parse(usersRaw));
      }

      // Ensure master user always exists
      if (!this._users().find(u => u.role === 'master')) {
        this._users.update(list => [DEFAULT_MASTER, ...list]);
        this.setStoredPassword(DEFAULT_MASTER.id, this.simpleHash('admin123'));
        this.saveState();
      }

      // Load modules
      const modulesRaw = localStorage.getItem('sec_modules');
      if (modulesRaw) {
        const stored = JSON.parse(modulesRaw) as ModuleConfig[];
        // Merge: keep stored config but add any new modules from defaults
        const merged = DEFAULT_MODULES.map(def => {
          const saved = stored.find(s => s.id === def.id);
          return saved ? { ...def, enabled: saved.enabled, rolesAllowed: saved.rolesAllowed } : def;
        });
        this._modules.set(merged);
      }

      // Restore session
      const sessionRaw = localStorage.getItem('sec_session');
      if (sessionRaw) {
        const user = JSON.parse(sessionRaw) as AppUser;
        // Verify user still exists
        if (this._users().find(u => u.id === user.id)) {
          this._currentUser.set(user);
          this._isLoggedIn.set(true);
        }
      }
    } catch {}
  }

  // ─── Password helpers (simple, not for production) ──────────
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36);
  }

  private getStoredPassword(userId: string): string | null {
    return localStorage.getItem(`sec_pass_${userId}`);
  }

  private setStoredPassword(userId: string, hash: string): void {
    localStorage.setItem(`sec_pass_${userId}`, hash);
  }
}
