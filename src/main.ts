import {
  provideRouter,
  withHashLocation,
  withPreloading,
  PreloadAllModules,
} from "@angular/router";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideIonicAngular } from "@ionic/angular/standalone";
import { provideHttpClient, withInterceptors } from "@angular/common/http";
import { APP_INITIALIZER } from "@angular/core";
import { addIcons } from "ionicons";
import {
  addOutline,
  analyticsOutline,
  businessOutline,
  calendarOutline,
  callOutline,
  cashOutline,
  checkmarkDoneOutline,
  closeOutline,
  constructOutline,
  cubeOutline,
  documentAttachOutline,
  documentOutline,
  documentTextOutline,
  downloadOutline,
  folderOpenOutline,
  funnelOutline,
  gridOutline,
  hammerOutline,
  locationOutline,
  menuOutline,
  peopleOutline,
  receiptOutline,
  searchOutline,
  settingsOutline,
  storefrontOutline,
  walletOutline,
} from "ionicons/icons";
import { AppComponent } from "./app/app.component";
import { routes } from "./app/app.routes";
import { authInterceptor } from "./app/core/auth.interceptor";
import { ApiService } from "./app/core/api.service";
import { ErpDataService } from "./app/data/erp-data.service";
import { WorkspaceHydrationService } from "./app/core/workspace-hydration.service";

export function initializeApp(
  api: ApiService,
  erp: ErpDataService,
  hydration: WorkspaceHydrationService
): () => Promise<void> {
  return async () => {
    if (api.isAuthenticated()) {
      if (erp.projects().length === 0) {
        await hydration.hydrateFromBackend();
      }
    }
  };
}

addIcons({
  "add-outline": addOutline,
  "analytics-outline": analyticsOutline,
  "business-outline": businessOutline,
  "calendar-outline": calendarOutline,
  "call-outline": callOutline,
  "cash-outline": cashOutline,
  "checkmark-done-outline": checkmarkDoneOutline,
  "close-outline": closeOutline,
  "construct-outline": constructOutline,
  "cube-outline": cubeOutline,
  "document-attach-outline": documentAttachOutline,
  "document-outline": documentOutline,
  "document-text-outline": documentTextOutline,
  "download-outline": downloadOutline,
  "folder-open-outline": folderOpenOutline,
  "funnel-outline": funnelOutline,
  "grid-outline": gridOutline,
  "hammer-outline": hammerOutline,
  "location-outline": locationOutline,
  "menu-outline": menuOutline,
  "people-outline": peopleOutline,
  "receipt-outline": receiptOutline,
  "search-outline": searchOutline,
  "settings-outline": settingsOutline,
  "storefront-outline": storefrontOutline,
  "wallet-outline": walletOutline,
});

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular(),
    provideRouter(
      routes,
      withPreloading(PreloadAllModules),
      withHashLocation(),
    ),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [ApiService, ErpDataService, WorkspaceHydrationService],
      multi: true,
    },
  ],
}).catch((error) => console.error(error));
