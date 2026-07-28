import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, switchMap, throwError, of, from } from "rxjs";
import { HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";
import { AccessRestrictionService } from "./access-restriction.service";

/**
 * Returns the full login URL for the current deployment.
 * On GitHub Pages at /AJUI/, this returns "https://backup-alt.github.io/AJUI/#/login".
 * On localhost:4200, it returns "http://localhost:4200/#/login".
 * Uses window.location to auto-detect the base path from the deployed Angular app.
 */
function getLoginUrl(): string {
  // window.location.pathname gives us the current path (e.g. "/AJUI/dashboard")
  // We need to preserve the base path (e.g. "/AJUI") and append "#/login"
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  // The first segment is typically the base path (e.g. "AJUI") for GitHub Pages project sites
  // For root deployments, pathParts is empty
  const basePath = pathParts.length > 0 && pathParts[0] !== 'index.html'
    ? '/' + pathParts[0]
    : '';
  return window.location.origin + basePath + '/#/login';
}

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const api = inject(ApiService);
  const restriction = inject(AccessRestrictionService);

  let token: string | null = null;
  try {
    token = sessionStorage.getItem("ajui_access_token");
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
        return from(api.refreshTokens()).pipe(
          switchMap((res) => {
            if (!res) {
              api.clearSession();
              window.location.href = getLoginUrl();
              return throwError(() => err);
            }
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${res.accessToken}` },
            });
            return next(retryReq);
          }),
          catchError(() => {
            api.clearSession();
            window.location.href = getLoginUrl();
            return throwError(() => err);
          }),
        );
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
