import { Injectable, signal, computed } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
  icon: string;
  duration: number;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  private _nextId = 0;

  readonly toasts = this._toasts.asReadonly();
  readonly hasToasts = computed(() => this._toasts().length > 0);

  show(message: string, type: ToastType = 'info', duration = 4000): void {
    const icons: Record<ToastType, string> = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };

    const toast: Toast = {
      id: this._nextId++,
      message,
      type,
      icon: icons[type],
      duration,
      timestamp: Date.now()
    };

    this._toasts.update(list => [...list, toast]);

    if (duration > 0) {
      setTimeout(() => this.dismiss(toast.id), duration);
    }
  }

  success(message: string, duration = 4000): void {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = 5000): void {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration = 4500): void {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration = 4000): void {
    this.show(message, 'info', duration);
  }

  dismiss(id: number): void {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }

  clear(): void {
    this._toasts.set([]);
  }
}
