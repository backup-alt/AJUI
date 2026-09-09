import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { IonContent, IonSplitPane } from "@ionic/angular/standalone";
import { firstValueFrom } from "rxjs";
import { ActivatedRoute, Router } from "@angular/router";
import { ApiService } from "../core/api.service";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, IonContent, IonSplitPane, EnterpriseSidebarComponent],
  template: `<ion-split-pane contentId="main-content" when="lg"><agb-enterprise-sidebar /><div class="ion-page" id="main-content"><ion-content class="inbox-content"><main>
    <style>
      .conversation-layout{display:grid;grid-template-columns:280px minmax(0,1fr)}
      .conversation-layout.single{grid-template-columns:minmax(0,1fr)}
      .conversation-list{min-height:0;overflow-y:auto}
      .conversation-panel{display:grid;grid-template-rows:minmax(0,1fr) auto auto;min-width:0;min-height:0;overflow:hidden}
      .message-list{min-height:0;overflow-y:auto;overflow-x:hidden}
      .message-list article>div{min-width:0}
      .message{overflow-wrap:anywhere}
      .composer{min-height:0}
      .composer textarea{height:92px;max-height:92px;resize:none;overflow-y:auto}
      @media(max-width:720px){.conversation-layout{grid-template-columns:1fr;height:min(720px,calc(100vh - 160px))!important;min-height:420px!important}.conversation-list{max-height:150px}}
    </style>
    <header class="page-head"><div><span>Communication centre</span><h1>Inbox</h1><p>{{ isAdmin() ? 'Private conversations and project activity' : 'Your private conversation with the office admin' }}</p></div><button class="refresh" (click)="refresh()" [disabled]="busy()">↻ Refresh</button></header><p class="error" role="alert" *ngIf="error()">{{ error() }}</p>
    <section><div class="section-head"><div><h2>Messages</h2><p>{{ isAdmin() ? 'Project managers and accountants' : 'Private messages with the office.' }}</p></div>@if (!isAdmin() || selectedRecipient()) { <b>Page {{ messagePage() }} of {{ messageTotalPages() || 1 }}</b> }</div>
      <div class="conversation-layout" [class.single]="!isAdmin()" style="height:min(650px,calc(100vh - 220px));min-height:480px;overflow:hidden">
        @if (isAdmin()) { <aside class="conversation-list" aria-label="Employee conversations">@for (employee of recipients(); track employee._id) { <button type="button" [class.active]="replyTo() === employee._id" (click)="openConversation(employee)"><span class="avatar">{{ senderInitial(employee.name) }}</span><span class="conversation-copy"><strong>{{ employee.name }}</strong><small>{{ roleLabel(employee.role) }}</small>@if (employee.lastMessage) { <em>{{ employee.lastMessage }}</em> }</span>@if (employee.unreadCount > 0) { <span class="unread">{{ employee.unreadCount > 99 ? '99+' : employee.unreadCount }}</span> }</button> } @empty { <div class="empty"><strong>No employees available</strong><span>Active project managers and accountants will appear here.</span></div> }</aside> }
        <div class="conversation-panel">@if (isAdmin() && !selectedRecipient()) { <div class="empty conversation-empty"><strong>Select a conversation</strong><span>Choose a project manager or accountant to view private messages.</span></div> } @else { @if (messageLoading()) { <div class="loader-block" role="status"><span class="spinner"></span><strong>Loading conversation…</strong></div> } @else { <div class="message-list">@for (message of messages(); track message._id) { <article><span class="avatar">{{ senderInitial(message.senderName) }}</span><div><header><strong>{{ message.senderName }}</strong><time>{{ message.createdAt | date:'medium' }}</time></header><p class="message">{{ message.text }}</p><div class="actions">@if (message.link) { <button type="button" class="request-link" (click)="openRequestedRecord(message.link)">Open requested record</button> }</div></div></article> } @empty { <div class="empty"><strong>No messages yet</strong><span>Start this private conversation below.</span></div> }</div>
        <nav class="pagination"><button [disabled]="messagePage() === 1 || messageLoading()" (click)="loadMessages(messagePage() - 1)">Previous</button><span>Page {{ messagePage() }} of {{ messageTotalPages() || 1 }} · {{ messageTotal() }} messages</span><button [disabled]="!messageHasMore() || messageLoading()" (click)="loadMessages(messagePage() + 1)">Next</button></nav>
        <div class="composer">@if (requestLink()) { <p class="attached-link"><strong>Attached record</strong><span>{{ requestContext() || requestLink() }}</span></p> }<label>{{ isAdmin() ? 'Message ' + selectedRecipient()?.name : 'Message admin' }}<textarea [(ngModel)]="draft" maxlength="4000" rows="4" placeholder="Write a message about this edit request…"></textarea></label><div><button (click)="cancel()">Clear</button><button class="primary" (click)="send()" [disabled]="busy() || !draft.trim() || (isAdmin() && !replyTo())">Send message</button></div></div> } }</div>
      </div>
    </section>
    @if (isAdmin()) { <section><div class="section-head"><div><h2>Project activity</h2><p>Payments, purchases, funding, and expense requests.</p></div><b>Page {{ activityPage() }} of {{ activityTotalPages() || 1 }}</b></div>@if (activityLoading()) { <div class="loader-block activity-loader" role="status"><span class="spinner"></span><strong>Loading project activity…</strong></div> } @else { <div class="table-wrap"><table><thead><tr><th>Date</th><th>Project</th><th>Action / Person</th><th>Description</th><th>Amount</th><th>Payment mode</th><th>Bill</th></tr></thead><tbody>@for (item of activity(); track item.id) { <tr><td>{{ item.date | date:'short' }}</td><td><strong>{{ item.project || '—' }}</strong></td><td>{{ item.action }}<small>{{ item.actor }}</small></td><td>{{ item.description }}</td><td class="amount">{{ item.amount | currency:'INR' }}</td><td><span class="mode">{{ item.paymentMode || 'Unspecified' }}</span></td><td>@if (item.billUrl) { <a class="bill" [href]="item.billUrl" target="_blank" rel="noopener noreferrer">View Bill</a> } @else { — }</td></tr> } @empty { <tr><td colspan="7"><div class="empty">No project activity yet.</div></td></tr> }</tbody></table></div> }<nav class="pagination"><button [disabled]="activityPage() === 1 || activityLoading()" (click)="loadActivity(activityPage() - 1)">Previous</button><span>Page {{ activityPage() }} of {{ activityTotalPages() || 1 }} · {{ activityTotal() }} records</span><button [disabled]="!activityHasMore() || activityLoading()" (click)="loadActivity(activityPage() + 1)">Next</button></nav></section> }
  </main></ion-content></div></ion-split-pane>`,
  styles: [`:host{display:block}.inbox-content{--background:#f7f9fc}main{padding:28px;max-width:1400px;margin:auto;color:#1d2939}.page-head,.section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.page-head>div>span{color:#175cd3;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.page-head h1{margin:4px 0}.page-head p,.section-head p{margin:4px 0;color:#667085}.refresh,button{padding:9px 13px;border:1px solid #d0d5dd;border-radius:8px;background:#fff;color:#344054;font-weight:700;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}section{background:#fff;border:1px solid #e4e7ec;border-radius:14px;margin-top:20px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.04)}.section-head{padding:20px 22px;border-bottom:1px solid #eaecf0}.section-head h2{margin:0}.section-head b{padding:5px 9px;border-radius:999px;background:#eef4ff;color:#175cd3;font-size:11px}.message-list{padding:0 22px}.message-list article{display:grid;grid-template-columns:40px 1fr;gap:12px;padding:18px 0;border-bottom:1px solid #eaecf0}.avatar{display:flex;width:38px;height:38px;align-items:center;justify-content:center;border-radius:10px;background:#eaf2ff;color:#175cd3;font-weight:800}article header{display:flex;justify-content:space-between;gap:12px}time,small{color:#667085;font-size:12px}small{display:block}.message{white-space:pre-wrap}.actions{display:flex;align-items:center;gap:7px}.actions button{padding:6px 9px;border:0;background:#eef4ff;font-size:12px}.request-link{border-radius:6px;color:#175cd3;font-size:12px;font-weight:800;text-decoration:none}.pagination{display:flex;align-items:center;justify-content:space-between;padding:13px 22px;border-top:1px solid #eaecf0;color:#667085;font-size:12px}.composer{margin:0 22px 20px;padding:16px;border:1px solid #d6e4ff;border-radius:10px;background:#f8fbff}.composer label{display:block;font-size:12px;font-weight:800}.composer .recipient{max-width:420px;margin-bottom:13px}.composer textarea{display:block;width:100%;box-sizing:border-box;margin:8px 0 10px;padding:12px;border:1px solid #d0d5dd;border-radius:8px;font:inherit}.composer>div{display:flex;justify-content:flex-end;gap:8px}.attached-link{display:grid;gap:3px;margin:0 0 10px;padding:10px 12px;border:1px solid #b2ccff;border-radius:8px;background:#eef4ff;font-size:12px;overflow-wrap:anywhere}.attached-link strong{color:#1849a9}.attached-link span{color:#475467;font-weight:600}.primary{background:#175cd3;color:#fff}.table-wrap{overflow:auto;padding:0 18px}table{width:100%;min-width:980px;border-collapse:collapse}td,th{text-align:left;padding:13px 10px;border-bottom:1px solid #eaecf0}th{color:#667085;font-size:11px;text-transform:uppercase}td{font-size:13px}.amount{font-weight:800}.mode{padding:4px 8px;border-radius:999px;background:#f2f4f7;font-size:11px;font-weight:700}.bill{display:inline-flex;padding:6px 9px;border-radius:6px;background:#eef4ff;color:#175cd3;font-size:12px;font-weight:800;text-decoration:none}.empty{display:flex;min-height:120px;align-items:center;justify-content:center;flex-direction:column;gap:5px;color:#667085}.error{padding:10px;background:#fff1f0;color:#b42318;border-radius:8px}@media(max-width:720px){main{padding:18px 12px}.page-head{flex-direction:column}.pagination span{display:none}}`],
})
export class InboxPage {
  readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly messages = signal<any[]>([]);
  readonly activity = signal<any[]>([]);
  readonly recipients = signal<any[]>([]);
  readonly replyTo = signal("");
  readonly requestLink = signal("");
  readonly requestContext = signal("");
  readonly error = signal("");
  readonly busy = signal(false);
  readonly messageLoading = signal(false);
  readonly activityLoading = signal(false);
  readonly messagePage = signal(1);
  readonly messageTotal = signal(0);
  readonly messageTotalPages = signal(0);
  readonly messageHasMore = signal(false);
  readonly activityPage = signal(1);
  readonly activityTotal = signal(0);
  readonly activityTotalPages = signal(0);
  readonly activityHasMore = signal(false);
  readonly selectedRecipient = computed(() => this.recipients().find(employee => String(employee._id) === this.replyTo()) || null);
  draft = "";
  constructor() {
    const request = this.route.snapshot.queryParamMap.get("request") || "";
    const link = this.route.snapshot.queryParamMap.get("link") || "";
    if (request) this.requestContext.set(request);
    if (link.startsWith("/")) this.requestLink.set(link);
    void this.refresh();
  }
  isAdmin() { return this.api.user()?.role === "admin"; }
  senderInitial(name: string) { return String(name || "U").trim().charAt(0).toUpperCase(); }
  roleLabel(role: string) { return role === "project_manager" ? "Project Manager" : role === "accountant" ? "Accountant" : role; }
  openRequestedRecord(link: string) {
    if (!String(link || "").startsWith("/")) return;
    void this.router.navigateByUrl(link);
  }
  async refresh() {
    this.busy.set(true); this.error.set("");
    try {
      const jobs: Promise<void>[] = this.isAdmin()
        ? [this.fetchActivity(this.activityPage()), this.fetchRecipients()]
        : [this.fetchMessages(this.messagePage())];
      if (this.isAdmin() && this.replyTo()) jobs.push(this.fetchMessages(this.messagePage()));
      await Promise.all(jobs);
    } catch { this.error.set("Could not load inbox. Please retry."); } finally { this.busy.set(false); }
  }
  async openConversation(employee: any) { this.replyTo.set(String(employee?._id || "")); this.messagePage.set(1); await this.loadMessages(1); await this.fetchRecipients().catch(() => undefined); }
  async loadMessages(page: number) { this.messageLoading.set(true); try { await this.fetchMessages(page); } catch { this.error.set("Could not load messages."); } finally { this.messageLoading.set(false); } }
  async loadActivity(page: number) { this.activityLoading.set(true); try { await this.fetchActivity(page); } catch { this.error.set("Could not load project activity."); } finally { this.activityLoading.set(false); } }
  private async fetchMessages(page: number) { const result = await firstValueFrom(this.api.listInbox(page, this.replyTo() || undefined)); this.messages.set(result.items); this.messagePage.set(result.page || page); this.messageTotal.set(result.total || 0); this.messageTotalPages.set(result.totalPages || 0); this.messageHasMore.set(result.hasMore); }
  private async fetchActivity(page: number) { this.activityLoading.set(true); try { const result = await firstValueFrom(this.api.inboxActivity(page)); this.activity.set(result.items); this.activityPage.set(result.page || page); this.activityTotal.set(result.total || 0); this.activityTotalPages.set(result.totalPages || 0); this.activityHasMore.set(result.hasMore); } finally { this.activityLoading.set(false); } }
  private async fetchRecipients() { const result = await firstValueFrom(this.api.inboxRecipients()); this.recipients.set(result.items || []); }
  cancel() { this.requestLink.set(""); this.requestContext.set(""); this.draft = ""; }
  async send() {
    this.busy.set(true); this.error.set("");
    try { await firstValueFrom(this.api.saveInboxMessage({text: this.draft.trim(), ownerId: this.replyTo() || undefined, link: this.requestLink() || undefined})); this.cancel(); this.messagePage.set(1); await this.fetchMessages(1); if (this.isAdmin()) await this.fetchRecipients(); }
    catch { this.error.set("Message could not be saved. Please retry."); } finally { this.busy.set(false); }
  }
}
