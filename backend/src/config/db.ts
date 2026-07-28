import mongoose from "mongoose";
import { env, isProduction } from "./env.js";

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      // Cap the pool at a sustainable size for M0 free tier — too high and
      // every concurrent request times out; too low and the wait queue
      // fills up before requests can complete.
      maxPoolSize: 10,
      minPoolSize: 1,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      // Long wait queue timeout lets in-flight requests finish instead of
      // getting rejected with WaitQueueTimeoutError.
      waitQueueTimeoutMS: 60000,
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
