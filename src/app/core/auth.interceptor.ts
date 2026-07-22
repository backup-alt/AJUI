import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, throwError } from "rxjs";
import { HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";
import { AccessRestrictionService } from "./access-restriction.service";

/**
 * Adds the Bearer token to outgoing requests and handles auth error responses.
 *
 * IMPORTANT (Session Persistence policy):
 * - Sessions persist until the user explicitly logs out or closes the
 *   browser window. We do NOT auto-redirect to /login on 401 (token
 *   expiry) — the request simply fails and the user can continue.
 * - For 403 ACCESS_SCHEDULE_RESTRICTED, we surface an in-app banner via
 *   AccessRestrictionService so the user knows their next requests may
 *   fail, but we still do NOT log them out. The backend schedule
 *   restriction remains in force — only its UX changed.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const api = inject(ApiService);
  const restriction = inject(AccessRestrictionService);

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

      // 401 (token expired / invalid) — previously: clearSession + redirect
      // to /login. Now: just let the request fail. The user can manually
      // log out via the header/menu or close the window.
      if (err.status === 401 && !isAuthCall) {
        // Intentionally no clearSession() and no router.navigate here.
        // Token refresh logic (if any) is handled separately.
        void api;
      }

      // 403 ACCESS_SCHEDULE_RESTRICTED — backend still rejects requests
      // outside the configured time window. We surface this to the UI via
      // the AccessRestrictionService banner instead of silently logging out.
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
