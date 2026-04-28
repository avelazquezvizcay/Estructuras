import { ChangeDetectionStrategy, Component, signal, computed, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { TasaCambioService } from '../../core/services/tasa-cambio.service';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { AiAssistantComponent } from '../components/ai-assistant/ai-assistant';

@Component({
  selector: 'sec-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TitleCasePipe, AiAssistantComponent],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Layout {
  protected readonly tasaService = inject(TasaCambioService);
  protected readonly themeService = inject(ThemeService);
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly notifService = inject(NotificationService);

  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly showNotifPanel = signal(false);
  protected readonly showUserDropdown = signal(false);

  protected readonly currentDate = computed(() => {
    const lang = this.i18n.lang();
    return new Date().toLocaleDateString(lang === 'es' ? 'es-VE' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  protected readonly navItems = computed(() => {
    const mods = this.auth.visibleModules();
    return mods.map(m => ({
      label: m.label,
      icon: m.icon,
      route: m.route
    }));
  });

  protected readonly userInitials = computed(() => {
    const user = this.auth.currentUser();
    if (!user) return '??';
    const parts = user.nombre.split(' ');
    return parts.map(p => p[0]).slice(0, 2).join('').toUpperCase();
  });

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggle();
  }

  toggleLang(): void {
    this.i18n.setLang(this.i18n.lang() === 'es' ? 'en' : 'es');
  }

  toggleNotifPanel(): void {
    this.showNotifPanel.update(v => !v);
    this.showUserDropdown.set(false);
  }

  toggleUserDropdown(): void {
    this.showUserDropdown.update(v => !v);
    this.showNotifPanel.set(false);
  }

  closeDropdowns(): void {
    this.showNotifPanel.set(false);
    this.showUserDropdown.set(false);
  }

  formatTimeAgo(date: Date): string {
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `Hace ${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days}d`;
  }

  logout(): void {
    this.auth.logout();
  }
}
