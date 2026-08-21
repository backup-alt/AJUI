# Plan — Per-project Subcontractors roster + project-scoped Subcontractor Labour + UI polish

## Scope (recap of user request)

1. **Per-project workspace Subcontractors roster** — new table inside each project workspace acting as a *reference roster* of subcontractor profiles assigned to that project (NAME / ADDRESS / PHONE / NOTES / STATUS). Adding a row uses a dropdown of existing subs plus an "Add new subcontractor..." option that POSTs `/api/subcontractors` and refreshes the universal page. Existing "Subcontractor Payments" tab stays for actual payment recording.
2. **Universal subcontractor page** — cards/table currently display only Name / Total Paid / Note / Status / Actions. Also render Address and Phone.
3. **Hide "Add Row" on Attendance tab only** — supervisors on mobile remain the source of attendance records.
4. **Subcontractor page "Add Labour" form** — add a project dropdown. When a labour entry is added inside a subcontractor, it should be linked to a project and automatically show up in that project's labour table.

Confirmed in conversation: Add-row is hidden only on Attendance; new subs from the project workspace create a real `Subcontractor` record via `POST /api/subcontractors`.

---

## Background facts established by research

- The per-project "Subcontractor Payments" tab is currently a *payment ledger* (`date/description/amount`) — not a profile roster. Driven by a private `subcontractorPayments` signal in `project-workspace.page.ts:3282` populated from `api.listSubcontractorPayments({projectId,limit:500})`.
- The user calls the universal subcontractor page display "cards" — it's actually a table (`subcontractor-dashboard.page.ts:73-112`). Address and Phone are already on the row model and the mapper; they're just not rendered.
- The "Add labour" feature lives on the **details page** (`subcontractor-details.page.ts:320-362`), not on a per-card inline form. It writes to `SubcontractorLabor` (model has no `projectId`), which is **separate** from the `Labour` attendance collection.
- The per-project workspace "Labour" tab was renamed to **Attendance** (driven by `Labour`/`listLabour`) and a separate **`workers` section** was added as the worker roster (`data.workers()` from the Worker model). Subcontractor labour is currently *not* shown in either tab.
- The backend `Subcontractor` model already has `phone` and `address`. The `SubcontractorLabor` model does **not** have `projectId`. The frontend `SubcontractorLabor` row interface has no `projectId`.
- There is no `mapSubcontractorLabor` — the labour drawer reads the raw response.

---

## Implementation strategy

### 1. Backend — `SubcontractorLabor` model gains `projectId`

**File:** `backend/src/models/SubcontractorLabor.ts`

- Add `projectId?: mongoose.Types.ObjectId;` and `projectName?: string;` (denormalised for display, same convention as `Worker`).
- Update the docstring noting the field is optional (a labour can exist sub-contractor-scoped only) and, when set, the row is eligible to appear in the project's worker roster.

**File:** `backend/src/schemas/financial.schema.ts`

- Extend `createSubcontractorLaborSchema` and `updateSubcontractorLaborSchema` to accept an optional `projectId: z.string().optional()` and `projectName: z.string().max(120).optional()`.

**File:** `backend/src/services/subcontractor-labor.service.ts` (or wherever the create/update logic lives — confirm during implementation)

- Pass `projectId` and `projectName` through to the model. If `projectId` provided but `projectName` missing, look up the project by id and fill it in (mirroring the existing pattern in `worker.service.ts`).

**File:** `backend/src/controllers/financial.controller.ts`

- In `createSubcontractorLabor` and `updateSubcontractorLabor`, plumb the new fields through.

No new routes — `projectId` is just a field on the existing endpoint.

### 2. Frontend — Universal subcontractor dashboard shows Address + Phone

**File:** `src/app/pages/subcontractor-dashboard.page.ts`

- Add two new `<th>` columns: `Address` and `Phone`, plus the matching `<td>` cells.
- Bump the `colspan` on the empty-state row from `5` to `7`.
- (Cosmetic only — the data is already on `SubcontractorRow`.)

### 3. Frontend — `SubcontractorLabor` row carries `projectId`

**File:** `src/app/pages/subcontractor-details.page.ts`

- Extend `SubcontractorLabor` row interface (if present locally) with `projectId?: string; projectName?: string;`.
- Add a `projectId` field to `emptyLaborDraft()` so it's set on open.
- In the labour drawer template, add a new `<label>` between **Notes** and the footer: a project `<select>` sourced from `this.erp.projects()`. Default to `""` (no project) so the existing behaviour of "subcontractor-only labour" still works.
- In `saveLaborer()`, include `projectId` and `projectName` in the payload.
- On successful create/update, **also upsert a `Worker` row** when `projectId` is set, so the labour appears in the project's Workers tab. This mirrors the existing pattern in `project-workspace.page.ts`'s `createWorkerEntry`. Implementation: after `api.createSubcontractorLabor(payload)` (or update), call `api.createWorker({ name, phone, labourType: role, address, notes, site, projectId })`. For edits, look up the corresponding Worker (if any) and `api.patchWorker(workerId, ...)` — keep this simple and idempotent by matching on `(projectId, name, phone)`. If a Worker already exists with that triple, update it; otherwise create one. Failures here should not block the labour save — log to console and continue.
- Render `projectName` in the labour list table on the details page (optional column addition).

### 4. Frontend — Per-project workspace Subcontractors roster (new section)

**Files:**
- `src/app/pages/project-workspace.page.ts`
- `src/app/shared/subcontractor-form-dialog.component.ts` (NEW — mirrors `worker-form-dialog.component.ts`)
- `src/app/data/erp-data.service.ts`
- `src/app/core/api.service.ts` (already has `createSubcontractor`, `patchSubcontractor`, `listSubcontractors` — no new API needed)

**Step 4a — Add the section config**

In `project-workspace.page.ts` `sectionConfigs`, add a new entry **before** the existing `subcontractors` (payments) entry:

```ts
{
  key: "subcontractorsRoster",
  label: "Subcontractors",
  title: "Subcontractors",
  description: "Sub-contractor profiles assigned to this project. Use the Subcontractor Payments tab below to record actual payments.",
  columns: [
    { key: "subcontractorName", label: "Subcontractor Name" },
    { key: "address", label: "Address" },
    { key: "phone", label: "Phone No." },
    { key: "notes", label: "Notes" },
    { key: "status", label: "Status" },
  ],
},
```

Update `SharedModuleKey` and all three `emptyShared*Map` helpers in `erp-data.service.ts` to include `"subcontractorsRoster"` so the type system stays consistent.

**Step 4b — Row source signal**

Add a private signal `subcontractorRoster` initialised to `[]`. Populate it inside `loadProjectExpenseRollup` (or a new sibling method `loadProjectRoster`) by calling `api.listSubcontractors({ limit: 500 })` and filtering client-side by `projectId === this.projectId()`. (Backend doesn't expose a project filter on `/subcontractors`, so client-side filter is acceptable — there are typically <500 subs.)

Add a `subcontractorRosterRows()` computed that maps rows to the section row shape.

**Step 4c — Add-Row behaviour**

Override `openRecordDialog()` (or add a section-key check inside it) so that `subcontractorsRoster` opens a small inline "pick existing sub or add new" drawer rather than the generic record dialog. Specifically:

- New method `openRosterAddRow()`:
  - Roster dropdown options built from `data.subcontractors()` plus a synthetic `"__new__"` entry labelled "+ Add new subcontractor…".
  - When user picks an existing sub, immediately `POST /api/subcontractor-project-links` — **OR** — simpler approach: since `Subcontractor.projectId` already exists on the model, **PATCH** the existing sub's `projectId` to this project (via `api.patchSubcontractor`). The backend already accepts `projectId` in the patch payload.
  - When user picks "__new__", open the new `SubcontractorFormDialogComponent` (mirroring `WorkerFormDialogComponent`) — prefill `projectId` to the current project, capture name/address/phone/notes/status, then `api.createSubcontractor(payload)`. On success, refresh the universal subcontractor page (which already loads via `listSubcontractors`).

Cleanest fallback: just call the new `SubcontractorFormDialogComponent` for both flows — prefill `subcontractorName` if an existing one is picked, otherwise blank. That avoids two paths.

After save, refresh both the local roster signal **and** the universal subcontractor page (the latter via `data.refresh()` or a dedicated signal).

**Step 4d — Wire in the dialog component**

Add `SubcontractorFormDialogComponent` to the page's `imports` array. Bind via `[blurred]` / signals exactly like `WorkerFormDialogComponent` does today.

### 5. Frontend — Hide "Add Row" on Attendance tab only

**File:** `src/app/pages/project-workspace.page.ts`

- Extend `isNoCreateTab()` (currently at line 2801):

```ts
isNoCreateTab(): boolean {
  const s = this.activeSection();
  return s === "materials" || s === "expenses" || s === "vendors" || s === "attendance";
}
```

That's the only change — the toolbar Add Row button already uses `!isNoCreateTab()` in its `*ngIf`. The `attendance` section will then hide the button. The other tabs (workers, expenses, payments, vendors, subcontractors, subcontractorsRoster, inventory) keep their Add Row affordance.

### 6. `SNAPSHOT_VERSION` bump

The persisted hydration shape doesn't change with this work, but the new `subcontractorsRoster` section key flows through `SharedModuleKey`, which IS in the hydration snapshot. **Bump `SNAPSHOT_VERSION` from 8 → 9** in `src/app/core/workspace-hydration.service.ts`.

### 7. New shared component — `SubcontractorFormDialogComponent`

**File:** `src/app/shared/subcontractor-form-dialog.component.ts` (NEW)

Standalone OnPush component mirroring `worker-form-dialog.component.ts`. Inputs:

- `eyebrow: string`
- `title: string`
- `description: string`
- `submitLabel: string`
- `submitting: boolean`
- `initialValue: { subcontractorName: string; address: string; phone: string; notes: string; status: 'active' | 'inactive' } | null`

Outputs: `cancel: EventEmitter<void>`, `create: EventEmitter<FormValue>`.

Fields: name (required), address, phone, notes, status select. No project picker — the page passes the projectId separately when wiring up the submit handler.

### 8. New API service methods (probably not needed — already exist)

`ApiService` already has:

- `listSubcontractors({limit,page})`
- `createSubcontractor(payload)`
- `patchSubcontractor(id, payload)`
- `createWorker(payload)` / `patchWorker(id, payload)` / `listWorkers(...)` — for the labour → worker upsert

No new API service methods needed. The cache-invalidation pattern is already correct on `createSubcontractor` / `patchSubcontractor`.

---

## Files touched

**Backend:**
1. `backend/src/models/SubcontractorLabor.ts`
2. `backend/src/schemas/financial.schema.ts`
3. `backend/src/services/subcontractor-labor.service.ts` (verify exact name during impl)
4. `backend/src/controllers/financial.controller.ts` (plumb `projectId`/`projectName`)

**Frontend:**
5. `src/app/pages/project-workspace.page.ts` (new section config, roster signal, add-row override, isNoCreateTab)
6. `src/app/pages/subcontractor-dashboard.page.ts` (add Address + Phone columns)
7. `src/app/pages/subcontractor-details.page.ts` (project dropdown in labour drawer, worker upsert, projectName in list)
8. `src/app/shared/subcontractor-form-dialog.component.ts` (NEW)
9. `src/app/data/erp-data.service.ts` (`SharedModuleKey` and three map helpers)
10. `src/app/core/workspace-hydration.service.ts` (`SNAPSHOT_VERSION` → 9)

**No new routes / endpoints.** All existing routes are reused.

---

## Verification plan

1. `cd backend && npm run build` — must pass (tsc --noEmit).
2. `cd backend && npx jest --runInBand` — must pass (no auth/Mongo changes affecting existing tests; existing labour/sub tests should still pass with optional `projectId`).
3. `npm run build` (root) — must pass (Angular strict TS + strictTemplates).
4. Manual smoke checklist (deferred to user — Render free tier + Mongo are live):
   - Open a project workspace → see **Subcontractors** tab → Add Row → pick existing sub → row appears.
   - Same flow → "Add new subcontractor…" → fill form → row appears in BOTH the project workspace AND the universal subcontractor page.
   - Universal subcontractor page → see Address + Phone columns populated.
   - Attendance tab → no Add Row button.
   - Open a sub-contractor → Labour Details → Add Labour → see project dropdown → fill, save → switch to that project's Workers tab → labour entry appears.

---

## Out of scope / not changing

- `Labour` attendance model — unchanged. Attendance is still created by supervisors on mobile.
- `subcontractorPayments` ledger in project workspace — unchanged. It's a separate tab now.
- Universal subcontractor page details / payment recording — unchanged.
- The existing `Worker` model — unchanged. New subcontractor-labour rows only create a `Worker` *when* the labour is saved with a `projectId`.