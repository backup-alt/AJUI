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
    path: "clients",
    loadComponent: () => import("./pages/client-dashboard.page").then((m) => m.ClientDashboardPage),
  },
  {
    path: "settings",
    loadComponent: () => import("./pages/settings.page").then((m) => m.SettingsPage),
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
