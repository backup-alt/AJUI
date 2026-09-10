import { InviteToken } from "../models/InviteToken.js";

/**
 * MEDIUM-2 fix: Cleanup consumed invites older than 90 days.
 * This prevents database bloat and makes it easier to audit active invites.
 *
 * Should be called periodically (e.g., daily via cron job).
 */
export async function cleanupOldInvites(): Promise<{ deletedCount: number }> {
  const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

  const result = await InviteToken.deleteMany({
    usedAt: { $lt: cutoffDate },
  });

  console.log(`[InviteCleanup] Deleted ${result.deletedCount} consumed invites older than 90 days`);

  return { deletedCount: result.deletedCount || 0 };
}

/**
 * Cleanup expired but unused invites (past their expiresAt date).
 * These can be cleaned up more aggressively (e.g., after 7 days).
 */
export async function cleanupExpiredInvites(): Promise<{ deletedCount: number }> {
  const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  const result = await InviteToken.deleteMany({
    usedAt: { $exists: false },
    expiresAt: { $lt: cutoffDate },
  });

  console.log(`[InviteCleanup] Deleted ${result.deletedCount} expired invites older than 7 days`);

  return { deletedCount: result.deletedCount || 0 };
}
