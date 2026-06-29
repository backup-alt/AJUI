import { Injectable, signal, computed } from '@angular/core';
import { User } from '../models/types';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly STORAGE_KEY = 'agb_session';
  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  setUser(user: User | null) {
    this.currentUser.set(user);
    if (user) {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ id: user.id, ts: Date.now() }));
      } catch {}
    } else {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
      } catch {}
    }
  }

  logout() {
    this.setUser(null);
  }
}