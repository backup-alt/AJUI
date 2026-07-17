import { connectDatabase } from "../config/db.js";
import { Vendor } from "../models/Vendor.js";

async function migrate() {
  await connectDatabase();
  console.log("Starting vendor-sites migration...");

  const result = await Vendor.updateMany(
    { siteIds: { $exists: false } },
    { $set: { siteIds: [] } }
  );

  console.log(`Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);

  const unassigned = await Vendor.countDocuments({ siteIds: { $size: 0 } });
  console.log(`Vendors with empty siteIds: ${unassigned}`);
  console.log("Migration complete. Admin must edit vendors to assign sites.");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});