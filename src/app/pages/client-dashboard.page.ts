import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { IonContent, IonIcon, IonProgressBar, IonSplitPane, ToastController } from "@ionic/angular/standalone";
import { Client, ErpDataService } from "../data/erp-data.service";
import { ApiService } from "../core/api.service";
import { ClientFormDialogComponent, type ClientFormValue } from "../shared/client-form-dialog.component";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { formatMoney } from "../shared/format";

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonProgressBar, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, ClientFormDialogComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="clients"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Clients"
          eyebrow="Client Registry · Backend source of truth"
          metaLabel=""
          [blurred]="showClientForm() || !!editingClient()"
          [showTitle]="false"
          searchPlaceholder="Search"
        />

        <ion-content class="erp-page">
          <main class="client-landing">
            <section class="client-grid">
              <article class="client-card add-client-card" role="button" tabindex="0" (click)="showClientForm.set(true)" (keydown.enter)="showClientForm.set(true)">
                <div class="add-client-icon">
                  <ion-icon name="add-outline"></ion-icon>
                </div>
                <h3>Add New Client</h3>
              <p>Create a client profile before adding construction projects and ledgers.</p>
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
                  </div>

                  <p class="address"><ion-icon name="location-outline"></ion-icon>{{ client.address }}</p>

                  <div class="ledger-box">
                    <div class="ledger-row strong">
                    <span>{{ summary(client).projectCount }} Projects</span>
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
          description="{{ editingClient() ? 'Update client contact and address information.' : 'Create the client record first. Projects and ledgers stay separated under this client.' }}"
          submitLabel="{{ editingClient() ? 'Save Changes' : 'Create Client' }}"
          [initialValue]="editingClient() ? clientEditValue(editingClient()!) : null"
          [submitting]="clientSaving()"
          (cancel)="closeClientForm()"
          (create)="editingClient() ? updateClient($event) : createClient($event)"
        ></agb-client-form-dialog>
      </div>
    </ion-split-pane>
  `,
  styles: [``],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientDashboardPage {
  readonly data = inject(ErpDataService);
  readonly api = inject(ApiService);
  readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  readonly search = signal("");
  readonly showClientForm = signal(false);
  readonly editingClient = signal<Client | null>(null);
  readonly clients = this.data.clients;
  readonly refreshing = signal(false);
  readonly refreshMessage = signal<string | null>(null);
  readonly clientSaving = signal(false);
  readonly formatMoney = formatMoney;

  refreshFromBackend() {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.refreshMessage.set("Refreshing clients from backend…");
    this.api.listClients({ limit: 25, page: 1 }).subscribe({
      next: (r) => {
        try {
          const items = (r.items || []).map((c: any) => ({
            id: c.clientId,
            _id: c._id,
            initials: c.initials,
            name: c.name,
            mobile: c.mobile,
            address: c.address,
            status: c.status,
            projectIds: c.projectIds || [],
            supervisor: c.supervisor || "",
          }));
          // Backend is the source of truth — always overwrite, even with [].
          // No localStorage write — the dashboard no longer caches data tables.
          this.data.clients.set(items as any);
        } catch {}
        this.refreshing.set(false);
        this.refreshMessage.set(`Synced ${r.total} clients`);
        setTimeout(() => this.refreshMessage.set(null), 2500);
      },
      error: (e) => {
        this.refreshing.set(false);
        this.refreshMessage.set("Sync failed: " + (e?.message || "unknown"));
        setTimeout(() => this.refreshMessage.set(null), 4000);
      },
    });
  }
  async openClient(client: Client) {
    // A client can own several projects. Always open the client workspace
    // first so the user can choose the correct project card.
    void this.router.navigate(["/clients", client.id]);
  }

  async createClient(value: ClientFormValue) {
    if (!value.name || !value.mobile || !value.address) return;
    if (this.clientSaving()) return; // guard against double-submit

    const payload = {
      name: value.name,
      mobile: value.mobile,
      address: value.address,
      gstNumber: value.gstNumber || "",
      state: value.state || "",
      supervisor: "",
      status: "Active",
    };

    this.clientSaving.set(true);
    try {
      const res: any = await new Promise((resolve, reject) => {
        this.api.createClient(payload).subscribe({ next: resolve, error: reject });
      });
      const created = res?.client || res;
      const clientId = created?.clientId || created?.id || res?.clientId || res?.id;
      // Client creation must not auto-create a project — project setup is a
      // deliberate, separate step the user takes from inside the client
      // workspace.
      this.data.addClient({
        ...value,
        id: clientId,
        _id: created?._id,
        supervisor: "",
      } as Client);
      this.closeClientForm();
      await this.presentToast(`Client "${value.name}" created. Open the client to add a project.`, "success");
    } catch (err: any) {
      console.error("Failed to create client", err);
      // Keep the dialog open so the user can correct and retry.
      await this.presentToast(
        err?.error?.message || err?.message || "Could not create the client. Please try again.",
        "danger",
      );
    } finally {
      this.clientSaving.set(false);
    }
  }

  private async presentToast(message: string, color: "success" | "warning" | "danger" = "success") {
    try {
      const toast = await this.toastController.create({
        message,
        duration: color === "danger" ? 4000 : 2500,
        color,
        position: "top",
      });
      await toast.present();
    } catch (err) {
      // Toast failures should never block the underlying action.
      console.warn("[ClientDashboard] Failed to present toast:", err);
    }
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
      gstNumber: client.gstNumber || "",
      state: client.state || "",
    };
  }

  async updateClient(value: ClientFormValue) {
    const client = this.editingClient();
    if (!client || !value.name || !value.mobile || !value.address) return;
    if (this.clientSaving()) return; // guard against double-submit

    this.clientSaving.set(true);
    try {
      this.data.updateClient(client.id, value);
      this.closeClientForm();
      await this.presentToast(`Client "${value.name}" updated.`);
    } finally {
      this.clientSaving.set(false);
    }
  }

  deleteClient(client: Client, event: Event) {
    event.stopPropagation();
    const confirmed = window.confirm(`Delete ${client.name}? This removes the client and linked project records.`);
    if (!confirmed) return;
    const mongoId = (client as any)._id;
    if (mongoId) {
      this.api.deleteClient(String(mongoId)).subscribe({
        next: () => this.data.deleteClient(client.id),
        error: (err: any) => {
          const msg = err?.error?.message || err?.message || "Unknown error";
          if (err?.status === 409) {
            window.alert(`Cannot delete ${client.name}: ${msg}`);
          } else {
            window.alert(`Delete failed for ${client.name}: ${msg}`);
          }
        },
      });
    } else {
      this.data.deleteClient(client.id);
    }
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
