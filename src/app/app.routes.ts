import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    redirectTo: "dashboard",
  },
  {
    path: "dashboard",
    loadComponent: () => import("./pages/universal-dashboard.page").then((m) => m.UniversalDashboardPage),
  },
  {
    path: "login",
    loadComponent: () => import("./pages/login.page").then((m) => m.LoginPage),
  },
  {
    path: "setup-account",
    loadComponent: () => import("./pages/setup-account.component").then((m) => m.SetupAccountComponent),
  },
  {
    path: "clients",
    loadComponent: () => import("./pages/client-dashboard.page").then((m) => m.ClientDashboardPage),
  },
  {
    path: "projects",
    loadComponent: () => import("./pages/projects-directory.page").then((m) => m.ProjectsDirectoryPage),
  },
  {
    path: "approvals",
    loadComponent: () => import("./pages/pending-approvals.page").then((m) => m.PendingApprovalsPage),
  },
  {
    path: "settings",
    loadComponent: () => import("./pages/settings/settings-shell.component").then((m) => m.SettingsShellComponent),
    children: [
      { path: "", pathMatch: "full", redirectTo: "account" },
      { path: "account", loadComponent: () => import("./pages/settings/settings-account.component").then((m) => m.SettingsAccountComponent) },
      { path: "notifications", loadComponent: () => import("./pages/settings/settings-notifications.component").then((m) => m.SettingsNotificationsComponent) },
      { path: "appearance", loadComponent: () => import("./pages/settings/settings-appearance.component").then((m) => m.SettingsAppearanceComponent) },
      { path: "roles", loadComponent: () => import("./pages/settings/settings-roles.component").then((m) => m.SettingsRolesComponent) },
      { path: "roles/employee/:id", loadComponent: () => import("./pages/settings/settings-employee-detail.component").then((m) => m.SettingsEmployeeDetailComponent) },
      { path: "sites", loadComponent: () => import("./pages/settings/settings-sites.component").then((m) => m.SettingsSitesComponent) },
      { path: "access-schedule", loadComponent: () => import("./pages/settings/settings-access-schedule.component").then((m) => m.SettingsAccessScheduleComponent) },
      { path: "sessions", loadComponent: () => import("./pages/settings/settings-sessions.component").then((m) => m.SettingsSessionsComponent) },
      { path: "reports", loadComponent: () => import("./pages/settings/settings-reports.component").then((m) => m.SettingsReportsComponent) },
    ],
  },
  {
    path: "clients/:clientId",
    loadComponent: () => import("./pages/client-workspace.page").then((m) => m.ClientWorkspacePage),
  },
  {
    path: "clients/:clientId/projects/:projectId/:section",
    loadComponent: () => import("./pages/project-workspace.page").then((m) => m.ProjectWorkspacePage),
  },
  {
    path: "clients/:clientId/projects/:projectId",
    loadComponent: () => import("./pages/project-workspace.page").then((m) => m.ProjectWorkspacePage),
  },
  {
    path: "**",
    redirectTo: "clients",
  },
];
