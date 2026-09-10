# AGB Operations Workspace - Security & Production Readiness Audit
**Date:** 2026-09-09  
**Auditor:** Kiro AI  
**Scope:** Full-stack audit (Backend API, Web Frontend, Mobile App)

---

## Executive Summary

This audit identified **15 critical and high-severity issues** that must be addressed before production deployment. The application has a solid foundation with JWT authentication, Zod validation, and RBAC, but several security vulnerabilities, logical errors, and production-readiness gaps exist.

**Status:** ⚠️ **NOT PRODUCTION READY** - Critical issues must be resolved first.

---

## Critical Issues (Must Fix Before Production)

### 🔴 CRITICAL-1: Exposed Secrets in Version Control
**File:** `backend/.env`  
**Severity:** CRITICAL  
**Risk:** Complete system compromise

**Finding:**
The `.env` file containing production secrets is committed to the repository:
- MongoDB credentials exposed: `[REDACTED]`
- JWT secrets exposed: `[REDACTED]`
- pCloud token exposed: `[REDACTED]`
- Gmail app password exposed: `[REDACTED]`
- Resend API key exposed: `[REDACTED]`
- Firebase private key exposed (full RSA private key in plaintext)

**Impact:**
- Attackers can access the entire database
- Attackers can forge authentication tokens
- Email service can be hijacked
- Cloud storage can be compromised

**Remediation:**
1. **IMMEDIATELY** rotate ALL secrets:
   - Generate new MongoDB credentials
   - Generate new JWT secrets (min 32 chars, cryptographically random)
   - Revoke and regenerate all API keys
   - Generate new Firebase service account
2. Remove `.env` from git history: `git filter-branch` or BFG Repo-Cleaner
3. Add `.env` to `.gitignore` (already done, but file was committed before)
4. Use environment variables in production (Render.com dashboard)
5. Scan GitHub for leaked secrets using `git-secrets` or `truffleHog`

---

### 🔴 CRITICAL-2: Password Reset Token Timing Attack Vulnerability
**File:** `backend/src/controllers/auth.controller.ts:343-372`  
**Severity:** CRITICAL  
**Risk:** Password reset token enumeration

**Finding:**
The password reset endpoint iterates through ALL unused tokens in the database and compares each one using `compareToken()`:

```typescript
const tokens = await PasswordResetToken.find({ usedAt: { $exists: false } });
let matched: (typeof tokens)[number] | undefined;
for (const t of tokens) {
  const ok = await compareToken(token, t.tokenHash);
  if (ok && t.expiresAt > new Date()) {
    matched = t;
    break;
  }
}
```

**Impact:**
- Timing attacks can reveal valid tokens (bcrypt comparison time varies)
- As the number of pending reset tokens grows, the endpoint becomes slower
- An attacker can enumerate valid tokens by measuring response time

**Remediation:**
Store `userId` or a token identifier in the URL so you can fetch the exact token record:
```typescript
// Store tokenId alongside tokenHash
const tokenId = crypto.randomBytes(8).toString("hex");
await PasswordResetToken.create({
  tokenId,
  userId: user._id,
  tokenHash: await hashToken(rawToken),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
});

// Send tokenId:rawToken (e.g., "abc123def:hex_token")
const resetToken = `${tokenId}:${rawToken}`;

// On reset, lookup by tokenId first
const [tokenId, rawToken] = req.body.token.split(":");
const stored = await PasswordResetToken.findOne({ tokenId, usedAt: { $exists: false } });
if (!stored || stored.expiresAt < new Date()) throw new AppError(400, "Invalid or expired token");
const valid = await compareToken(rawToken, stored.tokenHash);
if (!valid) throw new AppError(400, "Invalid or expired token");
```

---

### 🔴 CRITICAL-3: Race Condition in Approval Processing
**File:** `backend/src/services/approval.service.ts:54-258`  
**Severity:** CRITICAL  
**Risk:** Double-approval / double-spending

**Finding:**
The approval flow reads the status, checks it, then updates both the Approval and source document in separate operations without atomic transaction:

```typescript
const approval = await Approval.findOne({ approvalId });
if (approval.status !== "Pending") {
  throw new AppError(409, `Approval already ${approval.status.toLowerCase()}`);
}
// ... multiple async operations here ...
approval.status = "Approved";
await approval.save();
```

**Impact:**
- Two admins approving the same expense simultaneously can both succeed
- Funds can be double-allocated
- Inventory can be double-added

**Remediation:**
Use atomic `findOneAndUpdate` with status check in query:
```typescript
const approval = await Approval.findOneAndUpdate(
  { approvalId, status: "Pending" },
  { 
    status: "Approved", 
    reviewedBy: reviewer, 
    reviewedAt: new Date() 
  },
  { new: true }
);
if (!approval) {
  throw new AppError(409, "Approval not found or already processed");
}
// Continue with source document updates
```

Or use MongoDB transactions for multi-document updates.

---

### 🔴 CRITICAL-4: Missing Authorization Check in Material Approval
**File:** `backend/src/services/approval.service.ts:92-106`  
**Severity:** CRITICAL  
**Risk:** Unauthorized inventory manipulation

**Finding:**
When approving a material, the code blindly adds inventory without checking if the approver has access to that project:

```typescript
await Material.updateOne({ _id: approval.sourceId }, sourceUpdate);
await addApprovedMaterialToInventory(
  approval.sourceId,
  options.approvedQuantity ?? mat?.approvedQuantity ?? mat?.requestedQuantity ?? 0,
  reviewer
);
```

The `approveRequest` function is called from a controller that should enforce RBAC, but there's no project scope validation in the service layer itself.

**Impact:**
- A project manager could approve materials for projects they don't manage if they can craft the request
- Inventory integrity can be violated

**Remediation:**
Add project scope validation in the approval service:
```typescript
export async function approveRequest(
  approvalId: string,
  reviewer: string,
  reviewerRole: string,
  reviewerProjectIds: string[] | null, // null = admin
  options: { ... }
): Promise<IApproval> {
  const approval = await Approval.findOne({ approvalId });
  if (!approval) throw new AppError(404, "Approval not found");
  
  // Authorization check
  if (reviewerRole !== "admin" && reviewerProjectIds !== null) {
    if (!approval.projectId || !reviewerProjectIds.includes(approval.projectId.toString())) {
      throw new AppError(403, "You don't have permission to approve this item");
    }
  }
  
  // ... continue with approval logic
}
```

---

### 🔴 CRITICAL-5: Weak JWT Secrets in Development
**File:** `backend/.env:8-9`  
**Severity:** HIGH (CRITICAL if deployed as-is)  
**Risk:** Token forgery

**Finding:**
JWT secrets are weak and contain warnings that were ignored:
```
JWT_ACCESS_SECRET=ajui_access_secret_dev_only_change_in_production_3kj4h5kj34h5
JWT_REFRESH_SECRET=ajui_refresh_secret_dev_only_change_in_production_5kj3h4kj5h34
```

These are predictable and only ~60 characters. The "dev_only_change_in_production" warning suggests they may have been used in production.

**Impact:**
- Attackers can forge admin tokens
- Complete authentication bypass

**Remediation:**
Generate cryptographically secure secrets (minimum 32 bytes):
```bash
openssl rand -base64 32
# Example: j8fK3mN9pQ2rS5tU8vW1xY4zA6bC9dE2fH5gI8jK1lM=
```

Update production secrets via Render.com dashboard.

---

## High Severity Issues

### 🟠 HIGH-1: No Rate Limiting on Approval Endpoints
**File:** `backend/src/routes/financial.routes.ts` (inferred - approval routes)  
**Severity:** HIGH  
**Risk:** Approval spam / DoS

**Finding:**
Rate limiting exists on auth endpoints (`authLimiter`, `strictLimiter`), but approval endpoints have no rate limiting. An attacker could spam approval requests or attempt to exploit race conditions.

**Remediation:**
Add rate limiting to approval routes:
```typescript
const approvalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Too many approval requests, please try again later" },
});

router.post("/approvals/:id/approve", requireAuth, approvalLimiter, approveRequest);
router.post("/approvals/:id/reject", requireAuth, approvalLimiter, rejectRequest);
```

---

### 🟠 HIGH-2: Missing Input Validation on Amount Fields
**File:** Multiple controllers, especially `approval.service.ts:83-84`  
**Severity:** HIGH  
**Risk:** Financial logic bypass

**Finding:**
Amount fields (`issuedAmount`, `givenAmount`, `approvedAmount`) are accepted without validation:

```typescript
if (options.issuedAmount !== undefined) sourceUpdate.issuedAmount = options.issuedAmount;
if (options.givenAmount !== undefined) sourceUpdate.givenAmount = options.givenAmount;
```

No checks for:
- Negative amounts
- NaN or Infinity
- Amounts exceeding reasonable limits

**Impact:**
- Negative amounts could corrupt financial totals
- Excessively large amounts could cause overflow issues
- Invalid numbers could crash aggregation pipelines

**Remediation:**
Add Zod validation for all amount fields:
```typescript
const approveRequestSchema = z.object({
  issuedAmount: z.number().nonnegative().max(1_00_00_00_000).optional(), // 1 crore max
  givenAmount: z.number().nonnegative().max(1_00_00_00_000).optional(),
  approvedAmount: z.number().nonnegative().max(1_00_00_00_000).optional(),
  approvedQuantity: z.number().nonnegative().max(1_000_000).optional(),
});
```

---

### 🟠 HIGH-3: Access Schedule Bypass via Token Replay
**File:** `backend/src/middleware/auth.ts:88-141`  
**Severity:** HIGH  
**Risk:** Access control bypass

**Finding:**
Access schedule enforcement happens in the `requireAuth` middleware, but tokens are long-lived (15 minutes for access, 7 days for refresh). A supervisor who logs in during permitted hours can continue using their token after hours end.

**Impact:**
- Supervisors can work outside permitted hours by keeping the app open
- Access schedule becomes ineffective

**Remediation:**
Reduce access token lifetime to 5 minutes during restricted hours, or add real-time schedule checks:
```typescript
// In requireAuth after verifying token
if (req.user.role !== "admin") {
  const schedule = await getCachedSchedule();
  if (schedule && schedule.enabled) {
    const isRestricted = await checkIfCurrentTimeRestricted(req.user.role, schedule);
    if (isRestricted) {
      res.status(403).json({ 
        error: "Access timing is over. Contact admin if you need access.", 
        code: "ACCESS_SCHEDULE_RESTRICTED" 
      });
      return;
    }
  }
}
```

Alternatively, issue tokens with shorter expiry during restricted periods.

---

### 🟠 HIGH-4: No Transaction Rollback on Approval Failure
**File:** `backend/src/services/approval.service.ts:54-258`  
**Severity:** HIGH  
**Risk:** Data inconsistency

**Finding:**
Approval processing updates multiple documents (Approval, Material/Expense/Labour, Inventory, Project totals, Site ledger) without transactions. If any step fails midway, earlier changes persist.

**Example failure scenario:**
1. Material status updated to "Not Received" ✅
2. `addApprovedMaterialToInventory` succeeds ✅
3. `recomputeProjectTotals` throws an error ❌
4. Result: Material is approved, inventory is added, but Approval document still shows "Pending"

**Impact:**
- Inventory and financial totals can drift out of sync
- Users see pending approvals that were actually processed
- Duplicate processing on retry

**Remediation:**
Use MongoDB transactions for multi-document updates:
```typescript
const session = await mongoose.startSession();
session.startTransaction();
try {
  await Material.updateOne({ _id: approval.sourceId }, sourceUpdate, { session });
  await addApprovedMaterialToInventory(approval.sourceId, quantity, reviewer, { session });
  approval.status = "Approved";
  await approval.save({ session });
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

### 🟠 HIGH-5: Project Manager Can See All Projects Despite Scope
**File:** `backend/src/middleware/rbac.ts:116-120`  
**Severity:** HIGH  
**Risk:** Information disclosure

**Finding:**
Project managers and accountants are given global project access:

```typescript
if (role === "admin" || role === "project_manager" || role === "accountant") {
  req._cachedScopedProjectIds = null;
  return null; // null = no scope restriction
}
```

This contradicts the User model which has `managedProjectIds` for project managers. A project manager assigned to Project A can see data from all projects.

**Impact:**
- Project managers can view financial data for projects they don't manage
- Privacy violation if different PMs are supposed to be isolated

**Remediation:**
If project managers should be scoped, fix the logic:
```typescript
if (role === "admin" || role === "accountant") {
  req._cachedScopedProjectIds = null;
  return null;
}

if (role === "project_manager") {
  // Apply managedProjectIds scope
  const managedProjectIds = (user.managedProjectIds || []).map(id => new Types.ObjectId(String(id)));
  req._cachedScopedProjectIds = managedProjectIds;
  return managedProjectIds;
}
```

If the current behavior is intentional (all PMs see all projects), document this clearly and remove `managedProjectIds` from the PM role.

---

## Medium Severity Issues

### 🟡 MEDIUM-1: No XSS Protection on Dynamic Content
**File:** Frontend - no explicit sanitization found  
**Severity:** MEDIUM  
**Risk:** Cross-site scripting

**Finding:**
Angular's default sanitization protects against most XSS, but user-generated content (material names, descriptions, notes) is rendered without explicit sanitization. If any component uses `[innerHTML]` or bypassSecurityTrust, XSS is possible.

**Remediation:**
1. Audit all components for `[innerHTML]` and `bypassSecurityTrust*` usage
2. Sanitize user input on backend before storing
3. Add CSP headers in production

---

### 🟡 MEDIUM-2: Invite Tokens Never Expire (After Consumption)
**File:** `backend/src/services/invite.service.ts` (inferred)  
**Severity:** MEDIUM  
**Risk:** Audit trail pollution

**Finding:**
Invite tokens remain in the database forever after being used. The `usedAt` field marks them consumed, but they're never cleaned up.

**Impact:**
- Database bloat over time
- Harder to audit active invites
- Potential for confusion if tokens are manually inspected

**Remediation:**
Add a cleanup job that deletes consumed invites older than 90 days:
```typescript
async function cleanupOldInvites() {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  await InviteToken.deleteMany({ usedAt: { $lt: cutoff } });
}
```

---

### 🟡 MEDIUM-3: No Logging for Financial Operations
**File:** Multiple service files  
**Severity:** MEDIUM  
**Risk:** Audit trail gap

**Finding:**
Critical financial operations (approve expense, create payment, edit invoice) have no dedicated audit logging beyond the `ActivityLog` for sign-in/sign-out.

**Impact:**
- Cannot trace who approved what and when if the Approval document is corrupted
- Hard to investigate fraud or errors

**Remediation:**
Add structured logging for all financial mutations:
```typescript
import winston from "winston";

const auditLogger = winston.createLogger({
  transports: [new winston.transports.File({ filename: "audit.log" })],
});

// In approval service
auditLogger.info("Approval processed", {
  approvalId: approval.approvalId,
  action: "approved",
  reviewer,
  projectId: approval.projectId,
  amount: approval.amount,
  sourceCollection: approval.sourceCollection,
  timestamp: new Date().toISOString(),
});
```

---

### 🟡 MEDIUM-4: CORS Configuration Too Permissive
**File:** `backend/src/app.ts` (inferred - CORS middleware)  
**Severity:** MEDIUM  
**Risk:** CSRF potential

**Finding:**
Based on environment config, `MOBILE_APP_URL=*` and the cookie settings use `sameSite: "none"`, suggesting CORS may be wide open.

**Impact:**
- Any origin can make authenticated requests to the API
- Increased CSRF risk (mitigated by JWT but still a concern for cookie-based flows)

**Remediation:**
Restrict CORS to known origins:
```typescript
const allowedOrigins = [
  env.FRONTEND_URL,
  "https://backup-alt.github.io",
  "capacitor://localhost", // Capacitor apps
  "ionic://localhost",
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));
```

---

### 🟡 MEDIUM-5: No Pagination Limit Cap
**File:** `backend/src/utils/cursor-pagination.ts` (inferred)  
**Severity:** MEDIUM  
**Risk:** Memory exhaustion DoS

**Finding:**
Pagination endpoints accept user-supplied `limit` parameter. If not capped, an attacker can request `?limit=1000000` and exhaust memory.

**Remediation:**
Cap limit to a reasonable maximum:
```typescript
const effectiveLimit = Math.min(Math.max(1, filter.limit), 100); // cap at 100
```

---

## Low Severity / Informational Issues

### ℹ️ LOW-1: Hardcoded 5-Minute Invite Expiry
**File:** `backend/src/controllers/auth.controller.ts:558`  
**Finding:** `expiryMinutes: 5` is hardcoded. Consider making it configurable.

### ℹ️ LOW-2: Access Token Expiry Too Long
**File:** `backend/.env:10`  
**Finding:** `JWT_ACCESS_EXPIRY=15m` is long for high-security operations. Consider 5m for production.

### ℹ️ LOW-3: No Health Check for Email Service
**File:** `backend/src/app.ts`  
**Finding:** Bootstrap checks Firebase but not email service. Add a test email send on startup.

### ℹ️ LOW-4: Frontend Stores Tokens in localStorage
**File:** Frontend (inferred from auth interceptor)  
**Finding:** `localStorage` is vulnerable to XSS. Consider httpOnly cookies for refresh tokens (already used for cookie flow, but access token may be in localStorage).

### ℹ️ LOW-5: No Request ID Tracing
**File:** All endpoints  
**Finding:** No request ID header (`X-Request-ID`) for tracing requests across services. Add middleware to generate and log request IDs.

---

## Production Readiness Checklist

### ❌ Secrets Management
- [ ] All secrets rotated and removed from git history
- [ ] Secrets moved to environment variables
- [ ] `.env` confirmed in `.gitignore`
- [ ] GitHub secret scanning enabled

### ❌ Security Hardening
- [ ] Rate limiting on all mutation endpoints
- [ ] Input validation on all amount fields
- [ ] Atomic approval processing (transactions)
- [ ] Authorization checks in service layer
- [ ] CORS restricted to known origins
- [ ] CSP headers configured
- [ ] Pagination limits capped

### ❌ Error Handling
- [ ] Generic error messages for auth failures (no "user not found" vs "wrong password")
- [ ] Stack traces removed from production errors
- [ ] Sensitive data removed from logs

### ⚠️ Monitoring & Logging
- [ ] Structured logging for financial operations
- [ ] Error alerting configured (Sentry, etc.)
- [ ] Performance monitoring (response times, error rates)
- [ ] Audit log retention policy defined

### ⚠️ Database
- [ ] Indexes confirmed for all frequent queries
- [ ] Connection pool sized appropriately for M0 tier
- [ ] Backup strategy documented and tested
- [ ] Transaction support tested for approval flows

### ⚠️ Testing
- [ ] Integration tests for approval race conditions
- [ ] Security tests for authorization bypass
- [ ] Load tests for pagination endpoints
- [ ] Frontend e2e tests exist (currently missing)

### ✅ Deployment (Mostly Done)
- [x] CI/CD pipeline configured
- [x] Health check endpoint exists
- [x] Render.com free tier configured
- [ ] Deployment rollback plan documented
- [ ] Production monitoring dashboard set up

---

## Recommendations Priority

### Immediate (Before Any Production Use)
1. Rotate all secrets (CRITICAL-1)
2. Fix password reset timing attack (CRITICAL-2)
3. Add atomic approval processing (CRITICAL-3)
4. Add authorization checks in services (CRITICAL-4)
5. Replace weak JWT secrets (CRITICAL-5)

### Short-term (Within 1 Week)
6. Add rate limiting to approval endpoints (HIGH-1)
7. Add amount field validation (HIGH-2)
8. Fix access schedule bypass (HIGH-3)
9. Implement transaction rollbacks (HIGH-4)
10. Review project manager scope (HIGH-5)

### Medium-term (Within 1 Month)
11. Add audit logging for financial ops (MEDIUM-3)
12. Restrict CORS to known origins (MEDIUM-4)
13. Cap pagination limits (MEDIUM-5)
14. Add XSS protection audit (MEDIUM-1)
15. Implement invite cleanup job (MEDIUM-2)

---

## Testing Recommendations

### Security Tests to Add
1. **Token Forgery Test**: Verify that modified JWT tokens are rejected
2. **RBAC Bypass Test**: Attempt to access another project's data as a scoped PM
3. **Race Condition Test**: Submit two simultaneous approval requests for the same item
4. **SQL Injection Test**: Try NoSQL injection in filter parameters (`{ $ne: null }`)
5. **Rate Limit Test**: Verify rate limiters block excessive requests
6. **Amount Validation Test**: Try negative amounts, NaN, Infinity

### Load Tests to Add
1. **Concurrent Approvals**: 10 admins approving different items simultaneously
2. **Pagination Stress**: Request large pages (limit=1000) repeatedly
3. **Hydration Load**: Measure workspace hydration time with 10k+ materials
4. **Connection Pool**: Verify M0 connection pool doesn't exhaust under load

---

## Additional Notes

### Good Security Practices Found
✅ JWT-based authentication with separate access/refresh tokens  
✅ Zod validation on most endpoints  
✅ Rate limiting on auth endpoints  
✅ Password hashing with bcrypt  
✅ RBAC middleware with role checks  
✅ Access schedule enforcement  
✅ Token revocation on logout  

### Architecture Strengths
✅ Layered architecture (routes → controllers → services → models)  
✅ Centralized error handling  
✅ Response caching for M0 performance  
✅ Cursor-based pagination for large datasets  
✅ Compound indexes for frequent queries  

### Areas for Improvement
⚠️ Transaction support for multi-document updates  
⚠️ Comprehensive audit logging  
⚠️ Frontend unit tests (currently none)  
⚠️ End-to-end integration tests  
⚠️ Performance monitoring in production  

---

**Report Generated:** 2026-09-09  
**Next Audit Recommended:** After critical fixes are deployed (within 2 weeks)
