import mongoose from "mongoose";
import { env, isProduction } from "./env.js";

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,

      // Atlas M0 free tier is a shared cluster — every parallel query
      // slows down the others. The listMaterials / listInventory /
      // listExpenses services serialize their queries through
      // dbMutex (utils/db-mutex.ts), so most of the time only 1 query
      // is in flight at all. We keep a small pool as a buffer for
      // RBAC user lookups and other short queries that don't go
      // through the mutex.
      //
      // maxPoolSize: 5 — enough headroom for RBAC + a background
      // task, but small enough that we never starve the M0 cluster.
      // maxConnecting: 2 — back to the driver default. Connection
      // storms are mitigated by dbMutex, so we don't need to
      // allow many concurrent connection establishments.
      // minPoolSize: 0 — no idle conns. Open on demand.
      // waitQueueTimeoutMS: 8000 — give queued requests a fair
      // chance to find a slot before failing.
      // maxIdleTimeMS: 45000 — recycle sockets before Atlas's
      // ~60s idle reaper kills them.
      maxPoolSize: 5,
      minPoolSize: 0,
      maxConnecting: 2,
      socketTimeoutMS: 20000,
      heartbeatFrequencyMS: 10000,
      waitQueueTimeoutMS: 8000,
      maxIdleTimeMS: 45000,
      retryWrites: true,
      retryReads: true,
    });

    console.log(`[DB] Connected to MongoDB (${isProduction ? "production" : "development"})`);
    console.log(`[DB] Database: ${mongoose.connection.db?.databaseName}`);

    mongoose.connection.on("error", (err) => {
      console.error("[DB] Connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("[DB] Disconnected from MongoDB");
    });
  } catch (error) {
    console.error("[DB] Failed to connect:", error);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log("[DB] Disconnected");
}
