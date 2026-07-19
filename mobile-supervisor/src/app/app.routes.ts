import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
    canActivate: [guestGuard],
  },
  {
    path: 'tabs',
    loadComponent: () =>
      import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: 'sites',
        loadComponent: () =>
          import('./features/sites/sites.page').then((m) => m.SitesPage),
      },
      {
        path: 'materials',
        loadComponent: () =>
          import('./features/materials/materials.page').then((m) => m.MaterialsPage),
      },
      {
        path: 'materials/create',
        loadComponent: () =>
          import('./features/materials/material-create/material-create.page').then(
            (m) => m.MaterialCreatePage
          ),
      },
      {
        path: 'materials/:id',
        loadComponent: () =>
          import('./features/materials/material-detail/material-detail.page').then(
            (m) => m.MaterialDetailPage
          ),
      },
      {
        path: 'labour',
        loadComponent: () =>
          import('./features/labour/labour.page').then((m) => m.LabourPage),
      },
      {
        path: 'labour/create',
        loadComponent: () =>
          import('./features/labour/labour-create/labour-create.page').then(
            (m) => m.LabourCreatePage
          ),
      },
      {
        path: 'labour/create-worker',
        loadComponent: () =>
          import('./features/labour/labour-create-worker/labour-create-worker.page').then(
            (m) => m.LabourCreateWorkerPage
          ),
      },
      {
        path: 'labour/mark-attendance/:workerId',
        loadComponent: () =>
          import('./features/labour/labour-mark-attendance/labour-mark-attendance.page').then(
            (m) => m.LabourMarkAttendancePage
          ),
      },
      {
        path: 'labour/worker-history/:workerId',
        loadComponent: () =>
          import('./features/labour/labour-worker-history/labour-worker-history.page').then(
            (m) => m.LabourWorkerHistoryPage
          ),
      },
      {
        path: 'labour/edit-attendance/:id',
        loadComponent: () =>
          import('./features/labour/labour-edit-attendance/labour-edit-attendance.page').then(
            (m) => m.LabourEditAttendancePage
          ),
      },
      {
        path: 'labour/:id',
        loadComponent: () =>
          import('./features/labour/labour-detail/labour-detail.page').then(
            (m) => m.LabourDetailPage
          ),
      },
      {
        path: 'labour/worker/:workerId',
        loadComponent: () =>
          import('./features/labour/labour-worker-detail/labour-worker-detail.page').then(
            (m) => m.LabourWorkerDetailPage
          ),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./features/inventory/inventory.page').then(
            (m) => m.InventoryPage
          ),
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./features/expenses/expenses.page').then((m) => m.ExpensesPage),
      },
      {
        path: 'expenses/create',
        loadComponent: () =>
          import('./features/expenses/expense-create/expense-create.page').then(
            (m) => m.ExpenseCreatePage
          ),
      },
      {
        path: 'expenses/:id',
        loadComponent: () =>
          import('./features/expenses/expense-detail/expense-detail.page').then(
            (m) => m.ExpenseDetailPage
          ),
      },
      {
        path: 'requests',
        loadComponent: () =>
          import('./features/requests/requests.page').then(
            (m) => m.RequestsPage
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.page').then((m) => m.ProfilePage),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];