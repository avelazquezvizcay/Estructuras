import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly STORAGE_KEY = 'sec_payment_methods';
  private readonly DEFAULT_METHODS = ['Efectivo', 'Transferencia', 'Zelle / Pago Móvil'];

  private readonly _metodosPago = signal<string[]>(this.loadMethods());
  readonly metodosPago = this._metodosPago.asReadonly();

  private loadMethods(): string[] {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    return saved ? JSON.parse(saved) : this.DEFAULT_METHODS;
  }

  addMethod(name: string) {
    if (!name || this._metodosPago().includes(name)) return;
    this._metodosPago.update(list => {
      const newList = [...list, name];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newList));
      return newList;
    });
  }

  removeMethod(name: string) {
    this._metodosPago.update(list => {
      const newList = list.filter(m => m !== name);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newList));
      return newList;
    });
  }
}
