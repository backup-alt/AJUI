import mongoose from "mongoose";
import { env, isProduction } from "./env.js";

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
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

    console.log(
      `[DB] Connected to MongoDB (${isProduction ? "production" : "development"})`
    );
    console.log(`[DB] Database: ${mongoose.connection.db?.databaseName}`);

    // Additional debugging information
    console.log("[DB] Ready state:", mongoose.connection.readyState);
    console.log("[DB] Host:", mongoose.connection.host);
    console.log("[DB] Name:", mongoose.connection.name);
    console.log("[DB] Connection ID:", mongoose.connection.id);

    mongoose.connection.on("connected", () => {
      console.log("[DB] Connected event fired");
    });

    mongoose.connection.on("error", (err) => {
      console.error("[DB] Connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("[DB] Disconnected from MongoDB");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("[DB] Reconnected to MongoDB");
    });

    mongoose.connection.on("close", () => {
      console.warn("[DB] Connection closed");
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