import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'sec-toast-container',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container" aria-live="polite" aria-atomic="true">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.type" role="alert">
          <span class="material-symbols-rounded toast__icon">{{ toast.icon }}</span>
          <span class="toast__message">{{ toast.message }}</span>
          <button class="toast__dismiss" (click)="toastService.dismiss(toast.id)" aria-label="Cerrar">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .toast-container {
      position: fixed;
      top: var(--space-5);
      right: var(--space-5);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      max-width: 420px;
      width: 100%;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      background: var(--bg-card);
      border: 1px solid var(--border-primary);
      box-shadow: var(--shadow-lg);
      animation: toastSlideIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
      pointer-events: all;
      backdrop-filter: blur(12px);

      &--success {
        border-left: 3px solid var(--accent-success);
        .toast__icon { color: var(--accent-success); }
      }
      &--error {
        border-left: 3px solid var(--accent-danger);
        .toast__icon { color: var(--accent-danger); }
      }
      &--warning {
        border-left: 3px solid var(--accent-warning);
        .toast__icon { color: var(--accent-warning); }
      }
      &--info {
        border-left: 3px solid var(--accent-primary);
        .toast__icon { color: var(--accent-primary); }
      }
    }

    .toast__icon {
      font-size: 22px;
      flex-shrink: 0;
      font-variation-settings: 'FILL' 1;
    }

    .toast__message {
      flex: 1;
      font-size: var(--text-sm);
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1.4;
    }

    .toast__dismiss {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      flex-shrink: 0;
      transition: all var(--transition-fast);
      cursor: pointer;
      border: none;
      background: none;

      &:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }

      .material-symbols-rounded { font-size: 18px; }
    }

    @keyframes toastSlideIn {
      from {
        opacity: 0;
        transform: translateX(100%) scale(0.9);
      }
      to {
        opacity: 1;
        transform: translateX(0) scale(1);
      }
    }

    @media (max-width: 480px) {
      .toast-container {
        right: var(--space-3);
        left: var(--space-3);
        max-width: none;
      }
    }
  `
})
export class ToastContainer {
  protected readonly toastService = inject(ToastService);
}
