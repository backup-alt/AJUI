import { Schema, model, Document, Types } from "mongoose";

export type DevicePlatform = "ios" | "android" | "web";

export interface IDeviceToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  fcmToken: string;
  platform: DevicePlatform;
  deviceId?: string;
  appVersion?: string;
  lastSeenAt: Date;
  createdAt: Date;
}

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fcmToken: { type: String, required: true, unique: true },
    platform: { type: String, enum: ["ios", "android", "web"], required: true },
    deviceId: { type: String },
    appVersion: { type: String },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const DeviceToken = model<IDeviceToken>("DeviceToken", deviceTokenSchema);
