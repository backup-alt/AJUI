import { Types } from "mongoose";
import { Material } from "../src/models/Material.js";
import { Site } from "../src/models/Site.js";
import { connect, disconnect } from "mongoose";
import { config } from "dotenv";

config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/annai-builders";

async function main() {
  try {
    await connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find all materials where site is an ObjectId (not a string) or site is missing but siteId exists
    const materials = await Material.find({
      $or: [
        { site: { $type: "objectId" } },
        { site: { $exists: false }, siteId: { $exists: true, $ne: null } },
        { site: null, siteId: { $exists: true, $ne: null } },
        { site: "", siteId: { $exists: true, $ne: null } },
      ],
    }).lean();

    console.log(`Found ${materials.length} materials needing site name migration`);

    if (materials.length === 0) {
      console.log("No materials need migration");
      return;
    }

    // Get all unique siteIds
    const siteIds = [...new Set(materials.map(m => m.siteId?.toString()).filter(Boolean))];
    console.log(`Found ${siteIds.length} unique site IDs to resolve`);

    // Fetch all sites
    const sites = await Site.find({ _id: { $in: siteIds.map(id => new Types.ObjectId(id)) } }).lean();
    const siteNameMap = new Map(sites.map(s => [s._id.toString(), s.name]));
    
    console.log(`Resolved ${siteNameMap.size} site names`);

    // Update materials in batches
    let updated = 0;
    for (const material of materials) {
      const siteId = material.siteId?.toString();
      const siteName = siteId ? siteNameMap.get(siteId) : undefined;
      
      if (siteName) {
        await Material.updateOne(
          { _id: material._id },
          { $set: { site: siteName } }
        );
        updated++;
      }
    }

    console.log(`Updated ${updated} materials with site names`);
    
    // Verify
    const remaining = await Material.countDocuments({
      $or: [
        { site: { $type: "objectId" } },
        { site: { $exists: false }, siteId: { $exists: true, $ne: null } },
        { site: null, siteId: { $exists: true, $ne: null } },
        { site: "", siteId: { $exists: true, $ne: null } },
      ],
    });
    console.log(`Remaining materials with ObjectId site: ${remaining}`);
    
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await disconnect();
    console.log("Disconnected from MongoDB");
  }
}

main().catch(console.error);