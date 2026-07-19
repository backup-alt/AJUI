import mongoose from "mongoose";
import { Worker } from "../models/Worker.js";
import { Attendance } from "../models/Attendance.js";

/**
 * Ensure the dedicated `workers` collection exists with proper indexes,
 * and similarly for `attendances`. Mongoose normally auto-creates these
 * collections on first write, but the supervisor app needs to be able to
 * create workers from a cold start, so we eagerly create them here.
 */
export async function ensureWorkersCollection(): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) {
      console.warn("[ensure-collections] No db handle yet, skipping");
      return;
    }

    const existing = (
      await db.listCollections({ name: "workers" }).toArray()
    ).map((c) => c.name);

    if (!existing.includes("workers")) {
      await db.createCollection("workers");
      console.log("[ensure-collections] Created 'workers' collection");
    } else {
      console.log("[ensure-collections] 'workers' collection already exists");
    }

    await Worker.syncIndexes();
    console.log("[ensure-collections] Worker indexes synced");

    const attendanceExists = (
      await db.listCollections({ name: "attendances" }).toArray()
    ).map((c) => c.name);

    if (!attendanceExists.includes("attendances")) {
      await db.createCollection("attendances");
      console.log("[ensure-collections] Created 'attendances' collection");
    } else {
      console.log("[ensure-collections] 'attendances' collection already exists");
    }

    await Attendance.syncIndexes();
    console.log("[ensure-collections] Attendance indexes synced");
  } catch (err) {
    console.error("[ensure-collections] failed to ensure collections", err);
  }
}
