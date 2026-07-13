import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { firstValueFrom, from, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  LoginResponse,
  QRInvitePayload,
  VerifyInviteResponse,
  SignupRequest,
  User,
} from '../../shared/models';

export interface QrScanResult {
  scanned: boolean;
  payload?: QRInvitePayload;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = signal<boolean>(false);

  async init(): Promise<void> {
    const token = await this.api.getAccessToken();
    this.isAuthenticated.set(!!token);

    if (token) {
      const userData = await Preferences.get({ key: 'currentUser' });
      if (userData.value) {
        try {
          this.currentUser.set(JSON.parse(userData.value) as User);
        } catch {
          this.currentUser.set(null);
        }
      }
    }
  }

  /**
   * Open the camera and scan a supervisor invite QR code.
   * Returns a typed result so the caller can decide what to do.
   */
  async loginWithQRCode(): Promise<QrScanResult> {
    try {
      const permResult = await BarcodeScanner.requestPermissions();
      const granted = permResult.camera === 'granted';
      if (!granted) {
        return { scanned: false, error: 'Camera permission denied' };
      }

      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      await Haptics.impact({ style: ImpactStyle.Light });
      const result = await BarcodeScanner.scan();
      const barcodes = result.barcodes;

      if (!barcodes || barcodes.length === 0) {
        return { scanned: false };
      }

      const raw = barcodes[0]?.rawValue;
      if (!raw) {
        return { scanned: false, error: 'Empty QR code' };
      }

      let payload: QRInvitePayload;
      try {
        payload = JSON.parse(raw);
      } catch {
        // Plain text token (some admin flows emit a raw token string).
        payload = { token: raw.trim(), type: 'supervisor', expiresAt: '' };
      }

      if (payload.type && payload.type !== 'supervisor') {
        return { scanned: true, error: 'Invalid QR code for supervisor login' };
      }
      if (!payload.token) {
        return { scanned: true, error: 'Invalid QR code: missing token' };
      }

      await Haptics.impact({ style: ImpactStyle.Medium });
      return { scanned: true, payload };
    } catch (err) {
      console.error('[Auth] QR scan error', err);
      return { scanned: false, error: (err as Error).message };
    }
  }

  verifyInvite(token: string) {
    return this.api.get<VerifyInviteResponse>(`/auth/supervisor/verify/${token}`);
  }

  verifyOtp(inviteToken: string, otp: string) {
    return this.api.post<{ valid: boolean }>('/auth/supervisor/verify-otp', {
      inviteToken,
      otp,
    });
  }

  resendInviteOtp(inviteToken: string) {
    return this.api.post<{ success: boolean; message?: string }>(
      '/auth/supervisor/resend-otp',
      { inviteToken }
    );
  }

  signup(request: SignupRequest) {
    return this.api.post<LoginResponse>('/auth/supervisor/signup', request).pipe(
      tap((response) => {
        void this.saveAuthData(response);
      })
    );
  }

  /** Request an OTP for an existing supervisor. */
  requestLoginOtp(identifier: string) {
    return this.api.post<{ success: boolean; message?: string }>(
      '/auth/supervisor/request-otp',
      { identifier }
    );
  }

  /** Verify the OTP and log in. */
  verifyLoginOtp(identifier: string, otp: string) {
    return this.api.post<LoginResponse>('/auth/supervisor/verify-otp-login', {
      identifier,
      otp,
    }).pipe(
      tap((response) => {
        void this.saveAuthData(response);
      })
    );
  }

  /** Forgot password — triggers a reset email. */
  forgotPassword(email: string) {
    return this.api.post<{ success: boolean; message?: string }>(
      '/auth/forgot-password',
      { email }
    );
  }

  resetPassword(token: string, password: string) {
    return this.api.post<{ success: boolean; message?: string }>(
      '/auth/reset-password',
      { token, password }
    );
  }

  private async saveAuthData(response: LoginResponse): Promise<void> {
    await this.api.setAccessToken(response.accessToken);
    await this.api.setUserId(response.user.id);
    await this.api.setUserRole(response.user.role);
    await Preferences.set({ key: 'currentUser', value: JSON.stringify(response.user) });

    this.currentUser.set(response.user);
    this.isAuthenticated.set(true);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.delete('/auth/logout').pipe(catchError(() => of(null))));
    } catch {
      // ignore
    }

    await this.api.clearTokens();
    await Preferences.remove({ key: 'currentUser' });
    this.currentUser.set(null);
    this.isAuthenticated.set(false);

    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    await this.router.navigate(['/auth/login']);
  }

  async isLoggedIn(): Promise<boolean> {
    return this.api.isAuthenticated();
  }

  getProfile() {
    return this.api.get<{ user: User; profile: unknown }>('/mobile/supervisor/profile');
  }

  updateProfile(data: { name?: string; email?: string; phone?: string; address?: string }) {
    return this.api.patch<unknown>('/mobile/supervisor/profile', data);
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.api.put<{ success: boolean }>('/auth/password', {
      currentPassword,
      newPassword,
    });
  }

  async getAccessToken(): Promise<string | null> {
    return this.api.getAccessToken();
  }

  async hasRole(role: string): Promise<boolean> {
    const userRole = await this.api.getUserRole();
    return userRole === role;
  }

  async isSupervisor(): Promise<boolean> {
    return this.hasRole('supervisor');
  }
}
