import mongoose from "mongoose";
import { env, isProduction } from "./env.js";

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      // M0 free-tier cluster can only handle ~3-5 concurrent ops reliably.
      // Capping the pool prevents the connection pool from being marked
      // as unhealthy when concurrent hydration requests exceed capacity.
      maxPoolSize: 5,
      minPoolSize: 1,
      socketTimeoutMS: 30000,
      heartbeatFrequencyMS: 10000,
      waitQueueTimeoutMS: 20000,
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
