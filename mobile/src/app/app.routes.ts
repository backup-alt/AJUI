import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'tabs/home',
    pathMatch: 'full',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      { path: 'home', loadComponent: () => import('./pages/home/home.page').then((m) => m.HomePage) },
      { path: 'materials', loadComponent: () => import('./pages/materials/materials.page').then((m) => m.MaterialsPage) },
      { path: 'labour', loadComponent: () => import('./pages/labour/labour.page').then((m) => m.LabourPage) },
      { path: 'expense', loadComponent: () => import('./pages/expense/expense.page').then((m) => m.ExpensePage) },
      { path: 'approvals', loadComponent: () => import('./pages/approvals/approvals.page').then((m) => m.ApprovalsPage) },
    ],
  },
  { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage) },
  { path: 'projects', canActivate: [authGuard], loadComponent: () => import('./pages/projects/projects.page').then((m) => m.ProjectsPage) },
  { path: 'payments', canActivate: [authGuard], loadComponent: () => import('./pages/payments/payments.page').then((m) => m.PaymentsPage) },
  { path: 'subcontracts', canActivate: [authGuard], loadComponent: () => import('./pages/subcontracts/subcontracts.page').then((m) => m.SubcontractsPage) },
  { path: 'project/:id', canActivate: [authGuard], loadComponent: () => import('./pages/project-detail/project-detail.page').then((m) => m.ProjectDetailPage) },
  { path: '**', redirectTo: 'tabs/home' },
];