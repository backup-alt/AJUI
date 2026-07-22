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
      // Network error (status 0) or server unavailable (5xx) — do NOT log out the user.
      // These are transient failures, not auth problems.
      if (error.status === 0 || error.status >= 500) {
        return throwError(() => error);
      }

      const isRefreshPath = req.url.includes('/auth/refresh');
      const isLogoutPath = req.url.includes('/auth/logout');

      if (isLogoutPath) {
        // Server may be unreachable during logout; just let the caller handle it.
        return throwError(() => error);
      }

      if (error.status === 401 && !isRefreshPath) {
        // Try to refresh the access token once before giving up.
        return from(
          (async () => {
            try {
              const newToken = await api.refreshAccessTokenSafely();
              return newToken;
            } catch {
              return '';
            }
          })()
        ).pipe(
          switchMap((t): Observable<HttpEvent<unknown>> => {
            if (!t) {
              // Refresh failed: the session is truly over. Clear tokens and log out.
              api.clearTokens().catch(() => {});
              void auth.logout().catch(() => {});
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
