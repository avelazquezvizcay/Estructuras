import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(this.loadTheme());

  readonly theme = this._theme.asReadonly();

  constructor() {
    effect(() => {
      const t = this._theme();
      document.documentElement.setAttribute('data-theme', t);
      try { localStorage.setItem('sec_theme', t); } catch {}
    });
  }

  toggle(): void {
    this._theme.update(t => t === 'light' ? 'dark' : 'light');
  }

  set(theme: Theme): void {
    this._theme.set(theme);
  }

  private loadTheme(): Theme {
    try {
      const stored = localStorage.getItem('sec_theme');
      if (stored === 'dark' || stored === 'light') return stored;
    } catch {}
    return 'light';
  }
}
