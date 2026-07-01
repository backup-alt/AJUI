import { Injectable, signal, OnDestroy } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NetworkService implements OnDestroy {
  readonly isOnline = signal(navigator.onLine);
  private _listener: () => void;

  constructor() {
    this._listener = () => this.isOnline.set(navigator.onLine);
    window.addEventListener('online', this._listener);
    window.addEventListener('offline', this._listener);
  }

  ngOnDestroy() {
    window.removeEventListener('online', this._listener);
    window.removeEventListener('offline', this._listener);
  }
}