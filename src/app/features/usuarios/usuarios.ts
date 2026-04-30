import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, AppUser, UserRole, ModuleConfig } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { LicenseService, LicenseType } from '../../core/services/license.service';
import { GeminiAiService } from '../../core/services/gemini-ai.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'sec-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Usuarios {
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly licenseService = inject(LicenseService);
  private readonly geminiAi = inject(GeminiAiService);

  protected readonly activeTab = signal<'users' | 'modules' | 'licensing'>('users');
  protected readonly showCreateModal = signal(false);
  protected readonly showEditModal = signal(false);
  protected readonly showPasswordModal = signal(false);

  // Edit user state
  protected readonly selectedUser = signal<AppUser | null>(null);
  protected readonly selectedUserId = signal<string | null>(null);
  protected readonly editName = signal('');
  protected readonly editUsername = signal('');
  protected readonly editEmail = signal('');
  protected readonly editRole = signal<UserRole>('user');
  protected readonly newPasswordReset = signal('');

  // License Generator State
  protected readonly genEmpresa = signal('');
  protected readonly genTipo = signal<LicenseType>('trial');
  protected readonly genDias = signal(30);
  protected readonly genHardwareId = signal('');
  protected readonly generatedKey = signal('');

  protected readonly history = this.licenseService.history;

  // New user form
  protected readonly newName = signal('');
  protected readonly newUsername = signal('');
  protected readonly newEmail = signal('');
  protected readonly newPassword = signal('');
  protected readonly newRole = signal<UserRole>('user');

  async createUser(): Promise<void> {
    if (!this.newName() || !this.newUsername() || !this.newEmail() || !this.newPassword()) {
      this.toast.error('Completa todos los campos');
      return;
    }

    const ok = await this.auth.register({
      email: this.newEmail(),
      username: this.newUsername(),
      nombre: this.newName(),
      password: this.newPassword(),
      role: this.newRole()
    });

    if (ok) {
      this.showCreateModal.set(false);
      this.newName.set('');
      this.newUsername.set('');
      this.newEmail.set('');
      this.newPassword.set('');
      this.newRole.set('user');
    }
  }

  openEdit(user: AppUser): void {
    this.selectedUser.set(user);
    this.editName.set(user.nombre);
    this.editUsername.set(user.username);
    this.editEmail.set(user.email);
    this.editRole.set(user.role);
    this.showEditModal.set(true);
  }

  async saveUserEdit(): Promise<void> {
    const user = this.selectedUser();
    if (!user) return;

    await this.auth.updateUser(user.id, {
      nombre: this.editName(),
      username: this.editUsername(),
      email: this.editEmail(),
      role: this.editRole()
    });
    this.showEditModal.set(false);
  }

  async changeRole(user: AppUser, role: UserRole): Promise<void> {
    await this.auth.updateUserRole(user.id, role);
  }

  async deleteUser(user: AppUser): Promise<void> {
    if (confirm(`¿Eliminar al usuario "${user.nombre}"? Esta acción no se puede deshacer.`)) {
      await this.auth.deleteUser(user.id);
    }
  }

  toggleModule(mod: ModuleConfig): void {
    this.auth.toggleModule(mod.id, !mod.enabled);
  }

  openPasswordReset(userId: string): void {
    this.selectedUserId.set(userId);
    this.newPasswordReset.set('');
    this.showPasswordModal.set(true);
  }

  async confirmPasswordReset(): Promise<void> {
    const userId = this.selectedUserId();
    const pass = this.newPasswordReset();
    if (!pass || pass.length < 4) {
      this.toast.error('La contraseña debe tener al menos 4 caracteres');
      return;
    }
    if (userId && pass) {
      await this.auth.updateUserPassword(userId, pass);
      this.showPasswordModal.set(false);
    }
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
      supervisor: 'badge--info',
      user: 'badge--default'
    };
    return map[role];
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  generateLicense(): void {
    if (!this.genEmpresa()) {
      this.toast.error('Ingresa el nombre de la empresa');
      return;
    }
    const hId = this.genHardwareId() || 'ALL';
    const key = this.licenseService.generateKey(this.genEmpresa(), this.genTipo(), this.genDias(), hId);
    this.generatedKey.set(key);
    this.toast.success('Licencia generada correctamente');
  }

  async onRifSelected(event: any): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!environment.geminiApiKey) {
      this.toast.warning('Configura el API Key de Gemini para usar esta función');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const base64 = e.target.result;
      this.toast.info('Analizando RIF con IA...');
      
      const data = await this.geminiAi.analyzeRifImage(base64);
      if (data && data.nombre) {
        this.genEmpresa.set(data.nombre);
        this.toast.success('Datos extraídos correctamente');
      } else {
        this.toast.error('No se pudieron extraer datos del RIF');
      }
    };
    reader.readAsDataURL(file);
  }

  copyKey(): void {
    navigator.clipboard.writeText(this.generatedKey());
    this.toast.info('Código copiado al portapapeles');
  }

  copyExistingKey(key: string): void {
    navigator.clipboard.writeText(key);
    this.toast.info('Código de licencia copiado');
  }
}
