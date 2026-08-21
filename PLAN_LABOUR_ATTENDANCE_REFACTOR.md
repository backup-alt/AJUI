# Plan: Rename Labour → Attendance, add separate Labour module, remove Reports from project workspaces

## Goal

Inside the **project workspace** (per-project view) only — leave the sidebar untouched:

1. **Rename the existing "Labour" tab to "Attendance"** — keeps the field-driven
   attendance table (date, staff count, shift, overtime, fine, labour types,
   Present/Absent) currently keyed `labour`.
2. **Add a new "Labour" tab** — a worker roster table with columns **Name, Phone,
   Role, Address, Notes**. Backed by the existing `Worker` collection (mobile
   supervisor app already creates workers via `POST /supervisor/workers`).
3. **Remove the "Reports" tab** from every project workspace.

The universal dashboard is **not** in scope for this round (the user said "edit
these under project workspace", and the sidebar stays). Note that the existing
attendance backend already merges `Attendance` + `Labour` rows in the project
view (`fetchAttendanceData`); the new Attendance tab will keep that behaviour.

## Why this scope

- The user clarified: "Don't touch anything in the sidenav just edit these
  under project workspace." The universal dashboard is a separate page that
  shows the same data across projects; leaving it alone keeps the diff
  focused and avoids touching base labels that the universal view uses.
- The `Worker` collection already exists with `name`, `labourType` (role),
  `address`, `site`, `projectId`. We need `phone` and `notes` — these are
  added as new optional fields on the backend schema.

## What changes

### 1. Backend — extend Worker schema (small, additive)

**`backend/src/models/Worker.ts`** — add two optional fields:

- `phone?: string` (indexed lightly for lookup)
- `notes?: string`

**`backend/src/schemas/worker.schema.ts`** (or wherever `createWorker`/`updateWorker`
Zod schemas live) — accept the new fields.

**`backend/src/services/worker.service.ts`**

- `createWorker` input type — add `phone?: string`, `notes?: string`.
- `updateWorker` — accept `phone` and `notes` in the patch payload.

**`backend/src/controllers/mobile.controller.ts`**

- `createWorker` validator (it's already a Zod schema) — relax for optional
  `phone` and `notes`.

The mobile supervisor app's `labour-create-worker.page.ts` will get a small
form addition (Phone number + Notes textarea). This is **out of scope** for
this PR — the new fields are optional, so existing forms still work. (We can
park the mobile form update; the new web tab simply shows blank for those
columns on workers created without them.)

### 2. Backend — list workers for a project (web side)

**`backend/src/routes/financial.routes.ts`** (or `entities.routes.ts`) — add a
web (admin) route that returns workers filtered by `projectId`:

```
GET /api/workers?projectId=...&page=...&limit=...&cursor=...
```

This reuses `worker.service.ts#listWorkers` which already accepts `projectId`
and is cursor-paginated. The route sits behind `requireAuth` and the existing
scope middleware (so non-admins only see their assigned projects).

Decision: mount it under **`financial.routes.ts`** alongside the existing
`/labour` and `/subcontractors` routes since it is operational data, not
master data. Tag with `cache(30)` like the other worker reads.

### 3. Frontend — API surface

**`src/app/core/api.service.ts`** — add a typed wrapper:

```ts
listWorkers(opts: { projectId?: string; page?: number; limit?: number; cursor?: string })
  : Observable<{ items: Worker[]; nextCursor?: string; total?: number }>
```

And a `Worker` interface in the same or a co-located mapper file:

```ts
export interface Worker {
  _id: string;
  workerId: string;
  name: string;
  phone?: string;
  labourType: string;   // role
  address?: string;
  notes?: string;
  site?: string;
  projectId: string;
  isSubcontract: boolean;
  subcontractorName?: string;
}
```

Keep strict typing — no `any`.

### 4. Frontend — erp-data service

**`src/app/data/erp-data.service.ts`**

- Add `workers = signal<Worker[]>([])` and `workersLoading = signal(false)`.
- Add a new `SharedModuleKey` member: `| "workers"` (or `| "labourRoster"` —
  pick a name that doesn't clash with the existing `labour` key). I'll use
  `"workers"` because it's the entity name on the backend.
- Add `workersForProject(projectId)` getter that filters by project.
- Add `addWorker` / `updateWorker` / `deleteWorker` methods that wrap the API
  service and update the local signal optimistically.
- Add `workers` to the hydration "critical" set **only if the user is an
  admin** — non-admins continue to rely on scoped hydration.

### 5. Frontend — project workspace tab config

**`src/app/pages/project-workspace.page.ts`** — `sectionConfigs` array:

- **Replace** the existing `labour` section (key `labour`, label `Labour`,
  title `Labour Attendance`) with an **`attendance`** section with key
  `"attendance"`, label **"Attendance"**, title **"Attendance Register"**,
  and the same columns (renamed headers where appropriate — e.g. drop
  "Subcontractor" → keep it since the data has it; "Date" stays).
- **Add** a new section with key `"workers"`, label **"Labour"**, title
  **"Worker Roster"**, columns:
  - `{ key: "name", label: "Name" }`
  - `{ key: "phone", label: "Phone" }`
  - `{ key: "labourType", label: "Role" }`
  - `{ key: "address", label: "Address" }`
  - `{ key: "notes", label: "Notes" }`
  - `{ key: "site", label: "Site" }`
- **Remove** the `reports` section entirely.

**`type ModuleKey`** — the `Exclude<SharedModuleKey, ...>` already excludes
`generalExpenses`, `clients`, `purchaseOrders`, `settings`, `supervisors`.
After adding `workers` to `SharedModuleKey`, the new module key will be
included automatically. The old `labour` module key stays in the union
(other branches of the table config still use it, e.g. the moveable
summary/`fetchAttendanceData` logic). **The `labour` key remains as a
shared data signal** (still signals the legacy `/labour` collection); the
**section config** is the only thing that changes.

**`activeSection` routing** — the project workspace route uses the section
key as a URL segment. Existing deep links of the form
`/clients/:clientId/projects/:projectId/labour` will need to redirect (or
the section label will read "Attendance"). Acceptable: a one-line effect
that watches `activeSection()` and, if equal to `"labour"`, repoints to
`"attendance"`. I'll add this — it's a small, readable safety net.

### 6. Frontend — project workspace table render

**`src/app/pages/project-workspace.page.ts`** — the table render branch is a
big `*ngIf` switch keyed off `activeSection()`. I will:

- Update the `*ngIf="activeSection() === 'labour'"` rendering to
  `*ngIf="activeSection() === 'attendance'"` (template + `groupLabourRows` call).
- Add a new branch for `*ngIf="activeSection() === 'workers'"` that renders
  the worker roster. This is a simpler table (no grouping, no labour-type
  chips, no summary HTML) — just the columns above with inline edit and
  a "+ Add Worker" button that opens a small modal.

**Add Worker dialog** — a small new component
`src/app/shared/worker-form-dialog.component.ts` (standalone, matching the
existing `project-form-dialog.component.ts` pattern). Fields: Name,
Phone, Role (select with the standard `LABOUR_TYPES` from the mobile app:
Carpenter, Plumber, Electrician, Painter, Mason, Helper, Steel Fixer,
Tiles Worker, Welder, Fabricator, Civil, Other), Address, Notes, Site.

**Toolbar visibility** — the existing per-section toolbar buttons (filter,
add, export) are already keyed by `activeSection()`. The new "Labour" tab
will get:

- Add (opens the new dialog)
- Export (Excel, mirrors the existing util)
- Filter (uses the same filter builder)
- Delete (multi-row, same as other tabs)

No CSV/PDF download row button (that was a Reports-only thing).

### 7. Frontend — remove Reports

**`src/app/pages/project-workspace.page.ts`**

- Remove the `reports` config from `sectionConfigs` (lines 156-168).
- Remove the `*ngIf="activeSection() === 'reports'"` row-action button
  (lines 588-601) — it's the only remaining `reports` branch in the
  template.
- Remove the `downloadReportRow(row: TableRow)` method (lines 2969-2979) —
  no other callers.
- Remove the `reportMappings` from the `customizable` register (the
  `reportMappings` const declared around line 3380) and the `data.reports`
  signal read side, if any.
- Clean the `ModuleKey` union if `reports` was in it — but `reports` is a
  `SharedModuleKey`, not excluded, so the type stays as `SharedModuleKey`'s
  other consumers still widens to it. **Keep `reports` in
  `SharedModuleKey`** for now (universal dashboard still uses it) — only
  drop it from the project workspace section config and template.

### 8. Wikis / docs / behaviour parity

- The `erp-data.service.ts` `clients.labourPayable` accounting and the
  mobile supervisor's `/labour`/`attendance` writes are unaffected: the
  `labour` collection and `Attendance` collection on the backend are
  untouched. The new **Worker** tab is read-mostly from the web (only
  add/edit/delete — the mobile app is the primary creator).
- `fetchAttendanceData` and `groupLabourRows` continue to power the
  new "Attendance" tab; the function name stays for code-search parity.

## File touch list

### Modify
- `backend/src/models/Worker.ts` — add `phone`, `notes` fields.
- `backend/src/schemas/worker.schema.ts` (or wherever Zod for createWorker
  lives) — accept optional `phone`/`notes`.
- `backend/src/services/worker.service.ts` — accept optional `phone`/`notes`
  in `createWorker` and `updateWorker`.
- `backend/src/controllers/mobile.controller.ts` — pass new fields through.
- `backend/src/routes/financial.routes.ts` — add
  `GET /api/workers?projectId=...` route.
- `src/app/core/api.service.ts` — add `listWorkers` / `createWorker` /
  `updateWorker` / `deleteWorker` methods.
- `src/app/data/erp-data.service.ts` — add `workers` signal,
  `SharedModuleKey` member, getter, mutators.
- `src/app/pages/project-workspace.page.ts` — section configs (rename
  labour → attendance, add workers, remove reports); template branch;
  add `*ngIf="activeSection() === 'workers'"` table; remove report-only
  rows/methods; redirect legacy `labour` URL activeSection() to
  `attendance`.

### Add
- `src/app/shared/worker-form-dialog.component.ts` — new standalone form
  dialog for the Add Worker modal.

### Do NOT touch
- `src/app/pages/universal-dashboard.page.ts` (out of scope).
- `src/app/shared/enterprise-sidebar.component.ts` (per user).
- `src/app/pages/subcontractor-dashboard.page.ts` and
  `subcontractor-details.page.ts` (already separate).
- `mobile-supervisor/...` (mobile form for phone/notes is nice-to-have,
  not in scope; new fields are optional so existing forms still work).
- `backend/src/routes/mobile.routes.ts` worker POST/GET — keep as-is.
- `Report.ts` backend model — leave it; the universal dashboard may still
  reference it.

## Verification

1. **Backend typecheck**
   `cd backend && npm run build` — must pass.
2. **Web typecheck**
   `npm run build` (root) — must pass with strict mode + strictTemplates.
3. **Manual smoke (assumes dev server)**
   - Open a project workspace.
   - Confirm the tab bar reads: **Materials · Attendance · Expenses · Payments ·
     Vendors · Sub-Contractors · Inventory · Labour** (no Reports).
   - Click "Attendance" — old table renders, Present/Absent, labour-type
     chips, group rows by date/subcontractor still work.
   - Click "Labour" — worker roster shows for the current project. Empty
     state if no workers.
   - Add Worker dialog opens, submits, the row appears immediately.
   - ToL legacy URL `/clients/:c/projects/:p/labour` redirects to
     `attendance` (router reflects in URL).
   - Reports tab is gone — no leftover references in the template.
4. **Regression**: attendance rows from the mobile supervisor app still
   appear in the Attendance tab (verify with one fresh mobile attendance).

## Out of scope (call out at the end)

- The mobile supervisor's `labour-create-worker.page.ts` does not yet
  capture Phone / Notes. Workers added via the web will show those fields;
  workers added via the mobile app will show blank Phone/Notes. Adding
  the mobile form fields is a small follow-up.
- The universal dashboard's Labour tab still shows today's combined
  attendance — the user did not ask for it to be changed. We can revisit
  if the user wants the universal view to follow the same Rename +
  Add Labour treatment.
