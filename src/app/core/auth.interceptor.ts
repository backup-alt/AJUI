import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";

/**
 * Adds the Bearer token to outgoing requests and handles 401 responses.
 *
 * IMPORTANT: We do NOT force a hard redirect (`window.location.href`) on
 * 401 anymore — that destroys component state and silently kicks the
 * admin off pages like Settings. Instead we let the component decide
 * what to do (show a toast, log out, etc.) and only do a router redirect
 * for routes that are clearly outside the admin workspace.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  // Interceptors run inside an injection context, so inject() is safe here.
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
        try {
          localStorage.removeItem("ajui_access_token");
          localStorage.removeItem("ajui_refresh_token");
          localStorage.removeItem("ajui_user");
          localStorage.removeItem("ajui_expires_at");
          localStorage.removeItem("agb-erp:session");
        } catch {}

        queueMicrotask(() => {
          try {
            router.navigate(["/login"]);
          } catch {}
        });
      }

      if (err.status === 403) {
        const errorCode = err.error?.code || err.error?.error?.code;
        const errorMessage = err.error?.error || err.error?.message || "";

        if (errorCode === "ACCESS_SCHEDULE_RESTRICTED" || errorMessage.includes("Access timing is over")) {
          try {
            localStorage.removeItem("ajui_access_token");
            localStorage.removeItem("ajui_refresh_token");
            localStorage.removeItem("ajui_user");
            localStorage.removeItem("ajui_expires_at");
            localStorage.removeItem("agb-erp:session");
          } catch {}

          queueMicrotask(() => {
            try {
              router.navigate(["/login"], { queryParams: { reason: "access_schedule" } });
            } catch {}
          });
        }
      }

      return throwError(() => err);
    })
  );
};