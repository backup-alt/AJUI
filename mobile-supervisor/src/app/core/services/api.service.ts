import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;

  get<T>(path: string, params?: Record<string, string | number | boolean>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(k, String(v));
        }
      }
    }
    return this.http
      .get<T>(`${this.baseUrl}${path}`, { params: httpParams })
      .pipe(catchError((err) => throwError(() => this.toAppError(err))));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError((err) => throwError(() => this.toAppError(err))));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .patch<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError((err) => throwError(() => this.toAppError(err))));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .put<T>(`${this.baseUrl}${path}`, body)
      .pipe(catchError((err) => throwError(() => this.toAppError(err))));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<T>(`${this.baseUrl}${path}`)
      .pipe(catchError((err) => throwError(() => this.toAppError(err))));
  }

  /** Canonical HTTP error → AppError converter. */
  toAppError(error: HttpErrorResponse): Error {
    if (error.error instanceof ErrorEvent) {
      return new Error(error.error.message || 'Network error');
    }
    if (error.status === 0) {
      return new Error('Unable to connect to server. Please check your internet connection.');
    }

    const serverMessage =
      (typeof error.error === 'object' && error.error && 'message' in error.error
        ? (error.error as { message?: string }).message
        : undefined) ||
      (typeof error.error === 'object' && error.error && 'error' in error.error
        ? (error.error as { error?: string }).error
        : undefined);

    switch (error.status) {
      case 400:
        return new Error(serverMessage || 'Invalid request');
      case 401:
        return new Error(serverMessage || 'Session expired. Please login again.');
      case 403:
        return new Error(serverMessage || 'You do not have permission to perform this action');
      case 404:
        return new Error(serverMessage || 'Resource not found');
      case 409:
        return new Error(serverMessage || 'Conflict occurred');
      case 410:
        return new Error(serverMessage || 'Resource no longer available');
      case 422:
        return new Error(serverMessage || 'Validation failed');
      case 429:
        return new Error('Too many requests. Please wait a moment and try again.');
      case 500:
        return new Error('Server error. Please try again later.');
      case 502:
      case 503:
      case 504:
        return new Error('Server temporarily unavailable. Please try again later.');
      default:
        return new Error(serverMessage || `Request failed (${error.status})`);
    }
  }

  // ---------------- Token storage ----------------

  async getAccessToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'accessToken' });
    return value || null;
  }

  async setAccessToken(token: string): Promise<void> {
    await Preferences.set({ key: 'accessToken', value: token });
  }

  async clearTokens(): Promise<void> {
    await Preferences.remove({ key: 'accessToken' });
    await Preferences.remove({ key: 'refreshToken' });
  }

  async getRefreshToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'refreshToken' });
    return value || null;
  }

  async setRefreshToken(token: string): Promise<void> {
    await Preferences.set({ key: 'refreshToken', value: token });
  }

  async getUserId(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'userId' });
    return value || null;
  }

  async setUserId(id: string): Promise<void> {
    await Preferences.set({ key: 'userId', value: id });
  }

  async getUserRole(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'userRole' });
    return value || null;
  }

  async setUserRole(role: string): Promise<void> {
    await Preferences.set({ key: 'userRole', value: role });
  }

  // ---------------- Selected site / project storage ----------------

  async getSelectedSiteId(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'selectedSiteId' });
    return value || null;
  }

  async setSelectedSiteId(siteId: string): Promise<void> {
    await Preferences.set({ key: 'selectedSiteId', value: siteId });
  }

  async getSelectedProjectId(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'selectedProjectId' });
    return value || null;
  }

  async setSelectedProjectId(projectId: string): Promise<void> {
    await Preferences.set({ key: 'selectedProjectId', value: projectId });
  }

  async getSelectedProjectName(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'selectedProjectName' });
    return value || null;
  }

  async setSelectedProjectName(name: string): Promise<void> {
    await Preferences.set({ key: 'selectedProjectName', value: name });
  }

  async getSelectedSiteName(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'selectedSiteName' });
    return value || null;
  }

  async setSelectedSiteName(name: string): Promise<void> {
    await Preferences.set({ key: 'selectedSiteName', value: name });
  }

  async clearSiteSelection(): Promise<void> {
    await Preferences.remove({ key: 'selectedSiteId' });
    await Preferences.remove({ key: 'selectedProjectId' });
    await Preferences.remove({ key: 'selectedProjectName' });
    await Preferences.remove({ key: 'selectedSiteName' });
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getAccessToken();
    return !!token;
  }

  // ---------------- Refresh token (with safe fallback) ----------------

  /**
   * Refresh the access token. Throws on failure.
   * Used by the interceptor; pages should not call this directly.
   */
  async refreshAccessToken(): Promise<string> {
    return this.refreshAccessTokenSafely();
  }

  /**
   * Same as refreshAccessToken but never throws "No refresh token" — returns empty string instead.
   * This is the version the auth interceptor uses, so a missing refresh token simply
   * triggers logout rather than an opaque error.
   */
  async refreshAccessTokenSafely(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return '';

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      await this.clearTokens();
      return '';
    }

    const data = (await response.json()) as { accessToken?: string };
    if (!data.accessToken) {
      await this.clearTokens();
      return '';
    }

    await this.setAccessToken(data.accessToken);
    return data.accessToken;
  }
}
