import { Injectable, signal, computed } from '@angular/core';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'rate_change';
  icon: string;
  timestamp: Date;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _notifications = signal<AppNotification[]>([]);

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter(n => !n.read).length);
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  constructor() {
    this.loadFromCache();
  }

  add(title: string, message: string, type: AppNotification['type'] = 'info'): void {
    const icons: Record<AppNotification['type'], string> = {
      info: 'info',
      warning: 'warning',
      success: 'check_circle',
      rate_change: 'currency_exchange'
    };

    const notif: AppNotification = {
      id: crypto.randomUUID(),
      title,
      message,
      type,
      icon: icons[type],
      timestamp: new Date(),
      read: false
    };

    this._notifications.update(list => [notif, ...list].slice(0, 50));
    this.saveToCache();
  }

  markAsRead(id: string): void {
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, read: true } : n)
    );
    this.saveToCache();
  }

  markAllAsRead(): void {
    this._notifications.update(list =>
      list.map(n => ({ ...n, read: true }))
    );
    this.saveToCache();
  }

  clear(): void {
    this._notifications.set([]);
    this.saveToCache();
  }

  private saveToCache(): void {
    try {
      localStorage.setItem('sec_notifications', JSON.stringify(
        this._notifications().map(n => ({ ...n, timestamp: n.timestamp.toISOString() }))
      ));
    } catch {}
  }

  private loadFromCache(): void {
    try {
      const raw = localStorage.getItem('sec_notifications');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      this._notifications.set(parsed.map((n: any) => ({
        ...n,
        timestamp: new Date(n.timestamp)
      })));
    } catch {}
  }
}
