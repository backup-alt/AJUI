import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, throwError, switchMap, tap } from "rxjs";
import { HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from "@angular/common/http";
import { Observable, from, of } from "rxjs";
import { ApiService } from "./api.service";
import { AccessRestrictionService } from "./access-restriction.service";
import { Router } from "@angular/router";

/**
 * Adds the Bearer token to outgoing requests and handles auth error responses.
 * - On 401, attempts token refresh via /auth/refresh endpoint.
 * - If refresh succeeds, retries the original request with new token.
 * - If refresh fails, clears session and redirects to /login.
 */
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const api = inject(ApiService);
  const restriction = inject(AccessRestrictionService);
  const router = inject(Router);

  let token: string | null = null;
  try {
    token = localStorage.getItem("ajui_access_token");
  } catch {}

  let authReq = req;
  if (token && !req.headers.has("Authorization")) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      const isAuthCall =
        req.url.includes("/auth/login") ||
        req.url.includes("/auth/refresh") ||
        req.url.includes("/auth/forgot-password") ||
        req.url.includes("/auth/reset-password") ||
        req.url.includes("/auth/supervisor/verify");

      if (err.status === 401 && !isAuthCall) {
        if (!isRefreshing) {
          isRefreshing = true;
          return api.refreshTokens().pipe(
            tap((res) => {
              isRefreshing = false;
              onTokenRefreshed(res.accessToken);
            }),
            switchMap((res) => {
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${res.accessToken}` },
              });
              return next(retryReq);
            }),
            catchError((refreshErr) => {
              isRefreshing = false;
              api.clearSession();
              router.navigate(["/login"], { queryParams: { returnUrl: req.url } });
              return throwError(() => refreshErr);
            })
          );
        } else {
          return new Observable<HttpEvent<unknown>>((observer) => {
            refreshSubscribers.push((newToken) => {
              const retryReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              });
              next(retryReq).subscribe({
                next: (event) => observer.next(event),
                error: (e) => observer.error(e),
                complete: () => observer.complete(),
              });
            });
          });
        }
      }

      if (err.status === 403) {
        const errorCode = err.error?.code || err.error?.error?.code;
        const errorMessage = err.error?.error || err.error?.message || "";

        if (
          errorCode === "ACCESS_SCHEDULE_RESTRICTED" ||
          errorMessage.includes("Access timing is over")
        ) {
          restriction.show(
            errorMessage ||
              "Access timing is over. Contact admin if you need access.",
          );
        }
      }

      return throwError(() => err);
    })
  );
};
