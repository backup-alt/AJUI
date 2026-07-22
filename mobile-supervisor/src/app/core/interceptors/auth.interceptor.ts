import { HttpInterceptorFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
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
  const router = inject(Router);

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
      const isRefreshPath = req.url.includes('/auth/refresh');

      if (error.status === 401 && !isRefreshPath) {
        return from(
          (async () => {
            const newToken = await api.refreshAccessTokenSafely().catch(() => '');
            return newToken;
          })()
        ).pipe(
          switchMap((t): Observable<HttpEvent<unknown>> => {
            if (!t) {
              // Refresh failed - clear local state and send user back to login.
              api.clearTokens().catch(() => {});
              void auth.logout().catch(() => {});
              return throwError(() => error);
            }
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
