# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

AGB (Annai Golden Builders) Operations Workspace — a full-stack construction/real-estate project management platform with three separately-deployed apps that share one backend:

- **Web admin dashboard** (`src/`) — Angular 20 + Ionic 8 SPA, deployed to GitHub Pages at `/AJUI/`.
- **Backend API** (`backend/`) — Express 4 + Mongoose 8, deployed to Render.com free tier (Starter plan, Oregon region).
- **Supervisor mobile app** (`mobile-supervisor/`) — Ionic 8 + Capacitor 8 Android app for site supervisors.

`mobile/` is a legacy Angular 18 project — ignore it unless explicitly asked. Treat `dist/`, `.angular/`, APKs, and dependency directories as generated output.

The three apps all hit the same REST API. The frontend `apiUrl` is in `src/environments/environment.ts` (dev) and `environment.prod.ts` (prod: `https://agb-o3cc.onrender.com/api`). Mobile app's API base is set in its own environment/service.

## Commands

### Web frontend (`src/`, root `package.json`)
- `npm ci` — install deps from lockfile.
- `npm run dev` — `ng serve` on `127.0.0.1` (default port 4200).
- `npm run build` — production build → `dist/annai-builders-dashboard/`.
- `npm run build:pages` — production build with `--base-href /AJUI/` for GitHub Pages.
- `npm run preview` — serve with prod config.
- `npm run serve:dist` — serve built output via `scripts/serve-dist.cjs`.
- `npm run test` — placeholder that prints `cd backend && npm test` (the web app has **no unit tests**).

### Backend (`backend/`)
- `npm ci && npm run dev` — install and run watched API on port 4000 (Swagger at `/api-docs`).
- `npm run build` — `tsc --noEmit` (type-check only).
- `npm start` — `tsx src/app.ts` (production-style start).
- `npm test` — Jest in-band (`--runInBand`); needs MongoDB at `MONGODB_TEST_URI` (defaults to `mongodb://127.0.0.1:27017/ajui_test`).
- `npm run test:coverage` — Jest with coverage.
- `npm run migrate:images:dry-run` / `npm run migrate:images` — pCloud image migration scripts.

### Mobile (`mobile-supervisor/`)
- `npm ci && npm run build` — Angular build → `www/`.
- `npx cap sync android` — sync web build to native Android project.
- `cd android && ./gradlew assembleDebug` — produce debug APK at `android/app/build/outputs/apk/debug/app-debug.apk`.
- `npm run lint` — Angular ESLint.
- `npm test` — Jasmine/Karma unit tests.

### Single-test invocation
- Backend: `cd backend && npx jest --runInBand __tests__/auth.test.ts` (or any specific `.test.ts`).
- Mobile: `cd mobile-supervisor && npx ng test -- --include='**/foo.spec.ts' --browsers=ChromeHeadless`.

## High-Level Architecture

### Backend (`backend/src/`)

Layered: **routes → controllers → services → models**. Zod schemas live in `schemas/` and are applied via the `validate()` middleware in route files. There are 12 route files mounted under `/api/*` in `src/app.ts`:

`auth`, `admin`, `entities` (clients/projects/sites/supervisors/custom-fields), `financial` (payments/expenses/materials/labour/subcontractors/POs), `dashboard`, `mobile` (supervisor-specific endpoints), `rbac`, `vendor-extra`, `quotation`, `invoice`, `company-profile`, `media`.

Cross-cutting middleware (in `src/middleware/`):
- `auth.ts` — JWT verification + **access-schedule** enforcement. Admins bypass; others get 403 if outside the configured time windows (uses IST timezone). Schedule is cached for 30 s.
- `rbac.ts` — `requireRole`, `requireAdmin`, and **scope queries** that restrict a user's results to their `managedProjectIds`. Scope cache is 60 s and is invalidated by `invalidateAccessCache()` when project assignments change.
- `cache.ts` — in-memory GET response cache keyed by `(method, url, last-20-chars-of-token)`. Coalesces in-flight identical requests. Writes to the same path bust the cache. Always sets `Cache-Control: no-store`.
- `validation.ts` — wraps Zod schemas; validates body/query/params.
- `errorHandler.ts` — `AppError` class + final `errorHandler`/`notFound`.

Bootstrap (`src/app.ts`'s `bootstrap()`) is defensive — every startup step is wrapped in its own try/catch so the server still comes up if (e.g.) the email service or Firebase is misconfigured. Compound indexes for Material/Expense/Labour/Approval/Inventory are ensured on every boot. The `/keepalive` endpoint pings three M0 collections to keep the connection pool warm; the frontend hits it every 10 min to prevent Render free-tier spin-down.

Hydration endpoints (`/api/materials/all`, `/api/inventory/all`, `/api/expenses/all`, `/api/invoices/all`) get a custom 5-min timeout to survive M0 cold starts.

### Web frontend (`src/`)

Standalone Angular 20 components throughout, OnPush change detection, signals-based reactivity. Router uses **hash-based routing** (`withHashLocation()`) so it works on GitHub Pages static hosting.

Layout split in `src/app/`:
- `core/` — services (`api.service.ts`, `workspace-hydration.service.ts`, `materials.service.ts`, `approvals.service.ts`, `custom-fields.service.ts`), the auth interceptor, guards, and DTO mappers. **All HTTP goes through `ApiService`**; it carries the in-memory GET cache (TTL-based, ~200 entries max), refresh-token handling, and a typed surface for every entity. The interceptor handles 401 → refresh → retry, and 403 `ACCESS_SCHEDULE_RESTRICTED` → shows the access banner via `AccessRestrictionService`.
- `pages/` — routed page components (`universal-dashboard.page.ts`, `project-workspace.page.ts`, `quotation.page.ts`, etc.) plus a `settings/` subfolder with 8 settings sub-pages mounted under `/settings` via `settings-shell.component.ts`. Page filenames use `*.page.ts` suffix.
- `shared/` — reusable UI: form dialogs, the enterprise header/sidebar, data tables, Excel/PDF export helpers.
- `data/erp-data.service.ts` — the **single source of truth for hydrated data**. Holds signals (`clients`, `projects`, `materials`, etc.) that every page reads from instead of refetching. `WorkspaceHydrationService` populates these signals.

**Workspace hydration flow** — on `AppComponent.ngOnInit()`, if the user is authenticated, `WorkspaceHydrationService.hydrateFromBackend()`:
1. Fetches a "critical" set of entities (clients, projects, vendors — the dashboard needs them immediately).
2. Persists a snapshot to `localStorage` under `agb-erp:hydrationSnapshotV1` (max 24 h old) for fast cold loads.
3. Background-loads first pages (200 records) of the remaining modules.
4. Each module supports cursor-paginated `loadNextPage()` for infinite scroll.

The mobile-supervisor app has its own feature/layout split (`mobile-supervisor/src/app/{features,core,layout,shared}/`) and is independent of the web frontend's structure.

### Auth flow

- Login returns an access token (JWT) and a refresh token; tokens are stored in `localStorage` (`ajui_access_token`).
- `authGuard` checks `ApiService.isAuthenticated()`; `publicOnlyGuard` redirects authenticated users away from `/login`, `/setup-account`, `/signup/employee`.
- The access interceptor (in `core/auth.interceptor.ts`) attaches `Authorization: Bearer`, retries failed requests once after a refresh, and hard-redirects to `/#/login` on refresh failure. Login redirect URL is auto-detected from `window.location.pathname` to support the `/AJUI/` base-href.

## Conventions

- Two-space indentation, double quotes in TS, trailing commas in multiline declarations.
- File naming: kebab-case with role suffixes — `auth.routes.ts`, `dashboard.controller.ts`, `universal-dashboard.page.ts`, `*.service.ts`, `*.schema.ts`. Test files: backend `*.test.ts` (Jest/Supertest, in `backend/__tests__/`), mobile `*.spec.ts` (Jasmine/Karma).
- Backend uses ES modules with `.js` import suffixes (`import { x } from "./foo.js"`); the ts-jest config maps them back via `moduleNameMapper`.
- Strict TS — strict mode + `strictTemplates` are on; don't weaken them. Prefer `inject()` over constructor DI. Standalone components only.
- Class names are `PascalCase`; variables and signals are `camelCase`. Signals end with `()` when read.
- Commits are short and imperative (e.g., "Add Notes textarea...", "Drop Opening Expense Balance field..."); keep each commit to one logical change.
- Pull requests should describe behavior and affected apps, flag any migration needs, link the issue, and include screenshots for UI changes. Run relevant builds and tests before review.

## Environment & Secrets

- Backend env vars are validated via Zod in `backend/src/config/env.ts`. Copy `backend/.env.example` (it is checked into the repo as a 2-byte placeholder — create the real one locally).
- Required: `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (each ≥16 chars).
- Optional: `RESEND_API_KEY`, `GMAIL_USER`/`GMAIL_APP_PASSWORD`, Firebase creds, `PCLOUD_BEARER_TOKEN`/`PCLOUD_FOLDER_ID`, `FRONTEND_URL`, `BACKEND_PUBLIC_URL`, `QR_BASE_URL`, `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME`/`ADMIN_PHONE`.
- Use `MONGODB_TEST_URI` for automated tests — never point tests at production DB.
- Never commit `.env`, `atlas-credentials.env`, or `*.apk`. `atlas-credentials.env` and all `.env*` files are git-ignored.

## Testing Guidance

- Backend: `cd backend && npm test` runs Jest in-band. Requires MongoDB at `MONGODB_TEST_URI` (defaults to `mongodb://127.0.0.1:27017/ajui_test`). Coverage: `npm run test:coverage`.
- Mobile: `cd mobile-supervisor && npm test` runs Jasmine/Karma in headless Chrome. CI runs these with `continue-on-error: true` — failures don't block merges.
- Web frontend has **no unit tests** — `npm run test` at the repo root is a placeholder.
- When adding tests: focus on authentication, RBAC permissions, Zod validation, and service behavior — these are the layers most likely to break silently.

## Deployment

- **Frontend**: GitHub Pages via `.github/workflows/deploy-pages.yml` — runs `npm run build:pages` on push to `main` and copies `index.html` → `404.html` for SPA fallback.
- **Backend**: Render.com via `render.yaml` — auto-deploys on push to `main` from `backend/`. Build: `npm ci --omit=dev --no-audit --no-fund --prefer-offline && npm run build`. Start: `npm start`.
- **Mobile**: Manual APK build via the Gradle command above; the workflow CI runs typecheck + lint + Karma tests (mobile tests are `continue-on-error: true`).
- The `/health` endpoint reports the current deploy; the `deploy` string in `backend/src/app.ts` should be bumped on each deploy.

## CI

`.github/workflows/ci.yml` runs on push/PR to `main`:
- Backend: `npm ci` → `npm run build` (typecheck) → `npm test` against a MongoDB 7 service container.
- Mobile: install Chromium, `npm ci` → `tsc --noEmit` → `npm run lint` → `npm test --browsers=ChromeHeadless` (mobile tests are `continue-on-error`).

## Things That Are Easy to Miss

- The `/keepalive` ping is what keeps the backend alive on Render's free tier — do not remove it.
- `WorkspaceHydrationService`'s snapshot version (`SNAPSHOT_VERSION`) must be bumped whenever the persisted shape changes; the constructor currently calls `clearPersistedSnapshot()` to reset stale state.
- `api.service.ts`'s in-memory cache TTLs and `cache.ts`'s in-process cache are tuned for the M0 free tier — be careful when adjusting cache sizes or TTLs, as over-caching causes stale data on writes and under-caching floods the connection pool.
- The web app has a `keepalive` ping (every 10 min) and an in-app splash removal — both live in `AppComponent`.
- `AccessSchedule` uses **IST** (`+330` minutes) for time windows; `getISTDayIndex()`/`getISTMinutes()` in `backend/src/middleware/auth.ts`.
- `mobile/` is legacy — do not add new features there. Use `mobile-supervisor/` for mobile work.
- Swagger UI is at `http://localhost:4000/api-docs` — the JSDoc-style `@openapi` comments in route files are what populates it.
</content>
</invoke>