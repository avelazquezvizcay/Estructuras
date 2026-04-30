import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'sec-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly nombre = signal('');
  protected readonly confirmPassword = signal('');
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);

  async onLogin(): Promise<void> {
    if (!this.email() || !this.password()) return;
    this.loading.set(true);
    // Small delay for UX
    await new Promise(r => setTimeout(r, 400));
    const ok = await this.auth.login(this.email(), this.password());
    this.loading.set(false);
    if (ok) {
      this.router.navigate(['/dashboard']);
    }
  }

  async onRegister(): Promise<void> {
    if (!this.email() || !this.password() || !this.nombre()) return;
    if (this.password() !== this.confirmPassword()) {
      return;
    }
    this.loading.set(true);
    await new Promise(r => setTimeout(r, 400));
    const ok = await this.auth.register({
      email: this.email(),
      nombre: this.nombre(),
      password: this.password()
    });
    this.loading.set(false);
    if (ok) {
      this.mode.set('login');
      this.password.set('');
      this.confirmPassword.set('');
    }
  }

  toggleMode(): void {
    this.mode.update(m => m === 'login' ? 'register' : 'login');
    this.password.set('');
    this.confirmPassword.set('');
  }
}
