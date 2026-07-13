import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'qr-scanner',
    loadComponent: () =>
      import('./qr-scanner/qr-scanner.page').then((m) => m.QrScannerPage),
  },
  {
    path: 'otp-login',
    loadComponent: () =>
      import('./otp-login/otp-login.page').then((m) => m.OtpLoginPage),
  },
  {
    path: 'manual-token',
    loadComponent: () =>
      import('./manual-token/manual-token.page').then((m) => m.ManualTokenPage),
  },
  {
    path: 'verify-otp',
    loadComponent: () =>
      import('./verify-otp/verify-otp.page').then((m) => m.VerifyOtpPage),
  },
  {
    path: 'signup',
    loadComponent: () => import('./signup/signup.page').then((m) => m.SignupPage),
  },
];
