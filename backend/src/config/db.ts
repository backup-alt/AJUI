import mongoose from "mongoose";
import { env, isProduction } from "./env.js";

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(env.MONGODB_URI, {
      // Atlas M0 free tier routinely drops idle TCP connections and
      // takes 5–10s to re-handshake the TLS tunnel on the next request.
      // The previous 15s window was too tight — requests fired right
      // after an idle drop would fail with ETIMEDOUT before the driver
      // could rediscover the cluster. Bump the timeout + keep a warm
      // pool of two connections so we never start from zero.
      serverSelectionTimeoutMS: 30_000,
      connectTimeoutMS: 20_000,
      socketTimeoutMS: 60_000,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxConnecting: 3,
      heartbeatFrequencyMS: 10_000,
      waitQueueTimeoutMS: 30_000,
      maxIdleTimeMS: 30_000,
      retryWrites: true,
      retryReads: true,
      // Force the driver to consider both primary and secondary shards
      // (M0 has a 3-node replica set; we want quick failover rather than
      // pinning to whichever shard was selected at boot).
      readPreference: "primaryPreferred",
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