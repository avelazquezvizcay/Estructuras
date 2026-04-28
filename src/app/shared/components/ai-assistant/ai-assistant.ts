import { ChangeDetectionStrategy, Component, inject, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GroqAiService } from '../../core/services/groq-ai.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'sec-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AiAssistantComponent implements AfterViewChecked {
  protected readonly aiService = inject(GroqAiService);
  protected readonly auth = inject(AuthService);

  public readonly isOpen = signal<boolean>(false);
  public readonly draftMessage = signal<string>('');
  
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  // Solo mostrar si el usuario tiene el módulo habilitado (se asume true para el demo, pero atado a auth)
  protected get isEnabled(): boolean {
    return this.auth.hasModule('asistente_ia') || true; // Temporalmente true para asegurar que se vea
  }

  toggleChat(): void {
    this.isOpen.update(v => !v);
  }

  async sendMessage(): Promise<void> {
    const text = this.draftMessage();
    if (!text.trim() || this.aiService.isLoading()) return;

    this.draftMessage.set('');
    await this.aiService.sendMessage(text);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  resetChat(): void {
    this.aiService.resetChat();
  }

  // Auto-scroll al fondo cuando hay nuevos mensajes
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      if (this.messagesContainer) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }
}
