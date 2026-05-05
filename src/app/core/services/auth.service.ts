import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from './toast.service';
import { SqliteDatabaseService } from './sqlite-database.service';
import { LicenseService } from './license.service';

export type UserRole = 'master' | 'admin' | 'supervisor' | 'user';

export interface AppUser {
  id: string;
  username: string;
  email: string;
  nombre: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
  passwordHash?: string; // Loaded only for auth
}

export interface ModuleConfig {
  id: string;
  label: string;
  description: string;
  icon: string;
  route: string;
  enabled: boolean;
  rolesAllowed: UserRole[];
}

const DEFAULT_MODULES: ModuleConfig[] = [
  { id: 'dashboard', label: 'nav.dashboard', description: 'dashboard.subtitle', icon: 'dashboard', route: '/dashboard', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor', 'user'] },
  { id: 'insumos', label: 'nav.insumos', description: 'insumos.subtitle', icon: 'inventory_2', route: '/insumos', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor', 'user'] },
  { id: 'productos', label: 'nav.productos', description: 'productos.subtitle', icon: 'bakery_dining', route: '/productos', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor', 'user'] },
  { id: 'presupuestos', label: 'presupuestos.title', description: 'presupuestos.subtitle', icon: 'request_quote', route: '/presupuestos', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor'] },
  { id: 'compras', label: 'compras.title', description: 'compras.subtitle', icon: 'receipt_long', route: '/compras', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor'] },
  { id: 'inventario_masivo', label: 'inventario.title', description: 'inventario.subtitle', icon: 'inventory', route: '/inventario-masivo', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor'] },
  { id: 'tasas', label: 'nav.tasas', description: 'tasas.subtitle', icon: 'currency_exchange', route: '/tasas', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor', 'user'] },
  { id: 'reportes', label: 'nav.reportes', description: 'reportes.subtitle', icon: 'bar_chart', route: '/reportes', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor'] },
  { id: 'configuracion', label: 'nav.configuracion', description: 'config.subtitle', icon: 'settings', route: '/configuracion', enabled: true, rolesAllowed: ['master', 'admin'] },
  { id: 'ia_facturas', label: 'ia.facturas', description: 'ia.facturasDesc', icon: 'auto_awesome', route: '', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor'] },
  { id: 'ia_rif', label: 'ia.rif', description: 'ia.rifDesc', icon: 'smart_toy', route: '', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor'] },
  { id: 'asistente_ia', label: 'ia.assistant', description: 'ia.assistantDesc', icon: 'psychology', route: '', enabled: true, rolesAllowed: ['master', 'admin', 'supervisor', 'user'] },
];

const DEFAULT_MASTER: AppUser & { username: string } = {
  id: 'master-001',
  username: 'admin',
  email: 'admin@sec.local',
  nombre: 'Administrador',
  role: 'master',
  createdAt: new Date().toISOString()
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly sqlite = inject(SqliteDatabaseService);

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
    return role === 'master' || role === 'admin' || role === 'supervisor';
  });

  readonly visibleModules = computed(() => {
    const user = this._currentUser();
    if (!user) return [];
    return this._modules().filter(m =>
      m.enabled && m.rolesAllowed.includes(user.role)
    );
  });

  private readonly licenseService = inject(LicenseService);

  hasModule(moduleId: string): boolean {
    const user = this._currentUser();
    if (!user) return false;

    // 1. Verificar Módulos de la Licencia
    const lic = this.licenseService.license();
    if (lic) {
      // Si la licencia tiene '*' tiene acceso a todo lo que su rol le permita
      // Si no tiene '*', debe estar el ID en la lista
      const hasLicenceAccess = lic.modules.includes('*') || lic.modules.includes(moduleId);
      if (!hasLicenceAccess) return false;
    }

    // 2. Verificar Permisos por Rol
    const mod = this._modules().find(m => m.id === moduleId);
    return mod ? (mod.enabled && mod.rolesAllowed.includes(user.role)) : false;
  }

  constructor() {
    this.init();
  }

  async init(): Promise<void> {
    await this.loadState();
  }

  async login(identifier: string, password: string): Promise<boolean> {
    try {
      const user = await this.sqlite.get<AppUser & { passwordHash: string }>(
        'SELECT * FROM users WHERE email = ? OR username = ?', 
        [identifier.toLowerCase(), identifier.toLowerCase()]
      );

      if (!user) {
        this.toast.error('Usuario o correo no encontrado');
        return false;
      }

      if (user.passwordHash !== this.simpleHash(password)) {
        this.toast.error('Contraseña incorrecta');
        return false;
      }

      const { passwordHash, ...userView } = user;
      this._currentUser.set(userView as AppUser);
      this._isLoggedIn.set(true);
      
      localStorage.setItem('sec_session', JSON.stringify(userView));
      this.toast.success(`Bienvenido, ${user.nombre}`);
      return true;
    } catch (e) {
      console.error('Login error:', e);
      return false;
    }
  }

  logout(): void {
    this._currentUser.set(null);
    this._isLoggedIn.set(false);
    localStorage.removeItem('sec_session');
    this.toast.info('Sesión cerrada');
    this.router.navigate(['/login']);
  }

  async register(data: { email: string; username: string; nombre: string; password: string; role?: UserRole }): Promise<boolean> {
    try {
      const existing = await this.sqlite.get('SELECT id FROM users WHERE email = ? OR username = ?', [data.email.toLowerCase(), data.username.toLowerCase()]);
      if (existing) {
        this.toast.error('El correo o el usuario ya están registrados');
        return false;
      }

      const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
      const passwordHash = this.simpleHash(data.password);
      const createdAt = new Date().toISOString();
      const role = data.role || 'user';

      await this.sqlite.run(
        'INSERT INTO users (id, username, email, nombre, role, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, data.username.toLowerCase(), data.email.toLowerCase(), data.nombre, role, passwordHash, createdAt]
      );

      await this.loadUsers();
      this.toast.success(`Usuario "${data.nombre}" creado`);
      return true;
    } catch (e) {
      console.error('Register error:', e);
      return false;
    }
  }

  async updateUser(id: string, data: Partial<AppUser>): Promise<void> {
    const fields = Object.keys(data).filter(k => k !== 'id' && k !== 'passwordHash');
    if (fields.length === 0) return;

    const sql = `UPDATE users SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;
    const params = [...fields.map(f => (data as any)[f]), id];

    await this.sqlite.run(sql, params);
    await this.loadUsers();
    this.toast.success('Información de usuario actualizada');
  }

  async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    await this.sqlite.run('UPDATE users SET role = ? WHERE id = ?', [newRole, userId]);
    await this.loadUsers();
    this.toast.success('Rol actualizado');
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const hash = this.simpleHash(newPassword);
    await this.sqlite.run('UPDATE users SET passwordHash = ? WHERE id = ?', [hash, userId]);
    this.toast.success('Contraseña actualizada correctamente');
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this._users().find(u => u.id === userId);
    if (user?.role === 'master') {
      this.toast.error('No puedes eliminar al usuario master');
      return;
    }
    await this.sqlite.run('DELETE FROM users WHERE id = ?', [userId]);
    await this.loadUsers();
    this.toast.warning(`Usuario eliminado`);
  }

  // ─── Module Management ────────────────────────────────────
  toggleModule(moduleId: string, enabled: boolean): void {
    this._modules.update(list =>
      list.map(m => m.id === moduleId ? { ...m, enabled } : m)
    );
    this.saveModules();
  }

  updateModuleRoles(moduleId: string, roles: UserRole[]): void {
    this._modules.update(list =>
      list.map(m => m.id === moduleId ? { ...m, rolesAllowed: roles } : m)
    );
    this.saveModules();
  }

  private saveModules(): void {
    localStorage.setItem('sec_modules', JSON.stringify(this._modules()));
  }

  private async loadUsers(): Promise<void> {
    const users = await this.sqlite.all<AppUser>('SELECT id, username, email, nombre, role, createdAt FROM users');
    this._users.set(users);

    const master = users.find(u => u.role === 'master');
    if (!master) {
      await this.register({
        email: DEFAULT_MASTER.email,
        username: DEFAULT_MASTER.username,
        nombre: DEFAULT_MASTER.nombre,
        password: 'admin123',
        role: 'master'
      });
    } else if (!master.username) {
      // Fix for existing master user without username
      await this.updateUser(master.id, { username: DEFAULT_MASTER.username });
    }
  }

  private async loadState(): Promise<void> {
    try {
      await this.loadUsers();

      const modulesRaw = localStorage.getItem('sec_modules');
      if (modulesRaw) {
        const stored = JSON.parse(modulesRaw) as ModuleConfig[];
        const merged = DEFAULT_MODULES.map(def => {
          const saved = stored.find(s => s.id === def.id);
          return saved ? { ...def, enabled: saved.enabled, rolesAllowed: saved.rolesAllowed } : def;
        });
        this._modules.set(merged);
      }

      const sessionRaw = localStorage.getItem('sec_session');
      if (sessionRaw) {
        const userSession = JSON.parse(sessionRaw) as AppUser;
        const user = await this.sqlite.get<AppUser>('SELECT * FROM users WHERE id = ?', [userSession.id]);
        if (user) {
          this._currentUser.set(user);
          this._isLoggedIn.set(true);
        } else {
          localStorage.removeItem('sec_session');
        }
      }
    } catch (e) {
      console.error('Error loading state:', e);
    }
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36);
  }
}
