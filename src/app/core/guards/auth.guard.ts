import { inject } from "@angular/core";
import { Router, CanActivateFn } from "@angular/router";
import { ApiService } from "../api.service";

export const authGuard: CanActivateFn = (_route, _state) => {
  const api = inject(ApiService);
  const router = inject(Router);

  if (api.isAuthenticated()) {
    return true;
  }

  router.navigate(["/login"]);
  return false;
};

export const publicOnlyGuard: CanActivateFn = (_route, _state) => {
  const api = inject(ApiService);
  const router = inject(Router);

  if (api.isAuthenticated()) {
    router.navigate(["/dashboard"]);
    return false;
  }

  return true;
};