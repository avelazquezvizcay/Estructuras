import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LicenseService } from '../../core/services/license.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'sec-activacion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './activacion.html',
  styleUrl: './activacion.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Activacion {
  protected readonly licenseService = inject(LicenseService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly empresa = signal('');
  protected readonly key = signal('');
  protected readonly loading = signal(false);

  async activate(): Promise<void> {
    if (!this.empresa() || !this.key()) {
      this.toast.error('Por favor ingresa el nombre de la empresa y el código de licencia');
      return;
    }

    this.loading.set(true);
    
    // Simular retraso para efecto premium
    await new Promise(r => setTimeout(r, 1500));

    const success = this.licenseService.activate(this.empresa(), this.key());
    
    if (success) {
      this.toast.success('¡Software activado correctamente!');
      this.router.navigate(['/dashboard']);
    } else {
      this.toast.error('Código de licencia inválido para esta empresa');
    }
    
    this.loading.set(false);
  }
}
