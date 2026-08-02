import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Preferences } from '@capacitor/preferences';
import { Observable, of, throwError, timeout, finalize, shareReplay } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Default request timeout for list/data endpoints.
 * M0 MongoDB can be slow on cold queries; 25s gives it a fair chance while
 * still surfacing "request failed" feedback to the user instead of hanging.
 */
const DEFAULT_TIMEOUT_MS = 25000;

/**
 * Timeout for the auth refresh call — should be fast or fail fast.
 */
const REFRESH_TIMEOUT_MS = 10000;
const GET_CACHE_TTL_MS = 5 * 60_000;

interface CachedGet {
  data: unknown;
  expiresAt: number;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  readonly baseUrl = environment.apiUrl;
  private readonly getCache = new Map<string, CachedGet>();
  private readonly inFlightGets = new Map<string, Observable<unknown>>();

  get<T>(path: string, params?: Record<string, string | number | boolean>, timeoutMs: number = DEFAULT_TIMEOUT_MS): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(k, String(v));
        }
      }
    }
    const url = `${this.baseUrl}${path}`;
    const query = httpParams.toString();
    const cacheKey = query ? `${url}?${query}` : url;
    const cached = this.getCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return of(cached.data as T);
    if (cached) this.getCache.delete(cacheKey);

    const inFlight = this.inFlightGets.get(cacheKey);
    if (inFlight) return inFlight as Observable<T>;

    const request = this.http
      .get<T>(url, { params: httpParams })
      .pipe(
        timeout(timeoutMs),
        tap((data) => this.cacheGet(cacheKey, data)),
        catchError((err) => throwError(() => this.toAppError(err))),
        finalize(() => this.inFlightGets.delete(cacheKey)),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    this.inFlightGets.set(cacheKey, request as Observable<unknown>);
    return request;
  }

  post<T>(path: string, body: unknown, timeoutMs: number = DEFAULT_TIMEOUT_MS): Observable<T> {
    return this.http
      .post<T>(`${this.baseUrl}${path}`, body)
      .pipe(
        timeout(timeoutMs),
        tap(() => this.clearGetCache()),
        catchError((err) => throwError(() => this.toAppError(err)))
      );
  }

  patch<T>(path: string, body: unknown, timeoutMs: number = DEFAULT_TIMEOUT_MS): Observable<T> {
    return this.http
      .patch<T>(`${this.baseUrl}${path}`, body)
      .pipe(
        timeout(timeoutMs),
        tap(() => this.clearGetCache()),
        catchError((err) => throwError(() => this.toAppError(err)))
      );
  }

  put<T>(path: string, body: unknown, timeoutMs: number = DEFAULT_TIMEOUT_MS): Observable<T> {
    return this.http
      .put<T>(`${this.baseUrl}${path}`, body)
      .pipe(
        timeout(timeoutMs),
        tap(() => this.clearGetCache()),
        catchError((err) => throwError(() => this.toAppError(err)))
      );
  }

  delete<T>(path: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Observable<T> {
    return this.http
      .delete<T>(`${this.baseUrl}${path}`)
      .pipe(
        timeout(timeoutMs),
        tap(() => this.clearGetCache()),
        catchError((err) => throwError(() => this.toAppError(err)))
      );
  }

  private cacheGet(key: string, data: unknown): void {
    if (this.isEmptyListResponse(data)) return;
    this.getCache.set(key, { data, expiresAt: Date.now() + GET_CACHE_TTL_MS });
    if (this.getCache.size > 200) {
      const oldestKey = this.getCache.keys().next().value;
      if (oldestKey) this.getCache.delete(oldestKey);
    }
  }

  /** Remove cached GET responses for one API path (or every GET when omitted). */
  invalidateGetCache(pathPrefix?: string): void {
    if (!pathPrefix) {
      this.clearGetCache();
      return;
    }
    const absolutePrefix = `${this.baseUrl}${pathPrefix}`;
    for (const key of this.getCache.keys()) {
      if (key.startsWith(absolutePrefix)) this.getCache.delete(key);
    }
  }

  private clearGetCache(): void {
    this.getCache.clear();
  }

  private isEmptyListResponse(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    const response = data as Record<string, unknown>;
    return ['items', 'materials', 'expenses', 'labour'].some(
      (key) => Array.isArray(response[key]) && response[key].length === 0
    );
  }

  /** Canonical HTTP error → AppError converter. */
  toAppError(error: HttpErrorResponse | { name?: string; message?: string }): Error {
    // RxJS TimeoutError — request took too long
    if (error && (error.name === 'TimeoutError' || error.message?.includes('Timeout'))) {
      return new Error('Request is taking longer than expected. Please try again — your data will load as soon as the server responds.');
    }
    // Narrow: HttpErrorResponse has .error and .status; the plain object branch doesn't.
    const httpErr = error as HttpErrorResponse;
    if (httpErr.error instanceof ErrorEvent) {
      return new Error(httpErr.error.message || 'Network error');
    }
    if (httpErr.status === 0) {
      return new Error('Unable to connect to server. Please check your internet connection.');
    }

    const body = (typeof httpErr.error === 'object' && httpErr.error) || {};

    const firstFieldError = (() => {
      const fields = (body as { details?: { fieldErrors?: Record<string, string[]> } }).details?.fieldErrors;
      if (!fields) return undefined;
      for (const key of Object.keys(fields)) {
        const list = fields[key];
        if (Array.isArray(list) && list.length > 0) return list[0];
      }
      return undefined;
    })();

    const serverMessage =
      firstFieldError ||
      ((body as { message?: string }).message) ||
      ((body as { error?: string }).error);

    const appError: Error & { details?: unknown } = new Error(
      serverMessage || this.fallbackMessage(httpErr.status)
    );
    if ((body as { details?: unknown }).details) {
      appError.details = (body as { details?: unknown }).details;
    }
    return appError;
  }

  private fallbackMessage(status: number): string {
    switch (status) {
      case 400:
        return 'Invalid request';
      case 401:
        return 'Session expired. Please login again.';
      case 403:
        return 'You do not have permission to perform this action';
      case 404:
        return 'Resource not found';
      case 409:
        return 'Conflict occurred';
      case 410:
        return 'Resource no longer available';
      case 422:
        return 'Validation failed';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
      case 503:
      case 504:
        return 'Server temporarily unavailable. Please try again later.';
      default:
        return `Request failed (${status})`;
    }
  }

  // ---------------- Token storage ----------------

  async getAccessToken(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'accessToken' });
    return value || null;
  }

  async setAccessToken(token: string): Promise<void> {
    this.clearGetCache();
    await Preferences.set({ key: 'accessToken', value: token });
  }

  async clearTokens(): Promise<void> {
    this.clearGetCache();
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
   * Same as refreshAccessToken but never throws "No refresh token" - returns empty string instead.
   * This is the version the auth interceptor uses, so a missing refresh token simply
   * triggers a retry failure rather than an opaque error.
   *
   * Important: This method NEVER clears tokens. Token clearing is handled only by
   * the explicit logout() flow. Network errors, 5xx responses, and even 401/403 from
   * the refresh endpoint do NOT clear tokens — they just return empty string so the
   * interceptor can throw the original error. This prevents random logouts caused by
   * transient backend issues, proxy errors, or race conditions.
   */
  async refreshAccessTokenSafely(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    if (!refreshToken) return '';

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch {
      // Network error or timeout — don't clear tokens, just fail this refresh attempt.
      return '';
    }

    if (!response.ok) {
      // Never clear tokens here. Return empty string so the interceptor
      // throws the original 401 error. Only the explicit logout() flow
      // should clear tokens.
      return '';
    }

    const data = (await response.json().catch(() => ({}))) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!data.accessToken) {
      // Response was 200 but missing accessToken — likely a transient
      // backend/proxy issue. Don't clear tokens.
      return '';
    }

    await this.setAccessToken(data.accessToken);
    if (data.refreshToken) {
      await this.setRefreshToken(data.refreshToken);
    }
    return data.accessToken;
  }
}
