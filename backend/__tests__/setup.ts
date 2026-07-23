import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { createApp } from "../src/app";
import { User } from "../src/models/User";
import { Client } from "../src/models/Client";
import { Project } from "../src/models/Project";
import { Counter } from "../src/models/Counter";
import { ensureDefaultPermissions } from "../src/models/RolePermission";
import { hashPassword } from "../src/utils/password";

export let app: ReturnType<typeof createApp>;

const FLAG_FILE = path.join(__dirname, ".mongo-available");
const mongoAvailable = fs.existsSync(FLAG_FILE) && fs.readFileSync(FLAG_FILE, "utf-8") === "true";

beforeAll(async () => {
  if (!mongoAvailable) {
    console.warn("[tests] MongoDB not available — integration tests will be skipped");
    return;
  }

  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test_access_secret_minimum_16_chars_long";
  process.env.JWT_REFRESH_SECRET = "test_refresh_secret_minimum_16_chars_long";
  process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || "mongodb://127.0.0.1:27017/ajui_test";

  await mongoose.connect(process.env.MONGODB_URI);

  await Promise.all([
    User.deleteMany({}),
    Client.deleteMany({}),
    Project.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  await ensureDefaultPermissions();

  const passwordHash = await hashPassword("TestPass123");
  await User.create({
    name: "Test Admin",
    email: "admin@test.com",
    phone: "+919999999999",
    passwordHash,
    role: "admin",
    status: "active",
  });

  app = createApp();
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});
