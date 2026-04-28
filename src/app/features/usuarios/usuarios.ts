import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, AppUser, UserRole, ModuleConfig } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'sec-usuarios',
  imports: [FormsModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Usuarios {
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly activeTab = signal<'users' | 'modules'>('users');
  protected readonly showCreateModal = signal(false);

  // New user form
  protected readonly newName = signal('');
  protected readonly newEmail = signal('');
  protected readonly newPassword = signal('');
  protected readonly newRole = signal<UserRole>('user');

  createUser(): void {
    if (!this.newName() || !this.newEmail() || !this.newPassword()) {
      this.toast.error('Completa todos los campos');
      return;
    }

    const ok = this.auth.register({
      email: this.newEmail(),
      nombre: this.newName(),
      password: this.newPassword(),
      role: this.newRole()
    });

    if (ok) {
      this.showCreateModal.set(false);
      this.newName.set('');
      this.newEmail.set('');
      this.newPassword.set('');
      this.newRole.set('user');
    }
  }

  changeRole(user: AppUser, role: UserRole): void {
    this.auth.updateUserRole(user.id, role);
  }

  deleteUser(user: AppUser): void {
    if (confirm(`¿Eliminar al usuario "${user.nombre}"? Esta acción no se puede deshacer.`)) {
      this.auth.deleteUser(user.id);
    }
  }

  toggleModule(mod: ModuleConfig): void {
    this.auth.toggleModule(mod.id, !mod.enabled);
  }

  toggleModuleRole(mod: ModuleConfig, role: UserRole): void {
    const currentRoles = [...mod.rolesAllowed];
    const idx = currentRoles.indexOf(role);
    if (idx >= 0) {
      currentRoles.splice(idx, 1);
    } else {
      currentRoles.push(role);
    }
    // Master always has access
    if (!currentRoles.includes('master')) currentRoles.push('master');
    this.auth.updateModuleRoles(mod.id, currentRoles);
  }

  getRoleBadgeClass(role: UserRole): string {
    const map: Record<UserRole, string> = {
      master: 'badge--purple',
      admin: 'badge--primary',
      user: 'badge--default'
    };
    return map[role];
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
