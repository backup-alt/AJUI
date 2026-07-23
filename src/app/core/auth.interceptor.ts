import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, switchMap, throwError, of, from } from "rxjs";
import { HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";
import { AccessRestrictionService } from "./access-restriction.service";

/**
 * Adds the Bearer token to outgoing requests and handles auth error responses.
 *
 * Session persistence policy:
 * - 401 (token expired / invalid) -> attempt ONE silent refresh using the
 *   stored refresh token. If the refresh succeeds, retry the original
 *   request with the new access token. If the refresh fails, the request
 *   fails as normal and the user is NOT auto-logged-out.
 * - 403 ACCESS_SCHEDULE_RESTRICTED -> surface an in-app banner via
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

  const token = (() => {
    try { return localStorage.getItem("ajui_access_token"); } catch { return null; }
  })();

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

      // 403 ACCESS_SCHEDULE_RESTRICTED -> banner only
      if (err.status === 403) {
        const errorCode = err.error?.code || err.error?.error?.code;
        const errorMessage = err.error?.error || err.error?.message || "";
        if (
          errorCode === "ACCESS_SCHEDULE_RESTRICTED" ||
          errorMessage.includes("Access timing is over")
        ) {
          restriction.show(
            errorMessage || "Access timing is over. Contact admin if you need access.",
          );
        }
      }

      // 401 on a non-auth call -> try refresh once, then retry the original
      if (err.status === 401 && !isAuthCall) {
        return from(api.refreshTokens()).pipe(
          switchMap((res) => {
            if (!res) {
              return throwError(() => err);
            }
            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${res.accessToken}` },
            });
            return next(retryReq);
          }),
          catchError(() => throwError(() => err)),
        );
      }

      return throwError(() => err);
    }),
  );
};
