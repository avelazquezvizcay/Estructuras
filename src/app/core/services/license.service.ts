import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';

export type LicenseType = 'trial' | 'venta' | 'full';

export interface LicenseInfo {
  empresa: string;
  tipo: LicenseType;
  expira: number; // timestamp
  key: string;
  modules: string[]; // IDs de módulos habilitados
}

export interface LicenseHistoryItem {
  empresa: string;
  tipo: LicenseType;
  hardwareId: string;
  fecha: number;
  key: string;
  modules?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class LicenseService {
  private readonly STORAGE_KEY = 'sec_license_data';
  private readonly HISTORY_KEY = 'sec_license_history';
  private readonly SECRET = 'SEC_PRO_SECRET_2026'; // En una app real, esto estaría más protegido o validado vía API

  private readonly _license = signal<LicenseInfo | null>(this.loadLicense());
  private readonly _history = signal<LicenseHistoryItem[]>(this.loadHistory());
  protected readonly hardwareId = signal<string>(this.getOrCreateHardwareId());

  readonly license = computed(() => this._license());
  readonly history = computed(() => this._history());
  readonly deviceId = computed(() => this.hardwareId());
  readonly isValid = computed(() => this.validateLicense(this._license()));
  readonly isTrial = computed(() => this._license()?.tipo === 'trial');
  readonly daysRemaining = computed(() => {
    const lic = this._license();
    if (!lic || lic.expira === 0) return 0;
    const diff = lic.expira - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  });

  constructor(private router: Router) {}

  private loadLicense(): LicenseInfo | null {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  private loadHistory(): LicenseHistoryItem[] {
    const data = localStorage.getItem(this.HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  }

  private getOrCreateHardwareId(): string {
    let id = localStorage.getItem('sec_device_id');
    if (!id) {
      // Generar un ID único basado en el navegador y un random
      const platform = navigator.platform || 'unknown';
      const screen = `${window.screen.width}x${window.screen.height}`;
      const random = Math.random().toString(36).substring(2, 10).toUpperCase();
      id = btoa(`${platform}-${screen}-${random}`).substring(0, 12).toUpperCase();
      localStorage.setItem('sec_device_id', id);
    }
    return id;
  }

  activate(empresa: string, key: string): boolean {
    // BYPASS DE DESARROLLADOR: Para facilitar pruebas iniciales
    if (empresa === 'MASTER' && key === 'M@zinkaiser') {
      const info: LicenseInfo = {
        empresa: 'ACCESO MAESTRO',
        tipo: 'full',
        expira: 0,
        key: 'MASTER_BYPASS',
        modules: ['*'] // Todos
      };
      this._license.set(info);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(info));
      return true;
    }

    // Intentar validar la llave
    const parsed = this.parseKey(key);
    
    // La llave debe coincidir con la empresa Y con el ID de este equipo
    if (parsed && 
       (parsed.empresa.toLowerCase() === empresa.toLowerCase() || empresa === 'MASTER') &&
       (parsed.hardwareId === this.hardwareId() || parsed.hardwareId === 'ALL')) {
      
      const info: LicenseInfo = {
        empresa: parsed.empresa,
        tipo: parsed.tipo,
        expira: parsed.expira,
        key: key,
        modules: parsed.modules || []
      };
      
      this._license.set(info);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(info));
      return true;
    }
    
    return false;
  }

  private validateLicense(lic: LicenseInfo | null): boolean {
    if (!lic) return false;
    
    // Bypass para desarrollador
    if (lic.key === 'MASTER_BYPASS') return true;
    
    // 1. Verificar expiración
    if (lic.tipo === 'trial' && lic.expira < Date.now()) {
      return false;
    }
    
    // 2. Verificar firma de la llave (simulada con btoa para esta demo)
    return this.parseKey(lic.key) !== null;
  }

  private parseKey(key: string): any {
    try {
      // Formato esperado: base64(empresa|tipo|expira|hardwareId|modules|hash)
      const decoded = atob(key);
      const parts = decoded.split('|');
      
      // Manejar retrocompatibilidad si no hay campo modules
      let empresa, tipo, expira, hardwareId, modulesStr, hash;
      if (parts.length === 6) {
        [empresa, tipo, expira, hardwareId, modulesStr, hash] = parts;
      } else {
        [empresa, tipo, expira, hardwareId, hash] = parts;
        modulesStr = '*'; // Por defecto acceso total para llaves viejas
      }
      
      // Validar el hash incluyendo el hardwareId y los módulos
      const expectedHash = btoa(empresa + hardwareId + modulesStr + this.SECRET).substring(0, 8);
      if (hash !== expectedHash) return null;
      
      return {
        empresa,
        tipo: tipo as LicenseType,
        expira: parseInt(expira),
        hardwareId,
        modules: modulesStr === '*' ? ['*'] : modulesStr.split(',').filter(m => !!m)
      };
    } catch {
      return null;
    }
  }

  // Generar llaves vinculadas a un equipo específico
  generateKey(empresa: string, tipo: LicenseType, dias: number = 30, hId: string = 'ALL', modules: string[] = []): string {
    const expira = tipo === 'venta' || tipo === 'full' ? 0 : Date.now() + (dias * 24 * 60 * 60 * 1000);
    
    // Si es full, por defecto tiene todos los módulos
    const modulesStr = (tipo === 'full' && modules.length === 0) ? '*' : modules.join(',');
    
    const hash = btoa(empresa + hId + modulesStr + this.SECRET).substring(0, 8);
    const raw = `${empresa}|${tipo}|${expira}|${hId}|${modulesStr}|${hash}`;
    const key = btoa(raw);

    // Guardar en historial
    const newItem: LicenseHistoryItem = {
      empresa,
      tipo,
      hardwareId: hId,
      fecha: Date.now(),
      key,
      modules: modules.length > 0 ? modules : (tipo === 'full' ? ['*'] : [])
    };
    const currentHistory = [newItem, ...this._history()];
    this._history.set(currentHistory);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(currentHistory));

    return key;
  }

  logoutLicense() {
    localStorage.removeItem(this.STORAGE_KEY);
    this._license.set(null);
    this.router.navigate(['/activacion']);
  }
}
