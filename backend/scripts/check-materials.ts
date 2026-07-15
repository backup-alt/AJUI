import { Material } from "../src/models/Material";
import { connect, disconnect } from "mongoose";

async function checkMaterials() {
  try {
    await connect("mongodb://localhost:27017/annai-builders");
    const materials = await Material.find({}).lean();
    console.log("Total materials:", materials.length);
    materials.slice(0, 10).forEach(m => {
      console.log("site:", JSON.stringify(m.site), "siteId:", m.siteId, "typeof site:", typeof m.site, "site is Object:", typeof m.site === "object");
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await disconnect();
  }
}

checkMaterials();