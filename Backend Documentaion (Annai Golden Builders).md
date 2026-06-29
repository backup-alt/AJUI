## **ANNAI GOLDEN BUILDERS Backend — MongoDB Blueprint & Project Roadmap** 

**Annai Golden Builders Dashboard — Backend Specification Version:** 1.0 | **Date:** 2026-06-18 **Stack:** Node.js, Express, MongoDB, Mongoose 

## **PART 1: MongoDB Schema Reference** 

## **Collection:** `users` 

Root user accounts for authentication. 

```
{
_id: ObjectId,
name: String, // e.g. "Anitha"
email: String, // unique, e.g. "anitha@agbuilders.com"
passwordHash: String, // bcrypt hashed
role: String, // "Admin" | "Project Manager" | "Accountant" | "Supervisor"
phone: String, // e.g. "+91 98765 43210"
status: String, // "Active" | "Inactive" | "On Leave"
createdAt: Date,
updatedAt: Date
}
```

1 

**Indexes:** `email` (unique), `role` 

## **Collection:** `clients` 

Client/company owning projects. 

```
{
_id: ObjectId,
clientId: String, // e.g. "CLI-001" (auto-incrementing short ID)
name: String, // e.g. "Meenakshi Raman"
mobile: String, // e.g. "+91 98402 11880"
email: String, // optional
address: String, // e.g. "Plot 42, Velachery Main Road, Chennai"
gstNumber: String, // optional
status: String, // "Active" | "On Hold" | "Completed"
supervisor: String, // assigned supervisor name
projectIds: [String], // array of project IDs
// Financial summary (denormalized for performance, recomputed on changes)
totalProjectValue: Number,
amountReceived: Number,
pendingBalance: Number,
createdAt: Date,
```

2 

```
updatedAt: Date
}
```

**Indexes:** `clientId` (unique), `name` , `status` 

## **Collection:** `projects` 

Individual construction projects belonging to a client. 

```
{
_id: ObjectId,
projectId: String, // e.g. "AB-1024"
name: String, // e.g. "Green Nest Villas"
client: String, // client name (reference by name)
clientId: String, // reference to clients._id
mobile: String, // client contact
address: String, // project site address
supervisor: String, // assigned supervisor name
sites: [String], // e.g. ["Area 1", "Area 2", "Area 3"]
status: String, // "Active" | "On Hold" | "Completed"
startDate: String, // ISO date, e.g. "2026-05-02"
// Financials
```

3 

`totalValue: Number, // total project contract value (` I `) advanceAmount: Number, // advance received (` I `) receivedAmount: Number, // total received to date (` I `) materialSpend: Number, // total material expenditure (` I `) labourPayable: Number, // total labour payable (` I `) expenseBalance: Number, // remaining expense budget (` I `) completion: Number, // percentage 0–100 lastActivityAt: Date, // for sorting by recency createdAt: Date, updatedAt: Date }` 

**Indexes:** `projectId` (unique), `clientId` , `status` , `lastActivityAt` 

## **Collection:** `sites` 

Individual sites/areas within a project. Embedded as array in `projects.sites` or as separate collection for detailed tracking. 

```
{
_id: ObjectId,
siteId: String, // e.g. "AB-1024-Area-1"
projectId: String, // parent project reference
```

4 

```
name: String, // e.g. "Area 1"
status: String, // "Active" | "Completed" | "On Hold"
// Site-level financials (aggregated)
totalSpend: Number,
labourCost: Number,
materialCost: Number,
supervisor: String,
startDate: String,
targetEndDate: String,
createdAt: Date,
updatedAt: Date
}
```

**Indexes:** `projectId` , `siteId` (unique) 

## **Collection:** `materials` 

Material requests, purchases, and inventory tracking per site. 

```
{
_id: ObjectId,
materialId: String, // e.g. "MAT-450"
```

5 

```
projectId: String,
projectName: String,
```

```
clientId: String,
clientName: String,
site: String,
name: String, // e.g. "Bricks", "Cement", "Steel Rod"
unit: String, // e.g. "Nos", "Bag", "Kg", "Load"
requestedQuantity: Number,
approvedQuantity: Number,
purchasedQuantity: Number,
consumedQuantity: Number,
remainingStock: Number, // = purchased - consumed
vendor: String,
vendorId: String,
poNumber: String, // Purchase Order number
requestDate: String, // ISO date
approvalDate: String,
status: String, // "Pending" | "Approved" | "Rejected"
```

6 

```
createdBy: String, // supervisor who requested
approvedBy: String, // admin who approved
createdAt: Date,
updatedAt: Date
}
```

**Indexes:** `materialId` (unique), `projectId` , `site` , `status` , `requestDate` 

## **Collection:** `labour` 

Labour attendance records per day per site. 

```
{
_id: ObjectId,
labourId: String, // e.g. "LAB-118"
projectId: String,
projectName: String,
clientId: String,
site: String,
// Party info
partyName: String, // e.g. "Velu Mason Party"
category: String, // e.g. "Mason", "Plumber", "Helper", "Civil"
// Attendance
```

7 

`attendanceDate: String, // ISO date e.g. "2026-06-05" presentCount: Number, // number of workers present presentDays: Number, // days present in period absentDays: Number, dailyWage: Number, // wage per worker per day (` I `) // Extra overtime: Number, // overtime hours lateFine: Number, // fine for late attendance (` I `) shift: String, // "1" (morning), "2" (evening), "Night" // Payment paymentMode: String, // "Cash" | "NEFT" | "UPI" wagePeriod: String, // e.g. "June 1–15, 2026" // Labour types breakdown (JSON stored as string for simplicity) labourTypes: String, // e.g. "Mason: 5, Helper: 2" notes: String, status: String, // "Pending" | "Approved" | "Rejected" submittedBy: String,` 

8 

```
approvedBy: String,
createdAt: Date,
updatedAt: Date
}
```

**Indexes:** `labourId` (unique), `projectId` , `site` , `attendanceDate` , `status` 

## **Collection:** `expenses` 

Site and general office expenses with cash flow tracking. 

```
{
_id: ObjectId,
expenseId: String, // e.g. "EXP-701"
projectId: String,
projectName: String,
clientId: String,
site: String,
supervisor: String,
date: String, // ISO date
description: String, // e.g. "Petrol, water can, bus ticket"
type: String, // "Site Expense" | "General Expense"
```

9 

`// Cash flow received: Number, // cash given to site (` I `) spent: Number, // amount spent (` I `) // Running balance for site ledger runningBalance: Number, // computed: previous balance + received - spent reference: String, // e.g. "TC-135 / TC-136" status: String, // "Pending" | "Approved" | "Rejected" submittedBy: String, approvedBy: String, createdAt: Date, updatedAt: Date }` 

**Indexes:** `expenseId` (unique), `projectId` , `site` , `date` , `status` , `type` 

**Note on ledger:** For a given project+site, expenses are ordered by date. The `runningBalance` is computed as the cumulative sum of `received - spent` . On insert, look up the last expense for that project+site and add the new amounts. 

## **Collection:** `payments` 

Client payment collections/receipts. 

```
{
```

10 

`_id: ObjectId, paymentId: String, // e.g. "PAY-310" projectId: String, projectName: String, clientId: String, clientName: String, date: String, // ISO date amount: Number, //` I `amount received mode: String, // "Cash" | "Bank Transfer" | "Cheque" | "UPI" | "NEFT" receiptNumber: String, // e.g. "RCT-1882" transactionReference: String, // UTR number, cheque number, etc. collectedBy: String, // accountant name status: String, // "Pending" | "Approved" | "Rejected" approvedBy: String, approvedAt: Date, notes: String,` 

11 

```
createdAt: Date,
updatedAt: Date
}
```

**Indexes:** `paymentId` (unique), `projectId` , `date` , `status` , `mode` 

## **Collection:** `vendors` 

Vendor/supplier master list. 

```
{
_id: ObjectId,
vendorId: String, // e.g. "VEN-001"
name: String, // e.g. "Sri Devi Traders"
materialType: String, // e.g. "Bricks", "Cement", "Steel"
phone: String,
email: String,
address: String,
gstNumber: String,
// Purchase history
materialsBought: Number, // count of purchase orders
totalPurchaseValue: Number,
```

12 

```
rating: Number, // 1–5 stars
status: String, // "Active" | "Inactive"
createdAt: Date,
updatedAt: Date
}
```

**Indexes:** `vendorId` (unique), `name` , `materialType` 

## **Collection:** `supervisors` 

Company supervisor/foreperson records. 

```
{
_id: ObjectId,
supervisorId: String, // e.g. "SUP-001"
name: String, // e.g. "R. Karthik"
phone: String,
email: String,
address: String,
role: String, // "Supervisor" | "Site Engineer"
assignedProject: String, // project name
```

13 

`assignedProjectId: String, assignedSite: String, // specific site assigned // Cash management cashLimit: Number, // max cash they can hold (` I `) activeAdvances: Number, // outstanding advance (` I `) // Approval authority approvalAuthority: Number, // max amount they can approve without HQ (` I `) status: String, // "Active" | "On Leave" | "Inactive" createdAt: Date, updatedAt: Date }` 

**Indexes:** `supervisorId` (unique), `name` , `assignedProjectId` , `status` 

## **Collection:** `subcontractors` 

Subcontractor work packages. 

```
{
_id: ObjectId,
subcontractId: String, // e.g. "SUB-001"
projectId: String,
```

14 

`projectName: String, clientId: String, site: String, subcontractorName: String, workPackage: String, // e.g. "Plumbing", "Electrical", "Painting" contractValue: Number, // total contract value (` I `) advancePaid: Number, // advance given (` I `) balance: Number, // = contractValue - advancePaid startDate: String, dueDate: String, supervisor: String, approvalStatus: String, // "Pending" | "Approved" | "Rejected" paymentStatus: String, // "Not Started" | "Part Paid" | "Paid" createdAt: Date, updatedAt: Date }` 

**Indexes:** `subcontractId` (unique), `projectId` , `approvalStatus` , `paymentStatus` 

15 

## **Collection:** `approvals` 

Central pending approval queue — aggregates approvals from all modules. 

`{ _id: ObjectId, approvalId: String, // e.g. "APR-221" type: String, // "Material" | "Attendance" | "Expense" | "Payment" | "Subcontract" title: String, // e.g. "Cement bags for roof slab" projectId: String, projectName: String, site: String, owner: String, // who submitted amount: Number, //` I `amount involved detail: String, // additional notes/description submittedAt: String, // display string e.g. "Today, 9:10 AM" status: String, // "Pending" | "Approved" | "Rejected" // Source reference — links back to the originating document sourceCollection: String, // e.g. "materials", "labour", "expenses", "payments" sourceId: String, // _id of the originating document` 

16 

```
reviewedBy: String,
reviewedAt: Date,
createdAt: Date,
updatedAt: Date
}
```

**Indexes:** `approvalId` (unique), `projectId` , `status` , `type` , `submittedAt` 

## **Collection:** `reports` 

Report generation register. 

```
{
_id: ObjectId,
reportId: String, // e.g. "RPT-001"
category: String, // "Financial" | "Labour" | "Material" | "Vendor" | "Subcontract"
| "Project"
reportName: String, // e.g. "Payment Collection Report"
scope: String, // e.g. "All projects" | "Specific project"
owner: String, // who owns/generates this report
exportFormat: String, // "Excel" | "PDF" | "CSV"
schedule: String, // "On Demand" | "Daily" | "Weekly" | "Monthly"
```

17 

```
lastGeneratedAt: Date,
createdAt: Date,
updatedAt: Date
}
```

**Indexes:** `reportId` (unique), `category` 

## **PART 2: API Endpoints Reference** 

## **Authentication** 

```
POST /api/auth/login Login with email + password
POST /api/auth/logout Logout (invalidate session)
GET /api/auth/me Get current user
```

## **Clients** 

```
GET /api/clients List all clients (with search, filter, pagination)
POST /api/clients Create new client
GET /api/clients/:id Get client by ID
PUT /api/clients/:id Update client
DELETE /api/clients/:id Delete client
GET /api/clients/:id/summary Get financial summary (total value, received, pending)
```

## **Projects** 

18 

```
GET /api/projects List all projects (filter by status, client, supervisor)
POST /api/projects Create new project
GET /api/projects/:id Get project by ID
PUT /api/projects/:id Update project
DELETE /api/projects/:id Delete project
GET /api/projects/:id/ledger Get project financial ledger
GET /api/projects/summary Dashboard KPI summary (active, on hold, completed counts)
```

## **Sites** 

```
GET /api/projects/:projectId/sites List sites for a project
POST /api/projects/:projectId/sites Add site to project
PUT /api/sites/:id Update site
DELETE /api/sites/:id Delete site
```

## **Materials** 

```
GET /api/materials List materials (filter by project, site, vendor, status)
POST /api/materials Create material request
GET /api/materials/:id Get material by ID
PUT /api/materials/:id Update material
DELETE /api/materials/:id Delete material
GET /api/materials/pending List all pending material approvals
```

## **Labour** 

19 

```
GET /api/labour List labour records (filter by project, site, date range)
POST /api/labour Create labour attendance record
GET /api/labour/:id Get labour record by ID
PUT /api/labour/:id Update labour record
DELETE /api/labour/:id Delete labour record
GET /api/labour/pending List pending labour approvals
GET /api/labour/summary Labour summary for a project
```

## **Expenses** 

```
GET /api/expenses List expenses (filter by project, site, type, date range)
POST /api/expenses Create expense record
GET /api/expenses/:id Get expense by ID
PUT /api/expenses/:id Update expense
DELETE /api/expenses/:id Delete expense
GET /api/expenses/pending List pending expense approvals
```

```
GET /api/expenses/ledger/:projectId/:site Get running balance ledger for site
```

## **Payments** 

```
GET /api/payments List payments (filter by project, mode, date range)
POST /api/payments Create payment record
GET /api/payments/:id Get payment by ID
PUT /api/payments/:id Update payment
```

20 

```
DELETE /api/payments/:id Delete payment
```

```
GET /api/payments/pending List pending payment approvals
GET /api/payments/collection-summary Payment collection report
```

## **Vendors** 

```
GET /api/vendors List vendors (filter by material type)
POST /api/vendors Create vendor
GET /api/vendors/:id Get vendor by ID
PUT /api/vendors/:id Update vendor
DELETE /api/vendors/:id Delete vendor
GET /api/vendors/:id/purchase-history Get vendor purchase history
```

## **Supervisors** 

```
GET /api/supervisors List supervisors
POST /api/supervisors Create supervisor
GET /api/supervisors/:id Get supervisor by ID
PUT /api/supervisors/:id Update supervisor
DELETE /api/supervisors/:id Delete supervisor
```

## **Subcontractors** 

```
GET /api/subcontractors List subcontractor records
POST /api/subcontractors Create subcontractor record
GET /api/subcontractors/:id Get subcontractor by ID
```

21 

```
PUT /api/subcontractors/:id Update subcontractor
DELETE /api/subcontractors/:id Delete subcontractor
GET /api/subcontractors/pending List pending subcontractor approvals
```

## **Approvals (Central)** 

```
GET /api/approvals List all pending approvals (filter by type, project)
GET /api/approvals/:id Get approval by ID
PUT /api/approvals/:id/approve Approve an item
PUT /api/approvals/:id/reject Reject an item
GET /api/approvals/count Get pending approval count
```

## **Reports** 

```
GET /api/reports List available reports
POST /api/reports/generate Generate a report (PDF/Excel export)
GET /api/reports/:id/download Download generated report
```

## **Dashboard** 

```
GET /api/dashboard/kpis Dashboard KPI summary
```

```
GET /api/dashboard/universal Universal dashboard data (all modules combined)
```

## **PART 3: Project Roadmap & Milestones** 

## **Overview** 

- **Total Duration:** 3 weeks 

- **Team:** 1 full-stack developer + 1 database administrator (DBA) 

22 

- **Sprint Duration:** 1 week per sprint 

- **Start Date:** 2026-06-20 

- **Target Handover:** 2026-07-10 

## **SPRINT 1: Foundation (June 20 – June 27, 2026)** 

**Goal:** Core infrastructure, auth, and base schemas 

|**#**|**Task**|**Owner**|**Deadline**|
|---|---|---|---|
|1.1|Project setup:<br>Node.js + Express +<br>TypeScript +<br>MongoDB +<br>Mongoose|Dev|Jun 21|
|1.2|Environment config:<br>dev/staging`.env`,<br>Docker setup|Dev|Jun 21|
|1.3|MongoDB Atlas<br>cluster setup,<br>connection pooling|DBA|Jun 22|
|1.4|Auth system: JWT<br>login/logout,<br>password hashing<br>with bcrypt,<br>middleware|Dev|Jun 23|
|1.5|User CRUD<br>endpoints +<br>role-based access<br>control (Admin,<br>Accountant, PM,<br>Supervisor)|Dev|Jun 24|
|1.6|Client schema +<br>CRUD API endpoints|Dev|Jun 25|
|1.7|Project schema +<br>CRUD API endpoints|Dev|Jun 26|
|1.8|Sites schema +<br>nested in project +<br>site-specific<br>endpoints|Dev|Jun 27|



23 

**Exit Criteria:** Auth works, users can log in, clients and projects can be created/listed via API 

## **SPRINT 2: Core Modules (June 28 – July 5, 2026)** 

**Goal:** Complete material, labour, expense, payment modules with approval flows 

|**#**|**Task**|**Owner**|**Deadline**|
|---|---|---|---|
|2.1|Material schema +<br>CRUD + approval<br>flow|Dev|Jun 29|
|2.2|Labour schema +<br>attendance records +<br>approval flow|Dev|Jun 30|
|2.3|Labour types<br>breakdown (Mason,<br>Helper per party) +<br>wage calculation|Dev|Jul 1|
|2.4|Expense schema +<br>type separation (Site<br>Expense / General<br>Expense) + running<br>balance ledger|Dev|Jul 2|
|2.5|Payment schema +<br>receipt generation|Dev|Jul 3|
|2.6|Vendor schema +<br>CRUD + purchase<br>history tracking|Dev|Jul 4|
|2.7|Supervisor schema +<br>assignment to<br>projects + cash limit<br>tracking|Dev|Jul 4|
|2.8|Subcontractor<br>schema + work<br>package tracking|Dev|Jul 5|



**Exit Criteria:** All project-level CRUD + approval APIs functional, ledger balance computed correctly 

**SPRINT 3: Integration + Testing + Handover (July 6 – July 10, 2026)** 

24 

**Goal:** Approval routing, dashboard, reporting, final testing, production deployment 

|**#**|**Task**|**Owner**|**Deadline**|
|---|---|---|---|
|3.1|Central approvals<br>collection +<br>push-based approval<br>from each module|Dev|Jul 6|
|3.2|Approval<br>approve/reject<br>endpoints +<br>notification on status<br>change|Dev|Jul 6|
|3.3|Financial computed<br>fields: project<br>received, pending<br>balance, material<br>spend, labour<br>payable|Dev|Jul 7|
|3.4|Auto-update project<br>totals on material/lab<br>our/expense/payment<br>insert/update/delete|Dev|Jul 7|
|3.5|Dashboard KPI<br>aggregation<br>endpoints|Dev|Jul 8|
|3.6|Universal dashboard<br>endpoint (all modules<br>filtered by project,<br>site, date range)|Dev|Jul 8|
|3.7|Final integration<br>testing + bug fixes|Dev|Jul 9|
|3.8|Production<br>deployment +<br>handover<br>documentation|Dev/DBA|Jul 10|



**Exit Criteria:** All APIs functional, dashboard working, system handed over for UAT/production 

## **PART 4: Testing Strategy** 

25 

## **Unit Tests (Jest)** 

- Auth: login, logout, JWT validation, role checking 

- Models: schema validation, required fields 

- Services: financial calculation functions (project totals, balance) 

- Utility: ID generation, date formatting 

## **Integration Tests (Supertest)** 

- All CRUD endpoints tested with actual MongoDB (test database) 

- Approval flow end-to-end: create material → generates approval → approve → material status updates 

- Ledger balance: insert expense → verify runningBalance recomputes 

## **Load Tests (k6)** 

- 100 concurrent users on `/api/dashboard/kpis` 

- 50 concurrent users on `/api/projects` 

- Verify p95 response time < 500ms under load 

## **PART 5: Tech Stack Summary** 

|**Layer**|**Technology**|
|---|---|
|Runtime|Node.js 20 LTS|
|Framework|Express.js + TypeScript|
|Database|MongoDB 7 (Atlas M0 free tier for dev, M10+<br>for prod)|
|ODM|Mongoose 8|
|Auth|JWT (jsonwebtoken) + bcrypt|
|Validation|express-validator|
|File Export|exceljs (Excel), pdfkit (PDF)|
|Testing|Jest + Supertest|
|Load Testing|k6|
|CI/CD|GitHub Actions|



26 

|**Layer**|**Technology**|
|---|---|
|Container|Docker + docker-compose|
|Hosting|Railway / Render / AWS (staging + prod)|



## **PART 6: Important Design Notes** 

## **Auto-Generated IDs** 

All IDs follow the format `{PREFIX}-{NUMBER}` : 

- `CLI-001` , `AB-1024` , `MAT-450` , `LAB-118` , `EXP-701` , `PAY-310` 

- Implement a counter collection in MongoDB for atomic auto-increment 

## **Running Balance (Expense Ledger)** 

When inserting an expense for a project+site: 

`1. Find the last expense for (projectId, site) sorted by date` 

`2. newRunningBalance = lastExpense.runningBalance + received - spent` 

`3. Insert with computed runningBalance` 

Run this as a MongoDB transaction to avoid race conditions. 

## **Approval Flow** 

When any module (material, labour, expense, payment) creates a record: 

1. Insert the record with `status: "Pending"` 

2. Create an entry in `approvals` collection with `sourceCollection` and `sourceId` 

3. On approve/reject → update both the source record status AND the approval status 

4. Use MongoDB transactions to ensure atomicity 

## **Project Totals Recomputation** 

On any financial change, recompute the project's: 

- `receivedAmount` = SUM of payments where status = "Approved" 

- `pendingBalance` = `totalValue` - `receivedAmount` 

- `materialSpend` = SUM of approved material records 

- `labourPayable` = SUM of approved labour wages 

Use Mongoose middleware ( `post.save` ) on relevant collections to trigger recomputation. 

27 

## **Security Checklist** 

I Passwords hashed with bcrypt (min 10 rounds) 

- I JWT stored in httpOnly cookie (not localStorage) 

- I All endpoints require auth except `/auth/login` 

- I Role-based middleware on sensitive endpoints 

- I Input validation on all POST/PUT routes 

- I MongoDB injection prevented via Mongoose parameterized queries 

- I Rate limiting: 100 requests/minute per IP 

I CORS restricted to frontend domain only 

*Document prepared for Annai Golden Builders — AJUI Backend Development Project* 

*Prepared by: Development Team | Date: 2026-06-18* 

28 

