import { provideRouter, withPreloading, PreloadAllModules } from "@angular/router";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideIonicAngular } from "@ionic/angular/standalone";
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
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
}).catch((error) => console.error(error));
