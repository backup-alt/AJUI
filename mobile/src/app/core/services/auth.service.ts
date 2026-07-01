import { Injectable, signal, computed } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { User } from '../models/types';
import { environment } from '../../../environments/environment';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

const KEYS = {
  ACCESS: 'agb_access_token',
  REFRESH: 'agb_refresh_token',
  USER: 'agb_user',
} as const;

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  private _accessToken = '';

  private get backendUrl() {
    return environment.backendUrl;
  }

  get accessToken() {
    return this._accessToken;
  }

  async init() {
    try {
      const [access, refresh, userRaw] = await Promise.all([
        Preferences.get({ key: KEYS.ACCESS }),
        Preferences.get({ key: KEYS.REFRESH }),
        Preferences.get({ key: KEYS.USER }),
      ]);
      if (access.value && refresh.value && userRaw.value) {
        this._accessToken = access.value;
        this.currentUser.set(JSON.parse(userRaw.value));
      }
    } catch {}
  }

  private async storeSession(tokens: AuthTokens) {
    this._accessToken = tokens.accessToken;
    await Promise.all([
      Preferences.set({ key: KEYS.ACCESS, value: tokens.accessToken }),
      Preferences.set({ key: KEYS.REFRESH, value: tokens.refreshToken }),
      Preferences.set({ key: KEYS.USER, value: JSON.stringify(tokens.user) }),
    ]);
    this.currentUser.set(tokens.user);
  }

  async clearSession() {
    this._accessToken = '';
    this.currentUser.set(null);
    await Promise.all([
      Preferences.remove({ key: KEYS.ACCESS }),
      Preferences.remove({ key: KEYS.REFRESH }),
      Preferences.remove({ key: KEYS.USER }),
    ]);
  }

  private async api(path: string, options: RequestInit = {}) {
    const res = await fetch(`${this.backendUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this._accessToken ? { Authorization: `Bearer ${this._accessToken}` } : {}),
        ...options.headers,
      },
      credentials: 'include',
    });
    if (res.status === 401) {
      const refreshed = await this.refreshToken();
      if (!refreshed) {
        await this.clearSession();
        throw new Error('Unauthorized');
      }
      return this.api(path, options);
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || `HTTP ${res.status}`);
    }
    return res.json();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshRaw = await Preferences.get({ key: KEYS.REFRESH });
      if (!refreshRaw.value) return false;
      const res = await fetch(`${this.backendUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshRaw.value }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      this._accessToken = data.accessToken;
      await Preferences.set({ key: KEYS.ACCESS, value: data.accessToken });
      return true;
    } catch {
      return false;
    }
  }

  // ============== QR Login Flow ==============

  /**
   * GET /api/auth/supervisor/verify/:token
   * Returns { valid, requiresOtp, supervisorName }
   */
  async verifyInvite(token: string): Promise<{ valid: boolean; requiresOtp: boolean; supervisorName: string; message?: string }> {
    try {
      const res = await fetch(
        `${this.backendUrl}/api/auth/supervisor/verify/${encodeURIComponent(token)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' }, credentials: 'include' }
      );
      const body = await res.json().catch(() => ({}));
      return {
        valid: res.ok && !!body.valid,
        requiresOtp: !!body.requiresOtp,
        supervisorName: body.supervisorName || '',
        message: body.message,
      };
    } catch {
      return { valid: false, requiresOtp: false, supervisorName: '', message: 'Cannot reach server' };
    }
  }

  /**
   * POST /api/auth/supervisor/verify-otp
   * Body: { inviteToken, otp }
   * Returns { valid }
   */
  async verifyInviteOtp(inviteToken: string, otp: string): Promise<{ valid: boolean; message?: string }> {
    try {
      const res = await fetch(`${this.backendUrl}/api/auth/supervisor/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ inviteToken, otp }),
      });
      const body = await res.json().catch(() => ({}));
      return { valid: res.ok && !!body.valid, message: body.message };
    } catch {
      return { valid: false, message: 'Cannot reach server' };
    }
  }

  /**
   * POST /api/auth/supervisor/signup
   * Body: { token, otp, password, name, phone?, email? }
   * Returns { accessToken, refreshToken, user }
   */
  async supervisorSignup(params: {
    inviteToken: string;
    otp: string;
    password: string;
    supervisorName: string;
    phone?: string;
    email?: string;
  }): Promise<AuthTokens> {
    const data = await this.api('/api/auth/supervisor/signup', {
      method: 'POST',
      body: JSON.stringify({
        token: params.inviteToken,
        otp: params.otp,
        password: params.password,
        name: params.supervisorName,
        phone: params.phone,
        email: params.email,
      }),
    });
    await this.storeSession(data);
    return data;
  }

  // ============== Token-based Login (for future use) ==============

  async loginWithPassword(email: string, password: string): Promise<AuthTokens> {
    const data = await this.api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await this.storeSession(data);
    return data;
  }

  async logout() {
    try {
      await this.api('/api/auth/logout', { method: 'POST' });
    } catch {}
    await this.clearSession();
  }
}