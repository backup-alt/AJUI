import mongoose from "mongoose";
import { env, isProduction } from "./env";

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
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
