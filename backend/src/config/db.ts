import mongoose from "mongoose";
import { env, isProduction } from "./env.js";

export async function connectDatabase(): Promise<void> {
  try {
    mongoose.set("strictQuery", true);

    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,

      // Atlas M0 free tier has aggressive idle-connection reaping — any
      // socket that goes 60+ seconds without traffic gets killed by Atlas,
      // and the driver doesn't know until it tries to use it. The fix is:
      //
      //   - keepAlive + keepAliveInitialDelay: ping the connection every
      //     30s so Atlas never considers it idle
      //   - maxIdleTimeMS: recycle sockets before Atlas kills them
      //   - minPoolSize: 0: don't hold idle conns at all (we open on demand)
      //   - maxPoolSize: 3: M0 cluster caps at ~100 conns shared across
      //     every Render service. With many parallel hydration calls we
      //     were exhausting the cluster budget. 3 keeps our footprint
      //     small. The fix for "too many parallel calls" is sequential
      //     awaits (already done in listMaterials/listInventory/listExpenses),
      //     not bigger pools.
      //   - waitQueueTimeoutMS: 3000 — fail fast instead of holding the
      //     request open. Frontend retries the request.
      maxPoolSize: 3,
      minPoolSize: 0,
      socketTimeoutMS: 15000,
      heartbeatFrequencyMS: 10000,
      waitQueueTimeoutMS: 3000,
      maxIdleTimeMS: 45000,
      // Mongoose-specific option (not in raw mongodb types) — keep sockets
      // alive so Atlas doesn't kill them during quiet periods.
      keepAlive: true,
      keepAliveInitialDelay: 30000,
      retryWrites: true,
      retryReads: true,
    } as mongoose.ConnectOptions);

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
