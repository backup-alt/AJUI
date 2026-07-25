import { HttpInterceptorFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, Observable, switchMap, throwError } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

const PUBLIC_PATHS: ReadonlyArray<string> = [
  '/auth/login',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/supervisor/verify',
  '/auth/supervisor/verify-otp',
  '/auth/supervisor/resend-otp',
  '/auth/supervisor/signup',
  '/auth/supervisor/request-otp',
  '/auth/supervisor/verify-otp-login',
  '/auth/refresh',
];

function isPublicPath(url: string): boolean {
  const path = url.replace(environment.apiUrl, '');
  if (path.startsWith('/auth/refresh')) return true;
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'));
}

/**
 * Tracks whether a refresh is already in progress so concurrent 401s
 * don't all fire separate refresh attempts.
 */
let refreshInProgress = false;
let refreshPromise: Promise<string> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiService);
  const auth = inject(AuthService);

  if (isPublicPath(req.url)) {
    return next(req);
  }

  return from(api.getAccessToken()).pipe(
    switchMap((token): Observable<HttpEvent<unknown>> => {
      if (!token) return next(req);
      const authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      return next(authReq);
    }),
    catchError((error: HttpErrorResponse): Observable<HttpEvent<unknown>> => {
      // Network error (status 0) or server unavailable (5xx) — do NOT log out.
      if (error.status === 0 || error.status >= 500) {
        return throwError(() => error);
      }

      const isRefreshPath = req.url.includes('/auth/refresh');
      const isLogoutPath = req.url.includes('/auth/logout');

      if (isLogoutPath) {
        return throwError(() => error);
      }

      if (error.status === 401 && !isRefreshPath) {
        // Deduplicate concurrent refresh attempts using a shared promise.
        if (!refreshInProgress) {
          refreshInProgress = true;
          refreshPromise = (async () => {
            try {
              return await api.refreshAccessTokenSafely();
            } catch {
              return '';
            } finally {
              refreshInProgress = false;
            }
          })();
        }

        return from(refreshPromise ?? Promise.resolve('')).pipe(
          switchMap((t): Observable<HttpEvent<unknown>> => {
            if (!t) {
              // Refresh failed — signal session expiry so the app can show
              // a re-login prompt. Do NOT clear tokens or navigate to login
              // here; the app component handles the UI transition.
              auth.sessionExpired.set(true);
              return throwError(() => error);
            }
            // Retry the original request with the new access token.
            return next(
              req.clone({ setHeaders: { Authorization: `Bearer ${t}` } })
            );
          })
        );
      }
      return throwError(() => error);
    })
  );
};
