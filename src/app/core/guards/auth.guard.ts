import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SupervisorService } from '../services/supervisor.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const supervisor = inject(SupervisorService);
  const router = inject(Router);

  const isAuthenticated = await auth.isLoggedIn();
  if (!isAuthenticated) {
    return router.createUrlTree(['/auth/login']);
  }

  // Ensure supervisor site selection is hydrated before any tab page runs.
  await supervisor.init();
  return true;
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isAuthenticated = await auth.isLoggedIn();
  if (isAuthenticated) {
    return router.createUrlTree(['/tabs/dashboard']);
  }
  return true;
};

export const supervisorGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const isSupervisor = await auth.isSupervisor();
  if (!isSupervisor) {
    return router.createUrlTree(['/tabs/dashboard']);
  }
  return true;
};
