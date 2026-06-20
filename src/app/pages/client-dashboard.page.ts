import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { IonBadge, IonContent, IonIcon, IonProgressBar, IonSplitPane } from "@ionic/angular/standalone";
import { Client, ErpDataService } from "../data/erp-data.service";
import { ClientFormDialogComponent, type ClientFormValue } from "../shared/client-form-dialog.component";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney, statusClass } from "../shared/format";

@Component({
  standalone: true,
  imports: [CommonModule, IonBadge, IonContent, IonIcon, IonProgressBar, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, ClientFormDialogComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="clients"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Clients"
          eyebrow="Client Registry"
          metaLabel=""
          [blurred]="showClientForm() || !!editingClient()"
          [showTitle]="false"
          searchPlaceholder="Search clients, projects, receipts..."
        />

        <ion-content class="erp-page">
          <main class="client-landing">
            <section class="client-grid">
              <article class="client-card add-client-card" role="button" tabindex="0" (click)="showClientForm.set(true)" (keydown.enter)="showClientForm.set(true)">
                <div class="add-client-icon">
                  <ion-icon name="add-outline"></ion-icon>
                </div>
                <h3>Add New Client</h3>
                <p>Create a client profile before adding construction projects, ledgers, and site records.</p>
              </article>

              <article
                *ngFor="let client of clients(); trackBy: trackClient"
                class="client-card"
                role="button"
                tabindex="0"
                (click)="openClient(client)"
                (keydown.enter)="openClient(client)"
              >
                <div class="client-card-body">
                  <div class="card-head">
                    <div class="identity">
                      <div class="avatar-block">{{ client.initials }}</div>
                      <div>
                        <h3>{{ client.name }}</h3>
                        <p><ion-icon name="call-outline"></ion-icon>{{ client.mobile }}</p>
                      </div>
                    </div>
                    <ion-badge class="status" [ngClass]="statusClass(client.status)">{{ client.status }}</ion-badge>
                  </div>

                  <p class="address"><ion-icon name="location-outline"></ion-icon>{{ client.address }}</p>

                  <div class="ledger-box">
                    <div class="ledger-row strong">
                      <span>{{ summary(client).projectCount }} Projects  -  {{ summary(client).activeSites }} Active Sites</span>
                      <strong>{{ formatMoney(summary(client).totalValue) }}</strong>
                    </div>
                    <div class="ledger-row">
                      <span>Received: <strong>{{ formatMoney(summary(client).received) }}</strong></span>
                      <span>Pending: <strong class="warning">{{ formatMoney(summary(client).pending) }}</strong></span>
                    </div>
                    <ion-progress-bar [value]="progress(client)"></ion-progress-bar>
                  </div>
                </div>

                <div class="client-card-footer">
                  <span>Open Client</span>
                  <div class="client-card-footer-actions">
                    <button type="button" class="client-edit-action" aria-label="Edit client" title="Edit Client" (click)="editClient(client, $event)">
                      <strong>Edit Client</strong>
                    </button>
                    <button type="button" class="client-delete-action" aria-label="Delete client" title="Delete client" (click)="deleteClient(client, $event)">
                      <svg viewBox="0 0 24 24" aria-hidden="true" class="svg-icon">
                        <path d="M4 7h16" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M6 7l1 14h10l1-14" />
                        <path d="M9 7V4h6v3" />
                      </svg>
                    </button>
                  </div>
                </div>
              </article>
            </section>
          </main>
        </ion-content>

        <agb-client-form-dialog
          *ngIf="showClientForm() || editingClient()"
          eyebrow="{{ editingClient() ? 'Client Edit' : 'Client Setup' }}"
          title="{{ editingClient() ? 'Edit Client' : 'Add New Client' }}"
          description="{{ editingClient() ? 'Update client contact, address, supervisor, and status information.' : 'Create the client record first. Projects, ledgers, and site records stay separated under this client.' }}"
          submitLabel="{{ editingClient() ? 'Save Changes' : 'Create Client' }}"
          [initialValue]="editingClient() ? clientEditValue(editingClient()!) : null"
          (cancel)="closeClientForm()"
          (create)="editingClient() ? updateClient($event) : createClient($event)"
        ></agb-client-form-dialog>
      </div>
    </ion-split-pane>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDashboardPage {
  readonly data = inject(ErpDataService);
  readonly router = inject(Router);
  readonly search = signal("");
  readonly showClientForm = signal(false);
  readonly editingClient = signal<Client | null>(null);
  readonly clients = this.data.clients;
  readonly formatMoney = formatMoney;
  readonly statusClass = statusClass;

  openClient(client: Client) {
    const project = this.data.firstProjectForClient(client) ?? this.data.createDefaultProject(client);
    this.data.touchProject(project.id);
    void this.router.navigate(["/clients", client.id, "projects", project.id, "materials"]);
  }

  createClient(value: ClientFormValue) {
    if (!value.name || !value.mobile || !value.address || !value.supervisor) return;
    const client = this.data.addClient(value);
    const project = this.data.createDefaultProject(client);
    this.showClientForm.set(false);
    setTimeout(() => void this.router.navigate(["/clients", client.id, "projects", project.id, "materials"]));
  }

  editClient(client: Client, event: Event) {
    event.stopPropagation();
    this.editingClient.set(client);
  }

  closeClientForm() {
    this.showClientForm.set(false);
    this.editingClient.set(null);
  }

  clientEditValue(client: Client): ClientFormValue {
    return {
      name: client.name,
      mobile: client.mobile,
      address: client.address,
      supervisor: client.supervisor,
      status: client.status,
    };
  }

  updateClient(value: ClientFormValue) {
    const client = this.editingClient();
    if (!client || !value.name || !value.mobile || !value.address || !value.supervisor) return;
    this.data.updateClient(client.id, value);
    this.closeClientForm();
  }

  deleteClient(client: Client, event: Event) {
    event.stopPropagation();
    const confirmed = window.confirm(`Delete ${client.name}? This removes the client and linked project records.`);
    if (!confirmed) return;
    this.data.deleteClient(client.id);
  }

  summary(client: Client) {
    return this.data.clientSummary(client);
  }

  progress(client: Client) {
    const summary = this.summary(client);
    return summary.totalValue ? summary.received / summary.totalValue : 0;
  }

  trackClient(_: number, client: Client) {
    return client.id;
  }
}
