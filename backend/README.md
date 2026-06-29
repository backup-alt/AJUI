# AJUI Backend (Annai Golden Builders)

Node.js + Express + MongoDB backend for the Annai Golden Builders operations platform. Powers both the **web app** (Admin, Accountant, PM) and the **mobile app** (Supervisors only).

## Stack

- **Runtime**: Node.js 20 LTS + TypeScript
- **Framework**: Express 4
- **Database**: MongoDB (Mongoose 8)
- **Auth**: JWT (access + refresh) in httpOnly cookies
- **Email**: SendGrid API
- **Push Notifications**: Firebase Cloud Messaging (FCM)
- **Validation**: Zod
- **QR Codes**: `qrcode`

## Project Structure

```
backend/
├── src/
│   ├── config/          # env, db, sendgrid, firebase
│   ├── models/          # Mongoose models
│   ├── schemas/         # Zod validation schemas
│   ├── middleware/      # auth, validation, error handler
│   ├── routes/          # Express routers
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── utils/           # jwt, password, qr-code
│   └── app.ts           # Entry point
├── .env.example
├── package.json
└── tsconfig.json
```

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

Required values:
- `MONGODB_URI` — MongoDB connection string
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — Random strong strings (min 16 chars)
- `SENDGRID_API_KEY` — For password reset emails
- `FIREBASE_*` — For push notifications

### 3. Run

```bash
# Development (auto-reload)
npm run dev

# Production
npm run build
npm start
```

Server runs on `http://localhost:4000` by default.

## API Endpoints (Phase 1 + 2 + 3)

### Phase 6 - RBAC (Role-Based Access Control)

**Default role permissions** (auto-seeded on first start, admin can override):

| Role | Scope | Field Permissions |
|------|-------|-------------------|
| **admin** | all | All operations allowed |
| **accountant** | all | Expenses, payments, reports (write); other modules read |
| **project_manager** | own | Projects, sites, supervisors, materials, labour, subcontractors (write); financials read |
| **supervisor** | assigned | Materials, labour, expenses (write); own profile only |

**Endpoints:**
- `GET /api/me/permissions` — any authenticated user
- `GET /api/permissions` — admin only (all permissions)
- `GET /api/permissions/defaults` — admin only (default configs for 4 roles)
- `GET /api/permissions/:role` — admin only (permissions for one role)
- `PATCH /api/permissions/:role/:module` — admin only (update scope + field permissions)
- `POST /api/permissions/:role/reset` — admin only (reset to defaults)

**Role-based endpoint guards:**
- `/api/admin/*` — admin only
- POST `/api/clients`, `/api/projects`, `/api/sites` — admin + PM
- DELETE `/api/clients`, `/api/projects`, `/api/sites`, `/api/supervisors` — admin only
- POST `/api/materials`, `/api/labour` — admin + PM + supervisor
- POST `/api/expenses` — admin + accountant + supervisor
- POST `/api/payments` — admin + accountant
- POST `/api/vendors`, `/api/subcontractors` — admin + PM
- PUT `/api/approvals/:id/approve|reject` — admin + PM + accountant
- `/api/dashboard/*` — admin + PM + accountant
- `/api/supervisor/*` — supervisor only (returns 403 for others)

**Scope-aware queries:**
- Admin: sees all data
- Accountant: sees all financial data
- PM: sees only projects they manage
- Supervisor: sees only assigned projects

### Phase 5 - Supervisor Mobile API (requires Bearer token + role=supervisor)

All endpoints under `/api/supervisor/*` enforce `role === "supervisor"` via middleware.

- `GET /api/supervisor/profile` — own user + supervisor profile
- `PATCH /api/supervisor/profile` — update name/email/phone/address
- `GET /api/supervisor/dashboard` — counts (projects, sites, pending approvals/materials/labour/expenses), today's expenses, recent projects + approvals
- `GET /api/supervisor/projects` — assigned projects (active/on hold)
- `GET /api/supervisor/projects/detailed` — assigned projects with aggregated stats
- `GET /api/supervisor/projects/:projectId` — project detail (only if assigned)
- `GET /api/supervisor/projects/:projectId/approvals` — pending approvals for project
- `GET /api/supervisor/sites` — assigned sites
- `GET /api/supervisor/approvals` — all pending approvals user can view
- `POST /api/supervisor/device/register` — register FCM token for push notifications
- `POST /api/supervisor/device/unregister` — remove FCM token
- `GET /api/supervisor/devices` — list registered devices

**Push notification triggers** (auto-sent on approval/rejection):
- Material approval/rejection → notify project supervisors
- Labour approval/rejection → notify project supervisors
- Expense approval/rejection → notify project supervisors
- Payment approval/rejection → notify project supervisors
- Subcontractor approval/rejection → notify project supervisors

### Phase 4 - Dashboard & Reports (requires Bearer token)

#### Dashboard
- `GET /api/dashboard/kpis` — aggregated counts + financials across all modules
- `GET /api/dashboard/universal` — combined view of all modules, filterable by `?projectId=&clientId=&siteId=&from=&to=`

#### Reports (13 default reports auto-seeded on first start)
- `GET /api/reports` — list with `?category=Financial|Labour|Material|Vendor|Subcontract|Project`
- `POST /api/reports` — create custom report
- `GET /api/reports/:id` — get
- `PATCH /api/reports/:id` — update
- `DELETE /api/reports/:id` — delete
- `POST /api/reports/:id/generate` — generate (returns metadata; export logic stubbed for future)

### Phase 3 - Financial Modules (requires Bearer token)

#### Materials
- `GET /api/materials` — list with filters (`projectId`, `siteId`, `vendorId`, `status`, `search`, `page`, `limit`)
- `POST /api/materials` — create (auto-creates Pending approval)
- `GET /api/materials/pending` — pending approvals queue
- `GET /api/materials/:id` — get
- `PATCH /api/materials/:id` — update
- `DELETE /api/materials/:id` — delete

#### Labour
- `GET /api/labour` — list with filters
- `POST /api/labour` — create (auto-creates Pending approval, supports dynamic `laborTypes[]`)
- `GET /api/labour/pending` — pending approvals
- `GET /api/labour/summary/:projectId` — aggregated by category
- `GET /api/labour/:id` — get
- `PATCH /api/labour/:id` — update
- `DELETE /api/labour/:id` — delete

#### Expenses
- `GET /api/expenses` — list with filters (`type=site|general`, `projectId`, `status`)
- `POST /api/expenses` — create (auto-creates Pending approval, computes running balance for site expenses)
- `GET /api/expenses/pending` — pending approvals
- `GET /api/expenses/ledger/:projectId/:site` — running balance ledger for site
- `GET /api/expenses/:id` — get
- `PATCH /api/expenses/:id` — update
- `DELETE /api/expenses/:id` — delete

#### Payments
- `GET /api/payments` — list with filters
- `POST /api/payments` — create (auto-creates Pending approval)
- `GET /api/payments/pending` — pending approvals
- `GET /api/payments/collection-summary` — aggregated by mode/month
- `GET /api/payments/:id` — get
- `PATCH /api/payments/:id` — update
- `DELETE /api/payments/:id` — delete

#### Vendors
- `GET /api/vendors` — list
- `POST /api/vendors` — create
- `GET /api/vendors/:id/purchase-history` — purchase history
- `GET /api/vendors/:id` — get
- `PATCH /api/vendors/:id` — update
- `DELETE /api/vendors/:id` — delete

#### Subcontractors
- `GET /api/subcontractors` — list
- `POST /api/subcontractors` — create (auto-creates Pending approval)
- `GET /api/subcontractors/pending` — pending approvals
- `GET /api/subcontractors/:id` — get
- `PATCH /api/subcontractors/:id` — update
- `DELETE /api/subcontractors/:id` — delete

#### Approvals (Central)
- `GET /api/approvals` — list (default status=Pending) with filters (`type`, `projectId`)
- `GET /api/approvals/count` — pending count by type
- `GET /api/approvals/:id` — get
- `PUT /api/approvals/:id/approve` — approve (auto-updates source record + recomputes project totals)
- `PUT /api/approvals/:id/reject` — reject (auto-updates source record)



### Health
- `GET /health`

### Auth
- `POST /api/auth/login` — `{ phone, password }` → `{ user, accessToken }` (refresh in httpOnly cookie)
- `POST /api/auth/refresh` — rotates access token using refresh cookie
- `POST /api/auth/logout` — revokes refresh token
- `GET /api/auth/me` — current user (Bearer token)
- `POST /api/auth/forgot-password` — `{ email }` → SendGrid reset link
- `POST /api/auth/reset-password` — `{ token, password }`
- `GET /api/auth/supervisor/verify/:token` — validate QR invite
- `POST /api/auth/supervisor/signup` — `{ token, name, phone, email, password }` (QR flow)

### Admin (requires Bearer token)
- `POST /api/admin/invites/supervisor` — `{ projectId?, expiryHours? }` → `{ inviteId, qrUrl, qrDataUrl, expiresAt }`

### Clients (requires Bearer token)
- `GET /api/clients` — list with `?search=&status=&page=&limit=`
- `POST /api/clients` — create
- `GET /api/clients/:id` — get by ID
- `PATCH /api/clients/:id` — update
- `DELETE /api/clients/:id` — delete (only if no projects)
- `GET /api/clients/:id/summary` — financial summary with projects

### Sites (requires Bearer token)
- `GET /api/sites` — list with `?status=&search=`
- `POST /api/sites` — create (can link `projectIds[]`)
- `GET /api/sites/:id` — get by ID
- `PATCH /api/sites/:id` — update
- `DELETE /api/sites/:id` — delete

### Projects (requires Bearer token)
- `GET /api/projects` — list with `?search=&status=&clientId=&siteId=&supervisorId=&page=&limit=`
- `POST /api/projects` — create (links `clientId`, `siteIds[]`)
- `GET /api/projects/:id` — get by ID
- `PATCH /api/projects/:id` — update
- `DELETE /api/projects/:id` — delete
- `GET /api/projects/:id/ledger` — financial ledger (computed)
- `GET /api/projects/summary` — KPI counts + aggregated financials

### Supervisors (requires Bearer token)
- `GET /api/supervisors` — list
- `POST /api/supervisors` — create
- `GET /api/supervisors/:id` — get
- `PATCH /api/supervisors/:id` — update
- `DELETE /api/supervisors/:id` — delete

### Custom Fields (EAV) (requires Bearer token)
- `GET /api/custom-fields?entityType=&entityId=` — list fields for entity, sorted by order
- `POST /api/custom-fields` — create (upserts if key exists)
- `PATCH /api/custom-fields/:id` — update value/label/order
- `DELETE /api/custom-fields/:id` — delete

## Authentication Flow

### Web App (Admin/PM/Accountant)
1. Admin POST `/api/auth/login` with phone + password
2. Server returns access token in JSON, refresh token in httpOnly cookie
3. Web app sends `Authorization: Bearer <accessToken>` on subsequent requests
4. On 401, web app calls `/api/auth/refresh` (cookie auto-sent)

### Mobile App (Supervisor)
1. Admin generates QR via web `/api/admin/invites/supervisor`
2. Supervisor scans QR → opens `ajui://supervisor/signup?token=xxx` in mobile app
3. Mobile app POSTs `/api/auth/supervisor/signup` with token + details
4. Server creates User, returns access token + sets refresh cookie
5. Mobile app stores tokens in secure storage; sends `Authorization: Bearer <accessToken>`

### Password Reset
1. User POSTs `/api/auth/forgot-password` with email
2. Server sends SendGrid email with reset link
3. User clicks link → opens web app `/reset-password?token=xxx`
4. User enters new password → POSTs `/api/auth/reset-password`

## Development Phases

- [x] **Phase 1**: Foundation, auth, QR invite flow, Firebase init
- [x] **Phase 2**: Core entities (Clients, Sites, Projects, Supervisors) + Custom Fields (EAV) + ID generator
- [x] **Phase 3**: Materials, Labour, Expenses, Payments, Vendors, Subcontractors + Central Approval system + Project totals recomputation
- [x] **Phase 4**: Dashboard (KPIs + universal) + Reports (13 default seeded + CRUD + generate)
- [x] **Phase 5**: Supervisor mobile API (profile, dashboard, assigned projects/sites, actionable approvals) + FCM device tokens + push notifications triggered on approval events
- [x] **Phase 6**: RBAC system (per-role per-module per-field permissions + admin-configurable + auto-seeded defaults + scope-aware queries)
- [x] **Phase 7**: Render deployment (render.yaml) + HTTPS redirect middleware + trust proxy + production-mode verification
- [x] **Phase 8**: Rich test data seed (8 clients, 7 projects, 28 materials, 17 labour, 30 expenses, 20 payments, 10 subcontractors, 6 vendors, 4 supervisors, 8 sites) + Swagger UI at `/api/docs` + Jest+Supertest integration tests (16/16 passing) + Angular frontend integration (ApiService, auth interceptor, login page, dashboard, clients page using real backend)

## Security

- Passwords: bcrypt (12 rounds)
- JWT: separate access (15m) + refresh (7d) secrets
- Refresh tokens: hashed in DB, rotated on use, revocable
- Rate limiting: auth endpoints
- CORS: restricted to frontend origin
- Helmet: security headers (CSP, HSTS, X-Frame-Options, etc.)
- **Cross-Origin-Resource-Policy**: `cross-origin` in development (allows frontend on different port), `same-origin` in production (more secure when served from same domain) (or `*` in dev for mobile)
- Helmet: standard security headers
- Validation: Zod on all POST/PUT routes

## License

Proprietary — Annai Golden Builders
