import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;
  private refreshPromise: Promise<string> | null = null;

  get<T>(path: string, params?: Record<string, string>): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, { params }).pipe(
      catchError((err) => this.handleError(err))
    );
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body).pipe(
      catchError((err) => this.handleError(err))
    );
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body).pipe(
      catchError((err) => this.handleError(err))
    );
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${path}`, body).pipe(
      catchError((err) => this.handleError(err))
    );
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`).pipe(
      catchError((err) => this.handleError(err))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let message = 'An unexpected error occurred';

    if (error.error instanceof ErrorEvent) {
      message = error.error.message || 'Network error';
    } else if (error.status === 0) {
      message = 'Unable to connect to server. Please check your internet connection.';
    } else if (error.error && typeof error.error === 'object' && error.error.message) {
      message = error.error.message;
    } else {
      switch (error.status) {
        case 400:
          message = 'Invalid request';
          break;
        case 401:
          message = 'Session expired. Please login again.';
          break;
        case 403:
          message = error.error?.message || 'Access denied';
          break;
        case 404:
          message = error.error?.message || 'Resource not found';
          break;
        case 409:
          message = error.error?.message || 'Conflict occurred';
          break;
        case 410:
          message = error.error?.message || 'Resource no longer available';
          break;
        case 422:
          message = error.error?.message || 'Validation failed';
          break;
        case 429:
          message = 'Too many requests. Please wait a moment and try again.';
          break;
        case 500:
          message = 'Server error. Please try again later.';
          break;
        case 502:
        case 503:
        case 504:
          message = 'Server temporarily unavailable. Please try again later.';
          break;
        default:
          message = error.error?.message || `Request failed (${error.status})`;
      }
    }

    return throwError(() => new Error(message));
  }

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

  isAuthenticated(): Promise<boolean> {
    return this.getAccessToken().then((token) => !!token);
  }

  async refreshAccessToken(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include',
    });

    if (!response.ok) {
      await this.clearTokens();
      throw new Error('Session expired');
    }

    const data = await response.json();
    await this.setAccessToken(data.accessToken);
    return data.accessToken;
  }

  async ensureValidToken(): Promise<string> {
    const token = await this.getAccessToken();
    if (token) return token;

    try {
      return await this.refreshAccessToken();
    } catch {
      throw new Error('Not authenticated');
    }
  }
}