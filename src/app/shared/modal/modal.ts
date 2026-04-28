import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'sec-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-overlay" (click)="onOverlayClick($event)" role="dialog" [attr.aria-label]="title()">
      <div class="modal" [style.max-width]="maxWidth()">
        <div class="modal__header">
          <h2 class="modal__title">{{ title() }}</h2>
          <button class="modal__close" (click)="closed.emit()" aria-label="Cerrar">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        <div class="modal__body">
          <ng-content />
        </div>
      </div>
    </div>
  `,
  styles: `
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(4px);
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4);
      animation: fadeIn 0.2s ease-out;
    }

    .modal {
      background: var(--bg-card);
      border: 1px solid var(--border-primary);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: modalSlideUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both;
    }

    .modal__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-5) var(--space-6);
      border-bottom: 1px solid var(--border-primary);
      position: sticky;
      top: 0;
      background: var(--bg-card);
      z-index: 1;
      border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    }

    .modal__title {
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--text-primary);
    }

    .modal__close {
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      transition: all var(--transition-fast);
      cursor: pointer;
      border: none;
      background: none;

      &:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
      }
      .material-symbols-rounded { font-size: 22px; }
    }

    .modal__body {
      padding: var(--space-6);
    }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes modalSlideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
  `
})
export class Modal {
  readonly title = input.required<string>();
  readonly maxWidth = input('560px');
  readonly closed = output<void>();

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closed.emit();
    }
  }
}
