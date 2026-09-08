import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonContent, IonSplitPane } from "@ionic/angular/standalone";
import { firstValueFrom } from "rxjs";
import { ApiService } from "../core/api.service";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSplitPane, EnterpriseSidebarComponent],
  template: `<ion-split-pane contentId="main-content" when="lg"><agb-enterprise-sidebar /><div class="ion-page" id="main-content"><ion-content class="inbox-content"><main>
    <header class="page-head"><div><span>Communication centre</span><h1>Inbox</h1><p>{{ isAdmin() ? 'Private conversations and project activity' : 'Your private conversation with the office admin' }}</p></div><button class="refresh" (click)="refresh()" [disabled]="busy()">↻ Refresh</button></header><p class="error" role="alert" *ngIf="error()">{{ error() }}</p>
    <section><div class="section-head"><div><h2>Messages</h2><p>Private messages with the office.</p></div><b>Page {{ messagePage() }}</b></div>
      <div class="message-list">@for (message of messages(); track message._id) { <article><span class="avatar">{{ senderInitial(message.senderName) }}</span><div><header><strong>{{ message.senderName }}</strong><time>{{ message.createdAt | date:'medium' }}</time></header><p class="message">{{ message.text }}</p><div class="actions">@if (isAdmin()) { <button (click)="replyTo.set(message.ownerId)">Reply privately</button> }@if (isAdmin() || message.senderId === api.user()?.id) { <button (click)="edit(message)">Edit</button> }@if (isAdmin()) { <button class="danger" (click)="remove(message)" [disabled]="busy()">Delete</button> }</div></div></article> } @empty { <div class="empty"><strong>No messages yet</strong><span>New private messages will appear here.</span></div> }</div>
      <nav class="pagination"><button [disabled]="messagePage() === 1 || busy()" (click)="loadMessages(messagePage() - 1)">Previous</button><span>Up to 10 messages per page</span><button [disabled]="!messageHasMore() || busy()" (click)="loadMessages(messagePage() + 1)">Next</button></nav>
      @if (!isAdmin() || replyTo() || editing()) { <div class="composer"><label>{{ editing() ? 'Edit message' : (replyTo() ? 'Private reply' : 'Message admin') }}<textarea [(ngModel)]="draft" maxlength="4000" rows="4" placeholder="Write a message…"></textarea></label><div><button (click)="cancel()">Cancel</button><button class="primary" (click)="send()" [disabled]="busy() || !draft.trim()">{{ editing() ? 'Save message' : 'Send message' }}</button></div></div> }
    </section>
    @if (isAdmin()) { <section><div class="section-head"><div><h2>Project activity</h2><p>Payments, purchases, funding, and expense requests.</p></div><b>Page {{ activityPage() }}</b></div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Project</th><th>Action / Person</th><th>Description</th><th>Amount</th><th>Payment mode</th><th>Bill</th></tr></thead><tbody>@for (item of activity(); track item.id) { <tr><td>{{ item.date | date:'short' }}</td><td><strong>{{ item.project || '—' }}</strong></td><td>{{ item.action }}<small>{{ item.actor }}</small></td><td>{{ item.description }}</td><td class="amount">{{ item.amount | currency:'INR' }}</td><td><span class="mode">{{ item.paymentMode || 'Unspecified' }}</span></td><td>@if (item.billUrl) { <a class="bill" [href]="item.billUrl" target="_blank" rel="noopener noreferrer">View Bill</a> } @else { — }</td></tr> } @empty { <tr><td colspan="7"><div class="empty">No project activity yet.</div></td></tr> }</tbody></table></div><nav class="pagination"><button [disabled]="activityPage() === 1 || busy()" (click)="loadActivity(activityPage() - 1)">Previous</button><span>Up to 10 records per page</span><button [disabled]="!activityHasMore() || busy()" (click)="loadActivity(activityPage() + 1)">Next</button></nav></section> }
  </main></ion-content></div></ion-split-pane>`,
  styles: [`:host{display:block}.inbox-content{--background:#f7f9fc}main{padding:28px;max-width:1400px;margin:auto;color:#1d2939}.page-head,.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.page-head>div>span{color:#175cd3;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.page-head h1{margin:4px 0}.page-head p,.section-head p{margin:4px 0;color:#667085}.refresh,button{padding:9px 13px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;color:#344054;font-weight:700;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}section{background:#fff;border:1px solid #e4e7ec;border-radius:14px;margin-top:20px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.04)}.section-head{padding:20px 22px;border-bottom:1px solid #eaecf0}.section-head h2{margin:0}.section-head b{padding:5px 9px;border-radius:999px;background:#eef4ff;color:#175cd3;font-size:11px}.message-list{padding:0 22px}.message-list article{display:grid;grid-template-columns:40px 1fr;gap:12px;padding:18px 0;border-bottom:1px solid #eaecf0}.avatar{display:flex;width:38px;height:38px;align-items:center;justify-content:center;border-radius:10px;background:#eaf2ff;color:#175cd3;font-weight:800}article header{display:flex;justify-content:space-between;gap:12px}time,small{color:#667085;font-size:12px}small{display:block}.message{white-space:pre-wrap}.actions{display:flex;gap:6px}.actions button{padding:6px 9px;border:0;background:#f2f4f7;font-size:12px}.actions .danger{background:#fff1f0;color:#b42318}.pagination{display:flex;align-items:center;justify-content:space-between;padding:13px 22px;border-top:1px solid #eaecf0;color:#667085;font-size:12px}.composer{margin:0 22px 20px;padding:16px;border:1px solid #d6e4ff;border-radius:10px;background:#f8fbff}.composer label{font-size:12px;font-weight:800}.composer textarea{display:block;width:100%;margin:8px 0 10px;padding:12px;border:1px solid #d0d5dd;border-radius:8px;font:inherit}.composer>div{display:flex;justify-content:flex-end;gap:8px}.primary{background:#175cd3;color:#fff}.table-wrap{overflow:auto;padding:0 18px}table{width:100%;min-width:980px;border-collapse:collapse}td,th{text-align:left;padding:13px 10px;border-bottom:1px solid #eaecf0}th{color:#667085;font-size:11px;text-transform:uppercase}td{font-size:13px}.amount{font-weight:800}.mode{padding:4px 8px;border-radius:999px;background:#f2f4f7;font-size:11px;font-weight:700}.bill{display:inline-flex;padding:6px 9px;border-radius:6px;background:#eef4ff;color:#175cd3;font-size:12px;font-weight:800;text-decoration:none}.empty{display:flex;min-height:120px;align-items:center;justify-content:center;flex-direction:column;gap:5px;color:#667085}.error{padding:10px;background:#fff1f0;color:#b42318;border-radius:8px}@media(max-width:720px){main{padding:18px 12px}.page-head{flex-direction:column}.pagination span{display:none}}`],
})
export class InboxPage {
  readonly api = inject(ApiService);
  readonly messages = signal<any[]>([]);
  readonly activity = signal<any[]>([]);
  readonly replyTo = signal("");
  readonly editing = signal("");
  readonly error = signal("");
  readonly busy = signal(false);
  readonly messagePage = signal(1);
  readonly messageHasMore = signal(false);
  readonly activityPage = signal(1);
  readonly activityHasMore = signal(false);
  draft = "";
  constructor() { void this.refresh(); }
  isAdmin() { return this.api.user()?.role === "admin"; }
  senderInitial(name: string) { return String(name || "U").trim().charAt(0).toUpperCase(); }
  async refresh() {
    this.busy.set(true); this.error.set("");
    try {
      const jobs: Promise<void>[] = [this.fetchMessages(this.messagePage())];
      if (this.isAdmin()) jobs.push(this.fetchActivity(this.activityPage()));
      await Promise.all(jobs);
    } catch { this.error.set("Could not load inbox. Please retry."); } finally { this.busy.set(false); }
  }
  async loadMessages(page: number) { this.busy.set(true); try { await this.fetchMessages(page); } catch { this.error.set("Could not load messages."); } finally { this.busy.set(false); } }
  async loadActivity(page: number) { this.busy.set(true); try { await this.fetchActivity(page); } catch { this.error.set("Could not load project activity."); } finally { this.busy.set(false); } }
  private async fetchMessages(page: number) { const result = await firstValueFrom(this.api.listInbox(page)); this.messages.set(result.items); this.messagePage.set(page); this.messageHasMore.set(result.hasMore); }
  private async fetchActivity(page: number) { const result = await firstValueFrom(this.api.inboxActivity(page)); this.activity.set(result.items); this.activityPage.set(page); this.activityHasMore.set(result.hasMore); }
  edit(message: any) { this.editing.set(message._id); this.replyTo.set(""); this.draft = message.text; }
  cancel() { this.editing.set(""); this.replyTo.set(""); this.draft = ""; }
  async send() {
    this.busy.set(true); this.error.set("");
    try { await firstValueFrom(this.api.saveInboxMessage({text: this.draft.trim(), ownerId: this.replyTo() || undefined}, this.editing() || undefined)); this.cancel(); this.messagePage.set(1); await this.fetchMessages(1); }
    catch { this.error.set("Message could not be saved. Please retry."); } finally { this.busy.set(false); }
  }
  async remove(message: any) {
    if (!window.confirm("Delete this message?")) return;
    this.busy.set(true);
    try { await firstValueFrom(this.api.deleteInboxMessage(message._id)); await this.fetchMessages(this.messagePage()); } catch { this.error.set("Message could not be deleted."); } finally { this.busy.set(false); }
  }
}
