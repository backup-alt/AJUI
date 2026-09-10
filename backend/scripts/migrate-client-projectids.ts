/**
 * Migration: Fix Client.projectIds to use MongoDB ObjectIds instead of business IDs
 *
 * Problem: Client.projectIds was storing business IDs like "AB001" instead of
 * MongoDB ObjectIds. This caused the frontend filter to fail when matching projects
 * to clients.
 *
 * Solution: Convert all business IDs in Client.projectIds to their corresponding
 * MongoDB ObjectIds by looking up projects.
 *
 * Run: npx tsx backend/scripts/migrate-client-projectids.ts
 */

import mongoose from "mongoose";
import { Client } from "../src/models/Client.js";
import { Project } from "../src/models/Project.js";
import { config } from "dotenv";

config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ajui";

async function migrateClientProjectIds() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Get all clients
    const clients = await Client.find({});
    console.log(`Found ${clients.length} clients`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const client of clients) {
      if (!client.projectIds || client.projectIds.length === 0) {
        console.log(`  Client ${client.name} (${client.clientId}): No projects, skipping`);
        continue;
      }

      const oldProjectIds = [...client.projectIds];
      const newProjectIds: mongoose.Types.ObjectId[] = [];

      // Convert each projectId
      for (const projectId of oldProjectIds) {
        const projectIdStr = String(projectId);

        // Check if it's already a valid ObjectId
        if (mongoose.Types.ObjectId.isValid(projectIdStr) && projectIdStr.length === 24) {
          // Might already be an ObjectId, keep it
          newProjectIds.push(new mongoose.Types.ObjectId(projectIdStr));
          continue;
        }

        // It's a business ID like "AB001", look up the project
        const project = await Project.findOne({ projectId: projectIdStr });
        if (project) {
          newProjectIds.push(project._id as mongoose.Types.ObjectId);
          console.log(`  Converted ${projectIdStr} → ${project._id}`);
        } else {
          console.warn(`  Warning: Project ${projectIdStr} not found for client ${client.name}`);
          errorCount++;
        }
      }

      // Update the client with new ObjectId-based projectIds
      if (newProjectIds.length > 0) {
        await Client.findByIdAndUpdate(client._id, {
          $set: { projectIds: newProjectIds }
        });
        console.log(`✓ Client ${client.name} (${client.clientId}): Updated ${newProjectIds.length} project IDs`);
        migratedCount++;
      }
    }

    console.log("\n=== Migration Complete ===");
    console.log(`Migrated: ${migratedCount} clients`);
    console.log(`Errors: ${errorCount} missing projects`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

migrateClientProjectIds();
