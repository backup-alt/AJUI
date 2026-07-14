import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { ApiService } from "../api.service";

export const authGuard: CanActivateFn = (_route, state) => {
  const api = inject(ApiService);
  const router = inject(Router);

  if (api.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(["/login"], { queryParams: { returnUrl: state.url } });
};

export const publicOnlyGuard: CanActivateFn = (_route, _state) => {
  const api = inject(ApiService);
  const router = inject(Router);

  if (api.isAuthenticated()) {
    return router.createUrlTree(["/dashboard"]);
  }

  return true;
};
