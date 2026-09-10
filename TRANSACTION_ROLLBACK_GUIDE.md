# Transaction Rollback Implementation Guide

**Priority:** HIGH-4  
**Status:** Requires careful implementation  
**Estimated Effort:** 4-8 hours

## Problem

Currently, approval processing updates multiple documents (Approval, Material/Expense/Labour, Inventory, Project totals, Site ledger) without transactions. If any step fails midway, earlier changes persist, causing data inconsistency.

## Current Risk Scenario

1. Material status updated to "Not Received" ✅
2. `addApprovedMaterialToInventory` succeeds ✅
3. `recomputeProjectTotals` throws an error ❌
4. **Result:** Material is approved, inventory is added, but Approval document still shows "Pending"

## Solution: MongoDB Transactions

### Prerequisites

- MongoDB 4.0+ (replica set or sharded cluster)
- Current deployment: MongoDB Atlas M0 - **transactions are supported**

### Implementation Approach

#### 1. Wrap Approval Service in Transactions

```typescript
import mongoose from "mongoose";

export async function approveRequest(
  approvalId: string,
  reviewer: string,
  reviewerRole: string = "admin",
  options: { ... } = {}
): Promise<IApproval> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Use atomic findOneAndUpdate (already implemented)
    const approval = await Approval.findOneAndUpdate(
      { approvalId, status: "Pending" },
      {
        status: "Approved",
        reviewedBy: reviewer,
        reviewedAt: new Date(),
      },
      { new: true, session }  // Add session here
    );

    if (!approval) {
      throw new AppError(409, "Approval not found or already processed");
    }

    // All subsequent operations must pass { session }
    switch (approval.sourceCollection) {
      case "materials":
        await Material.updateOne(
          { _id: approval.sourceId },
          { status: "Not Received", approvedBy: reviewer, approvedAt: new Date() },
          { session }  // Pass session
        );
        await addApprovedMaterialToInventory(
          approval.sourceId,
          quantity,
          reviewer,
          { session }  // Pass session to inventory service
        );
        break;

      case "expenses":
        await Expense.updateOne(
          { _id: approval.sourceId },
          sourceUpdate,
          { session }
        );
        if (exp?.projectId && exp.site) {
          await recomputeSiteLedger(exp.projectId, exp.site, { session });
        }
        break;

      // ... other cases
    }

    // Recompute totals within transaction
    if (projectId) {
      await recomputeProjectTotals(projectId, { session });
    }

    // Commit transaction if everything succeeds
    await session.commitTransaction();
    
    // Audit logging and notifications happen AFTER transaction commits
    logApprovalAction(...);
    
    return approval.toObject();
  } catch (error) {
    // Rollback on any error
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}
```

#### 2. Update All Called Services to Accept Session

Services that need transaction support:
- `addApprovedMaterialToInventory(materialId, quantity, reviewer, options?)` 
- `recomputeSiteLedger(projectId, site, options?)`
- `recomputeProjectTotals(projectId, options?)`
- `recomputeClientTotals(clientId, options?)`

Example:
```typescript
export async function addApprovedMaterialToInventory(
  materialId: Types.ObjectId,
  quantity: number,
  approvedBy: string,
  options: { session?: mongoose.ClientSession } = {}
): Promise<void> {
  const material = await Material.findById(materialId).session(options.session);
  
  await Inventory.create(
    [{
      materialId,
      quantity,
      approvedBy,
      // ... other fields
    }],
    { session: options.session }  // Note: create() needs array when using session
  );
}
```

#### 3. Update Project/Client Total Recomputation

```typescript
export async function recomputeProjectTotals(
  projectId: Types.ObjectId,
  options: { session?: mongoose.ClientSession } = {}
): Promise<void> {
  const project = await Project.findById(projectId).session(options.session);
  
  const totals = await Material.aggregate([
    { $match: { projectId } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]).session(options.session);  // Aggregations need .session()
  
  await Project.updateOne(
    { _id: projectId },
    { totalMaterialCost: totals[0]?.total || 0 },
    { session: options.session }
  );
}
```

### Testing Strategy

#### 1. Unit Tests for Transaction Rollback

```typescript
describe("Approval Transaction Rollback", () => {
  it("should rollback if inventory update fails", async () => {
    const approvalId = "APR123";
    
    // Mock inventory service to throw error
    jest.spyOn(inventoryService, "addApprovedMaterialToInventory")
      .mockRejectedValue(new Error("Inventory full"));
    
    await expect(
      approvalService.approveRequest(approvalId, "admin123")
    ).rejects.toThrow("Inventory full");
    
    // Verify approval is still Pending
    const approval = await Approval.findOne({ approvalId });
    expect(approval.status).toBe("Pending");
    
    // Verify material status unchanged
    const material = await Material.findById(approval.sourceId);
    expect(material.status).not.toBe("Not Received");
  });
});
```

#### 2. Integration Tests

```typescript
it("should atomically update approval, material, and inventory", async () => {
  const approval = await createTestApproval();
  
  await approvalService.approveRequest(approval.approvalId, "admin");
  
  // Verify all updates happened
  const updatedApproval = await Approval.findOne({ approvalId: approval.approvalId });
  expect(updatedApproval.status).toBe("Approved");
  
  const material = await Material.findById(approval.sourceId);
  expect(material.status).toBe("Not Received");
  
  const inventory = await Inventory.findOne({ materialId: approval.sourceId });
  expect(inventory).toBeTruthy();
});
```

### Performance Considerations

**Transaction Overhead:**
- Transactions add ~5-10ms latency per operation
- M0 tier supports transactions but has limited connection pool (3 connections)
- Current `dbMutex` limits concurrent ops to 3, which already serializes transactions

**Optimization:**
- Keep transactions short - commit as soon as core updates are done
- Move notifications and audit logging OUTSIDE transaction (after commit)
- Use `session.withTransaction()` for automatic retry on transient errors

### Migration Plan

1. **Phase 1:** Add session parameter to all financial services (optional, default null)
2. **Phase 2:** Wrap approval service in transaction, pass session through
3. **Phase 3:** Add transaction tests
4. **Phase 4:** Deploy to staging, monitor for errors
5. **Phase 5:** Deploy to production

### Rollback Plan

If transactions cause issues:
1. Set `ENABLE_TRANSACTIONS=false` in environment
2. Wrap transaction code in feature flag:
   ```typescript
   if (env.ENABLE_TRANSACTIONS) {
     // Use transactions
   } else {
     // Use current logic
   }
   ```

## Alternative: Idempotency + Retry

If transactions prove too complex:

1. Make all operations idempotent (can be safely retried)
2. Add unique constraint on approval operations
3. Implement retry logic with exponential backoff
4. Accept eventual consistency

## Recommendation

**Implement transactions for approval operations.** The approval flow is the highest-risk area for data inconsistency, and MongoDB Atlas M0 supports transactions. The implementation is straightforward and testable.

**Estimated Timeline:**
- Day 1: Add session parameters to services
- Day 2: Wrap approval service in transactions
- Day 3: Write tests and verify rollback behavior
- Day 4: Deploy and monitor

---

**Status:** Ready for implementation  
**Risk:** Medium (requires careful testing)  
**Benefit:** High (prevents data corruption)
