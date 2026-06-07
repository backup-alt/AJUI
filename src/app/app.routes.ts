import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    redirectTo: "clients",
  },
  {
    path: "clients",
    loadComponent: () => import("./pages/client-dashboard.page").then((m) => m.ClientDashboardPage),
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
