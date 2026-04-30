import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { LicenseService } from '../services/license.service';

export const licenseGuard: CanActivateFn = (route, state) => {
  const licenseService = inject(LicenseService);
  const router = inject(Router);

  if (licenseService.isValid()) {
    return true;
  }

  // Redirigir a activación si no hay licencia válida
  router.navigate(['/activacion']);
  return false;
};
