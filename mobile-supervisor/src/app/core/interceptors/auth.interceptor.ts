import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, take, throwError, from } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiService);
  const auth = inject(AuthService);
  const router = inject(Router);

  // Skip auth for public endpoints
  const publicEndpoints = [
    '/auth/login',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/supervisor/verify',
    '/auth/supervisor/verify-otp',
    '/auth/supervisor/resend-otp',
    '/auth/supervisor/signup',
  ];
  const isPublic = publicEndpoints.some((endpoint) => req.url.includes(endpoint));

  if (isPublic) {
    return next(req);
  }

  // Add auth header if token exists
  return from(api.getAccessToken()).pipe(
    take(1),
    switchMap((token) => {
      if (token) {
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });
        return next(authReq);
      }
      return next(req);
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        auth.logout();
        router.navigate(['/auth/login']);
      }
      return throwError(() => error);
    })
  );
};

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'An unexpected error occurred';

      if (error.error instanceof ErrorEvent) {
        message = error.error.message;
      } else {
        switch (error.status) {
          case 0:
            message = 'Unable to connect to server. Please check your internet connection.';
            break;
          case 400:
            message = error.error?.message || 'Invalid request';
            break;
          case 401:
            message = 'Session expired. Please login again.';
            break;
          case 403:
            message = error.error?.message || 'You do not have permission to perform this action';
            break;
          case 404:
            message = error.error?.message || 'Resource not found';
            break;
          case 409:
            message = error.error?.message || 'Conflict occurred';
            break;
          case 422:
            message = error.error?.message || 'Validation failed';
            break;
          case 429:
            message = 'Too many requests. Please wait a moment and try again.';
            break;
          case 500:
            message = 'Server error. Please try again later.';
            break;
          case 502:
          case 503:
          case 504:
            message = 'Server temporarily unavailable. Please try again later.';
            break;
          default:
            message = error.error?.message || `Error: ${error.status}`;
        }
      }

      console.error('HTTP Error:', {
        url: req.url,
        status: error.status,
        message,
        error: error.error,
      });

      return throwError(() => new Error(message));
    })
  );
};