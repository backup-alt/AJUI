import { HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, switchMap, throwError, of, from } from "rxjs";
import { HttpErrorResponse, HttpRequest, HttpHandlerFn, HttpEvent } from "@angular/common/http";
import { Observable } from "rxjs";
import { ApiService } from "./api.service";
import { AccessRestrictionService } from "./access-restriction.service";

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
