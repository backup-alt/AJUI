import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Observable, from, of, throwError } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { ApiService } from './api.service';
import {
  LoginResponse,
  QRInvitePayload,
  VerifyInviteResponse,
  SignupRequest,
  User,
} from '../../shared/models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  currentUser: User | null = null;
  isAuthenticated = false;

  async init(): Promise<void> {
    const token = await this.api.getAccessToken();
    this.isAuthenticated = !!token;

    if (this.isAuthenticated) {
      const userData = await Preferences.get({ key: 'currentUser' });
      if (userData.value) {
        try {
          this.currentUser = JSON.parse(userData.value);
        } catch {
          this.currentUser = null;
        }
      }
    }
  }

  async loginWithQRCode(): Promise<{ scanned: boolean; payload?: QRInvitePayload }> {
    try {
      const scanner = BarcodeScanner;

      const permResult = await scanner.requestPermissions();
      const hasPermission =
        permResult.camera === 'granted' ||
        (permResult as unknown as { granted?: boolean }).granted === true ||
        String(permResult).includes('granted');

      if (!hasPermission) {
        console.error('Camera permission denied:', permResult);
        return { scanned: false };
      }

      const { available } = await scanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        console.log('Installing Google Barcode Scanner module...');
        await scanner.installGoogleBarcodeScannerModule();
      }

      await Haptics.impact({ style: ImpactStyle.Light });

      const result = await scanner.scan();
      const barcodes = result.barcodes;

      if (!barcodes || barcodes.length === 0) {
        return { scanned: false };
      }

      const scannedData = barcodes[0]?.rawValue;
      if (!scannedData) {
        return { scanned: false };
      }

      console.log('QR scanned raw data:', scannedData);

      let payload: QRInvitePayload;

      try {
        payload = JSON.parse(scannedData);
        console.log('QR parsed as JSON:', payload);
      } catch {
        console.log('QR is plain text, treating as token');
        payload = { token: scannedData, type: 'supervisor' as const, expiresAt: '' };
      }

      console.log('QR payload type check:', payload.type);

      if (payload.type && payload.type !== 'supervisor') {
        throw new Error('Invalid QR code for supervisor login');
      }

      if (!payload.token) {
        throw new Error('Invalid QR code: missing token');
      }

      await Haptics.impact({ style: ImpactStyle.Medium });
      return { scanned: true, payload };
    } catch (error) {
      console.error('QR scan error:', error);
      return { scanned: false };
    }
  }

      verifyInvite(token: string): Observable<VerifyInviteResponse> {
    return this.api.get<VerifyInviteResponse>(`/auth/supervisor/verify/${token}`);
  }

  verifyOtp(inviteToken: string, otp: string): Observable<{ valid: boolean }> {
    return this.api.post<{ valid: boolean }>('/auth/supervisor/verify-otp', {
      inviteToken,
      otp,
    });
  }

  resendOtp(inviteToken: string): Observable<{ success: boolean; message?: string }> {
    return this.api.post<{ success: boolean; message?: string }>(
      '/auth/supervisor/resend-otp',
      { inviteToken }
    );
  }

  signup(request: SignupRequest): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/supervisor/signup', request).pipe(
      tap((response) => this.saveAuthData(response))
    );
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.api.post<LoginResponse>('/auth/login', { email, password }).pipe(
      tap((response) => this.saveAuthData(response))
    );
  }

  private async saveAuthData(response: LoginResponse): Promise<void> {
    await this.api.setAccessToken(response.accessToken);
    await this.api.setUserId(response.user.id);
    await this.api.setUserRole(response.user.role);
    await Preferences.set({ key: 'currentUser', value: JSON.stringify(response.user) });

    this.currentUser = response.user;
    this.isAuthenticated = true;
  }

  async logout(): Promise<void> {
    try {
      await this.api.delete('/auth/logout');
    } catch {
      // Ignore logout errors
    }

    await this.api.clearTokens();
    await Preferences.remove({ key: 'currentUser' });
    this.currentUser = null;
    this.isAuthenticated = false;

    await Haptics.impact({ style: ImpactStyle.Light });
    this.router.navigate(['/auth/login']);
  }

  async isLoggedIn(): Promise<boolean> {
    return this.api.isAuthenticated();
  }

  getProfile(): Observable<{ user: User; profile: unknown }> {
    return this.api.get<{ user: User; profile: unknown }>('/mobile/supervisor/profile');
  }

  updateProfile(data: { name?: string; email?: string; phone?: string }): Observable<unknown> {
    return this.api.patch<unknown>('/mobile/supervisor/profile', data);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ success: boolean }> {
    return this.api.put<{ success: boolean }>('/auth/password', {
      currentPassword,
      newPassword,
    });
  }

  async getAccessToken(): Promise<string | null> {
    return this.api.getAccessToken();
  }

  async refreshToken(): Promise<void> {
    try {
      const newToken = await this.api.refreshAccessToken();
      await this.api.setAccessToken(newToken);
    } catch (error) {
      await this.logout();
      throw error;
    }
  }

  async hasRole(role: string): Promise<boolean> {
    const userRole = await this.api.getUserRole();
    return userRole === role;
  }

  async isSupervisor(): Promise<boolean> {
    return this.hasRole('supervisor');
  }
}