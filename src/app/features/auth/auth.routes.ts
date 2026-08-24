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
    path: 'password-login',
    loadComponent: () =>
      import('./password-login/password-login.page').then((m) => m.PasswordLoginPage),
  },
  {
    path: 'login-with-otp',
    loadComponent: () =>
      import('./login-with-otp/login-with-otp.page').then((m) => m.LoginWithOtpPage),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./forgot-password/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./reset-password/reset-password.page').then((m) => m.ResetPasswordPage),
  },
  {
    path: 'qr-scanner',
    loadComponent: () =>
      import('./qr-scanner/qr-scanner.page').then((m) => m.QrScannerPage),
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
  {
    path: 'change-password',
    loadComponent: () =>
      import('./change-password/change-password.page').then((m) => m.ChangePasswordPage),
  },
];
