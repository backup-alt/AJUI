import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonIcon, IonInput } from '@ionic/angular/standalone';
import { NgIf, NgFor } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'agb-otp-input',
  standalone: true,
  imports: [IonIcon, IonInput, NgIf, NgFor, FormsModule],
  template: `
    <div class="agb-otp" [class.compact]="compact">
      @for (i of indices; track i) {
        <input
          #digit
          class="otp-digit"
          type="text"
          inputmode="numeric"
          maxlength="1"
          [(ngModel)]="digits[i]"
          (input)="onInput($event, i)"
          (keydown)="onKeyDown($event, i)"
          (paste)="onPaste($event, i)"
          [attr.aria-label]="'Digit ' + (i + 1)"
        />
      }
    </div>
  `,
  styles: [`
    .agb-otp {
      display: flex;
      gap: 10px;
      justify-content: center;
      align-items: center;
    }
    .otp-digit {
      width: 52px;
      height: 60px;
      text-align: center;
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: var(--agb-radius-md);
      transition: border-color var(--agb-transition-fast), box-shadow var(--agb-transition-fast);
      outline: none;
      font-family: inherit;
    }
    .otp-digit:focus {
      border-color: var(--agb-navy);
      box-shadow: var(--agb-focus-ring);
    }
    .compact .otp-digit { width: 44px; height: 52px; font-size: 20px; }
    @media (max-width: 360px) {
      .otp-digit { width: 44px; height: 54px; font-size: 20px; }
    }
  `],
})
export class OtpInputComponent {
  @Input() length = 6;
  @Input() compact = false;
  @Input() digits: string[] = ['', '', '', '', '', ''];
  @Output() digitsChange = new EventEmitter<string[]>();

  get indices(): number[] {
    return Array.from({ length: this.length }, (_, i) => i);
  }

  onInput(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    const value = (input.value || '').replace(/\D/g, '').slice(0, 1);
    this.digits[index] = value;
    input.value = value;
    this.digitsChange.emit(this.digits);
    if (value && index < this.length - 1) {
      const next = input.nextElementSibling as HTMLInputElement | null;
      next?.focus();
      next?.select();
    }
  }

  onKeyDown(event: KeyboardEvent, index: number): void {
    if (event.key === 'Backspace' && !this.digits[index] && index > 0) {
      const prev = (event.target as HTMLInputElement).previousElementSibling as HTMLInputElement | null;
      prev?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      ((event.target as HTMLInputElement).previousElementSibling as HTMLInputElement | null)?.focus();
    } else if (event.key === 'ArrowRight' && index < this.length - 1) {
      ((event.target as HTMLInputElement).nextElementSibling as HTMLInputElement | null)?.focus();
    }
  }

  onPaste(event: ClipboardEvent, index: number): void {
    event.preventDefault();
    const pasted = (event.clipboardData?.getData('text') || '')
      .replace(/\D/g, '')
      .slice(0, this.length - index)
      .split('');
    for (let i = 0; i < pasted.length; i++) {
      this.digits[index + i] = pasted[i];
    }
    this.digitsChange.emit(this.digits);
    const lastIndex = Math.min(this.length - 1, index + pasted.length - 1);
    const inputs = (event.target as HTMLElement).parentElement?.querySelectorAll<HTMLInputElement>('.otp-digit');
    inputs?.[lastIndex]?.focus();
  }
}
