import { Injectable } from '@angular/core';

/**
 * Coordination service that signals when the app's first page
 * has finished loading all required data.
 *
 * Flow:
 * 1. AppComponent.ngOnInit() completes auth/notification init
 * 2. AppComponent awaits `appReady` (the Promise below)
 * 3. DashboardPage loads data, then calls `resolve()` on success
 * 4. Only then does AppComponent hide the splash screen
 *
 * If the dashboard fails to load, `resolve(false)` signals an error state.
 * A timeout ensures the splash always hides eventually (safety net).
 */
@Injectable({ providedIn: 'root' })
export class AppReadyService {
  private _resolve!: (value: boolean) => void;
  private _resolved = false;

  /** The Promise that AppComponent awaits before hiding the splash. */
  readonly appReady = new Promise<boolean>((resolve) => {
    this._resolve = resolve;
  });

  /** Dashboard calls this when data has loaded (true) or failed (false). */
  resolve(success: boolean): void {
    if (this._resolved) return;
    this._resolved = true;
    this._resolve(success);
  }

  /** Whether the dashboard has already resolved (prevents double-resolve). */
  get isResolved(): boolean {
    return this._resolved;
  }
}
