import { Types } from "mongoose";
import { DeviceToken } from "../models/DeviceToken.js";
import { sendMulticast, sendPushNotification } from "../config/firebase.js";
import { AppError } from "../middleware/errorHandler.js";

export async function registerDeviceToken(input: {
  userId: string;
  fcmToken: string;
  platform: "ios" | "android" | "web";
  deviceId?: string;
  appVersion?: string;
}) {
  const existing = await DeviceToken.findOne({ fcmToken: input.fcmToken });
  if (existing) {
    existing.userId = new Types.ObjectId(input.userId);
    existing.platform = input.platform;
    existing.deviceId = input.deviceId;
    existing.appVersion = input.appVersion;
    existing.lastSeenAt = new Date();
    await existing.save();
    return existing.toObject();
  }

  const deviceToken = await DeviceToken.create({
    userId: new Types.ObjectId(input.userId),
    fcmToken: input.fcmToken,
    platform: input.platform,
    deviceId: input.deviceId,
    appVersion: input.appVersion,
    lastSeenAt: new Date(),
  });

  return deviceToken.toObject();
}

export async function unregisterDeviceToken(userId: string, fcmToken: string) {
  const result = await DeviceToken.deleteOne({ userId: new Types.ObjectId(userId), fcmToken });
  return { deleted: result.deletedCount > 0 };
}

export async function getUserDevices(userId: string) {
  return DeviceToken.find({ userId: new Types.ObjectId(userId) })
    .sort({ lastSeenAt: -1 })
    .lean();
}

export async function notifyUserOfApproval(
  userId: string | Types.ObjectId,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  const devices = await DeviceToken.find({ userId: typeof userId === "string" ? new Types.ObjectId(userId) : userId }).lean();
  if (devices.length === 0) return 0;

  const tokens = devices.map((d) => d.fcmToken);
  return sendMulticast(tokens, title, body, data);
}

export async function notifyUserOfApprovalSingle(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  return sendPushNotification(fcmToken, title, body, data);
}

export async function notifyProjectSupervisors(
  projectId: string | Types.ObjectId,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<number> {
  const { Project } = await import("../models/Project.js");
  const { Supervisor } = await import("../models/Supervisor.js");

  const pid = typeof projectId === "string" ? new Types.ObjectId(projectId) : projectId;
  const project = await Project.findById(pid).lean();
  if (!project) throw new AppError(404, "Project not found");

  // Project.supervisorId points at a Supervisor profile, whereas device
  // tokens belong to User records. Also include both the current multi-project
  // assignment field and the legacy single-project field. The old code treated
  // project.supervisorId as a User id and missed assignedProjects entirely,
  // so most valid devices never received a push.
  const supervisorConditions: Record<string, unknown>[] = [
    { assignedProjectId: pid },
    { assignedProjects: pid },
  ];
  if (project.supervisorId) {
    supervisorConditions.push({ _id: project.supervisorId });
  }
  const supervisors = await Supervisor.find({ $or: supervisorConditions })
    .select("userId")
    .lean();
  const userIds = Array.from(new Set(
    supervisors
      .map((supervisor) => supervisor.userId?.toString())
      .filter((id): id is string => Boolean(id))
  ));

  if (userIds.length === 0) return 0;

  let total = 0;
  for (const userId of userIds) {
    total += await notifyUserOfApproval(userId, title, body, data);
  }
  return total;
}

export async function cleanupInactiveTokens(daysOld = 90) {
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  const result = await DeviceToken.deleteMany({ lastSeenAt: { $lt: cutoff } });
  return { deleted: result.deletedCount || 0 };
}
