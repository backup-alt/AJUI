import { Project } from "../src/models/Project";
import { Material } from "../src/models/Material";
import { connect, disconnect } from "mongoose";

async function checkData() {
  try {
    await connect("mongodb://localhost:27017/annai-builders");
    const projects = await Project.find({}).lean();
    console.log("Projects:", projects.length);
    projects.forEach(p => console.log("  Project:", p.name, "sites:", p.sites));
    
    const materials = await Material.find({}).lean();
    console.log("Materials:", materials.length);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await disconnect();
  }
}

checkData();