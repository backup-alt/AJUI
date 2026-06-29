import { z } from "zod";

export const updateOwnProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().min(8).max(20).optional(),
    address: z.string().trim().optional(),
  }),
});

export const registerDeviceSchema = z.object({
  body: z.object({
    fcmToken: z.string().min(10),
    platform: z.enum(["ios", "android", "web"]),
    deviceId: z.string().optional(),
    appVersion: z.string().optional(),
  }),
});

export const unregisterDeviceSchema = z.object({
  body: z.object({
    fcmToken: z.string().min(10),
  }),
});

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid ObjectId");
