import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { catchError, throwError } from "rxjs";
import { HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  // Get token from localStorage (interceptor runs in client, not in inject context for some calls)
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
      if (err.status === 401 && !req.url.includes("/auth/login") && !req.url.includes("/auth/refresh")) {
        // Token expired or invalid - clear session and redirect to login
        try {
          localStorage.removeItem("ajui_access_token");
          localStorage.removeItem("ajui_refresh_token");
          localStorage.removeItem("ajui_user");
          localStorage.removeItem("ajui_expires_at");
        } catch {}
        // Defer navigation (interceptor context)
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
      return throwError(() => err);
    })
  );
};
