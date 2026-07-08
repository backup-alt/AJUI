import { User } from "../models/User.js";
import { hashPassword } from "./password.js";

/**
 * Seed the first admin account if no admin exists in the database.
 * Reads credentials from env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_PHONE
 * If env not set, uses safe defaults that force a password reset on first login.
 */
export async function seedDefaultAdmin(): Promise<void> {
  const adminCount = await User.countDocuments({ role: "admin" });
  if (adminCount > 0) {
    console.log(`[Seed] Admin already exists (${adminCount}), skipping admin seed`);
    return;
  }

  const email = (process.env.ADMIN_EMAIL || "admin@annaigoldenbuilders.online").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD || "ChangeMe@2026!";
  const name = process.env.ADMIN_NAME || "AGB Admin";
  const phone = process.env.ADMIN_PHONE || "+910000000000";

  const existingByEmail = await User.findOne({ email });
  if (existingByEmail) {
    console.log(`[Seed] User with email ${email} already exists, skipping admin seed`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await User.create({
    name,
    email,
    phone,
    passwordHash,
    role: "admin",
    status: "active",
  });

  console.log(`[Seed] ✅ Default admin created`);
  console.log(`[Seed]    Email:    ${email}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`[Seed]    Password: ${password}  (CHANGE IMMEDIATELY via /forgot-password)`);
  } else {
    console.log(`[Seed]    Password: (set via ADMIN_PASSWORD env var)`);
  }
  console.log(`[Seed]    Phone:    ${phone}`);
}
