import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from "@angular/core";

export interface DetailColumn {
  key: string;
  label: string;
}

export interface DetailCardItem {
  id: string;
  label: string;
  subtitle?: string;
  badge?: string;
}

@Component({
  selector: "agb-data-detail-dialog",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="form-overlay" role="presentation" (click)="onBackdropClick($event)">
      <section class="erp-dialog detail-dialog" role="dialog" aria-modal="true">
        <div class="dialog-head">
          <div>
            @if (cardMode && selectedCardId()) {
              <button type="button" class="detail-dialog-back" (click)="selectedCardId.set(null)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                Back to materials
              </button>
            }
            <span class="detail-dialog-eyebrow">{{ eyebrow }}</span>
            <h2 class="detail-dialog-title">{{ cardMode && selectedCardId() ? selectedCardLabel() : title }}</h2>
            <p class="detail-dialog-count">
              @if (cardMode && !selectedCardId()) {
                {{ cardItems.length }} material{{ cardItems.length === 1 ? '' : 's' }}
              } @else {
                {{ currentRows().length }} record{{ currentRows().length === 1 ? '' : 's' }}
              }
            </p>
          </div>
          <button type="button" class="icon-button detail-dialog-close" aria-label="Close" (click)="close.emit()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="detail-dialog-body">
          @if (cardMode && !selectedCardId()) {
            @if (cardItems.length === 0) {
              <div class="detail-dialog-empty">
                <p>No materials in inventory.</p>
              </div>
            } @else {
              <div class="detail-dialog-cards">
                @for (item of cardItems; track item.id) {
                  <button type="button" class="detail-dialog-card" (click)="selectedCardId.set(item.id)">
                    <div class="detail-dialog-card-head">
                      <strong>{{ item.label }}</strong>
                      @if (item.badge) {
                        <span class="detail-dialog-card-badge">{{ item.badge }}</span>
                      }
                    </div>
                    @if (item.subtitle) {
                      <span class="detail-dialog-card-sub">{{ item.subtitle }}</span>
                    }
                  </button>
                }
              </div>
            }
          } @else {
            @if (currentRows().length === 0) {
              <div class="detail-dialog-empty">
                <p>No records to display.</p>
              </div>
            } @else {
              <table class="detail-dialog-table">
                <thead>
                  <tr>
                    @for (col of columns; track col.key) {
                      <th>{{ col.label }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of currentRows(); track $index) {
                    <tr>
                      @for (col of columns; track col.key) {
                        <td>{{ row[col.key] ?? '—' }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            }
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .detail-dialog {
      width: min(1100px, calc(100vw - 48px));
      max-height: min(90vh, 800px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #d5deea;
      border-radius: 14px;
      background: #ffffff;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.2);
    }
    .dialog-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 20px 24px 16px;
      border-bottom: 1px solid #f1f4f9;
      background: #ffffff;
      flex-shrink: 0;
    }
    .detail-dialog-eyebrow {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--ui-accent-dark, #1d4ed8);
      margin-bottom: 4px;
    }
    .detail-dialog-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .detail-dialog-count {
      font-size: 13px;
      color: #64748b;
      margin: 4px 0 0;
    }
    .detail-dialog-close {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      border: none;
      background: #f1f5f9;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      transition: background 160ms ease;
    }
    .detail-dialog-close:hover { background: #e2e8f0; color: #0f172a; }
    .detail-dialog-close svg { width: 16px; height: 16px; }
    .detail-dialog-back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: none;
      background: none;
      color: var(--ui-accent-dark, #1d4ed8);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      margin-bottom: 6px;
    }
    .detail-dialog-back:hover { text-decoration: underline; }
    .detail-dialog-back svg { width: 14px; height: 14px; }
    .detail-dialog-body {
      flex: 1;
      overflow: auto;
      min-height: 0;
    }
    .detail-dialog-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      color: #94a3b8;
      font-size: 14px;
    }
    .detail-dialog-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      padding: 16px;
    }
    .detail-dialog-card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px;
      border: 1px solid #e5eaf1;
      border-radius: 12px;
      background: #ffffff;
      cursor: pointer;
      text-align: left;
      transition: box-shadow 160ms ease, border-color 160ms ease;
    }
    .detail-dialog-card:hover {
      border-color: var(--ui-accent, #2563eb);
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.1);
    }
    .detail-dialog-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .detail-dialog-card-head strong {
      font-size: 14px;
      color: #0f172a;
      font-weight: 700;
    }
    .detail-dialog-card-badge {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 6px;
      white-space: nowrap;
    }
    .detail-dialog-card-sub {
      font-size: 13px;
      color: #64748b;
    }
    .detail-dialog-table {
      width: 100%;
      min-width: 500px;
      border-collapse: collapse;
      font-size: 13px;
    }
    .detail-dialog-table thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #64748b;
      padding: 10px 14px;
      border-bottom: 1px solid #e5eaf1;
      background: #fafbfd;
    }
    .detail-dialog-table tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #0f172a;
      white-space: nowrap;
    }
    .detail-dialog-table tbody tr:hover { background: #f8fafc; }
  `],
})
export class DataDetailDialogComponent {
  @Input() eyebrow = "";
  @Input() title = "";
  @Input() columns: DetailColumn[] = [];
  @Input() cardMode = false;
  @Input() cardItems: DetailCardItem[] = [];
  @Output() close = new EventEmitter<void>();

  readonly selectedCardId = signal<string | null>(null);
  private readonly allRows = signal<Array<Record<string, any>>>([]);

  @Input() set rows(value: Array<Record<string, any>>) {
    this.allRows.set(value || []);
  }

  readonly currentRows = computed(() => {
    const id = this.selectedCardId();
    if (id) return this.allRows().filter((r) => r["__group"] === id);
    return this.allRows();
  });

  selectedCardLabel(): string {
    const id = this.selectedCardId();
    if (!id) return "";
    const item = this.cardItems.find((c) => c.id === id);
    return item ? item.label : "";
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains("form-overlay")) {
      this.close.emit();
    }
  }
}
