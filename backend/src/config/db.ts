import mongoose from "mongoose";
import { env, isProduction } from "./env.js";

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      // Cap the pool aggressively for M0 free tier — too high and every
      // concurrent request times out because M0 caps total connections
      // (~100 cluster-wide). 5 + maxTimeMS(5s) on each query means each
      // request takes 1 connection for at most ~5s before failing, freeing
      // it for the next request.
      maxPoolSize: 5,
      minPoolSize: 1,
      socketTimeoutMS: 20000,
      heartbeatFrequencyMS: 10000,
      // Wait queue timeout of 12s — long enough to ride out transient pool
      // contention, short enough that the client (15s timeout) sees the
      // response before it cancels.
      waitQueueTimeoutMS: 12000,
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
