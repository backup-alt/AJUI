import mongoose from "mongoose";
import { Expense } from "../models/Expense.js";
import { Approval } from "../models/Approval.js";
import { generatePoNumberForSite } from "../services/po-number.service.js";

const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
if (!MONGODB_URI) {
  console.error("MONGODB_URI or DATABASE_URL env var is required");
  process.exit(1);
}

const LEGACY_TO_NEW: Record<string, "Purchase" | "Cash Added"> = {
  "Cash Added": "Cash Added",
  Purchase: "Purchase",
  "Site Material": "Purchase",
  Site_Material: "Purchase",
  Cash_Added: "Cash Added",
  "Cash Advance": "Cash Added",
  Cash_Advance: "Cash Added",
  Advance: "Cash Added",
  Reimbursement: "Cash Added",
};

async function migrate() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI!);
  console.log("Connected.\n");

  const expenseResult = await Expense.updateMany(
    {},
    { $unset: { reference: 1, amountPaidBy: 1, department: 1, category: 1 } }
  );
  console.log(`Cleared legacy fields from ${expenseResult.modifiedCount} expenses`);

  const expenses = await Expense.find({}).lean();
  let updated = 0;
  let cashAddedCount = 0;
  let purchaseCount = 0;

  for (const exp of expenses) {
    const currentType = exp.transactionType as string;
    const newType = LEGACY_TO_NEW[currentType] ?? "Purchase";
    const needsUpdate: Record<string, unknown> = { transactionType: newType };

    if (newType === "Purchase" && exp.status === "Approved" && !exp.poNumber) {
      try {
        const poNumber = await generatePoNumberForSite(
          exp.siteId ? String(exp.siteId) : undefined,
          exp.site,
          exp.projectId ? String(exp.projectId) : undefined
        );
        needsUpdate.poNumber = poNumber;
        console.log(`Generated PO ${poNumber} for expense ${exp.expenseId}`);
      } catch (err) {
        console.warn(`  Failed to generate PO for ${exp.expenseId}:`, err);
      }
    }

    await Expense.updateOne({ _id: exp._id }, { $set: needsUpdate });
    updated++;
    if (newType === "Cash Added") cashAddedCount++;
    else purchaseCount++;
  }
  console.log(`Updated ${updated} expenses (${cashAddedCount} Cash Added, ${purchaseCount} Purchase)`);

  const legacyApprovals = await Approval.find({
    sourceCollection: "expenses",
    status: "Pending",
  }).lean();

  const expensesWithLegacyType = await Expense.distinct("_id", {
    transactionType: { $nin: ["Purchase", "Cash Added"] },
  });

  if (expensesWithLegacyType.length > 0) {
    const result = await Approval.updateMany(
      { sourceCollection: "expenses", sourceId: { $in: expensesWithLegacyType } },
      { $set: { status: "Rejected", reviewedAt: new Date(), reviewedBy: "migration-script" } }
    );
    console.log(`Rejected ${result.modifiedCount} approvals for legacy-type expenses`);
  }

  console.log("\nMigration complete.");
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});