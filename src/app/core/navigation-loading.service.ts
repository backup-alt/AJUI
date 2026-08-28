import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class NavigationLoadingService {
  readonly active = signal(false);

  start(): void {
    this.active.set(true);
  }

  stop(): void {
    this.active.set(false);
  }
}
