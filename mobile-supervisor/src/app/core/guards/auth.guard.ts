import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isAuthenticated = await auth.isLoggedIn();

  if (!isAuthenticated) {
    router.navigate(['/auth/login']);
    return false;
  }

  return true;
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isAuthenticated = await auth.isLoggedIn();

  if (isAuthenticated) {
    router.navigate(['/tabs/dashboard']);
    return false;
  }

  return true;
};

export const supervisorGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isSupervisor = await auth.isSupervisor();

  if (!isSupervisor) {
    router.navigate(['/tabs/dashboard']);
    return false;
  }

  return true;
};