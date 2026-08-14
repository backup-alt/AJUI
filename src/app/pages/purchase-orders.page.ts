import { CommonModule } from "@angular/common";
import { Component, OnInit, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { IonContent, IonIcon, IonSplitPane } from "@ionic/angular/standalone";
import { PurchaseOrder } from "../core/api.service";
import { EnterpriseHeaderComponent } from "../shared/enterprise-header.component";
import { EnterpriseSidebarComponent } from "../shared/enterprise-sidebar.component";
import { PurchaseOrdersPanelComponent } from "../shared/purchase-orders-panel.component";

@Component({
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon, IonSplitPane, EnterpriseHeaderComponent, EnterpriseSidebarComponent, PurchaseOrdersPanelComponent],
  template: `
    <ion-split-pane contentId="main-content" when="lg">
      <agb-enterprise-sidebar active="purchase-orders"></agb-enterprise-sidebar>

      <div class="ion-page" id="main-content">
        <agb-enterprise-header
          title="Purchase Orders"
          eyebrow="Purchase Order Register · Create and manage material purchase orders"
          metaLabel=""
          [showTitle]="false"
          searchPlaceholder="Search purchase orders"
        />

        <ion-content class="erp-page">
          <main class="quotation-page">
            @if (view() === "list") {
              <section class="quotation-header-section">
                <div class="section-header">
                  <h2>Saved Purchase Orders <small *ngIf="orderCount() > 0">{{ orderCount() }}</small></h2>
                  <button type="button" class="btn-primary" (click)="view.set('create')">
                    <ion-icon name="add-outline"></ion-icon>
                    New Purchase Order
                  </button>
                </div>
              </section>
            }

            <agb-purchase-orders-panel
              [projectId]="''"
              [projectName]="'Current project'"
              [view]="view()"
              [openNumber]="openNumber()"
              (closeCreate)="view.set('list')"
              (saved)="onSaved($event)"
              (countChange)="orderCount.set($event)"
              (closeDetail)="view.set('list')"
              (requestDetail)="onRequestDetail($event)"
              (editRequest)="onEditRequest($event)"
            ></agb-purchase-orders-panel>
          </main>
        </ion-content>
      </div>
    </ion-split-pane>
  `,
  styles: [`
    .quotation-page {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .quotation-header-section {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 0;
    }
    .section-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
    }
    .section-header h2 small {
      display: inline-block;
      margin-left: 10px;
      padding: 3px 10px;
      border-radius: 999px;
      background: #e0ecff;
      color: #2c5cff;
      font-size: 11px;
      font-weight: 700;
      vertical-align: middle;
    }
    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 18px;
      background: #2c5cff;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      line-height: 1;
    }
    .btn-primary:hover { background: #1e4ae8; }
    @media (max-width: 768px) {
      .quotation-page { padding: 16px; }
      .section-header { align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    }
  `],
})
export class PurchaseOrdersPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly view = signal<"list" | "create" | "detail" | "edit">("list");
  readonly openNumber = signal("");
  readonly orderCount = signal(0);

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      const open = params["open"];
      if (open) {
        this.openNumber.set(String(open));
        this.view.set("detail");
        void this.router.navigate(["/purchase-orders"], {
          queryParams: { open: null },
          queryParamsHandling: "merge",
          replaceUrl: true,
        });
      }
    });
  }

  onSaved(order: PurchaseOrder) {
    this.openNumber.set(order.poNumber);
    this.view.set("detail");
  }

  onRequestDetail(poNumber: string) {
    this.openNumber.set(poNumber);
    this.view.set("detail");
  }

  onEditRequest(poNumber: string) {
    this.openNumber.set(poNumber);
    this.view.set("edit");
  }
}
