import { Injectable, signal } from "@angular/core";

/**
 * Tracks backend-enforced access restrictions (e.g. Access Schedule window
 * has elapsed). Surfaced to the UI as a dismissible banner so the user
 * knows their next write/mutation requests may fail, WITHOUT being
 * silently signed out of the app.
 */
@Injectable({ providedIn: "root" })
export class AccessRestrictionService {
  private readonly _restricted = signal(false);
  private readonly _reason = signal<string | null>(null);

  readonly restricted = this._restricted.asReadonly();
  readonly reason = this._reason.asReadonly();

  show(reason: string) {
    this._reason.set(reason);
    this._restricted.set(true);
  }

  dismiss() {
    this._restricted.set(false);
    this._reason.set(null);
  }
}
