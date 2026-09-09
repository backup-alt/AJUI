import { Schema, model } from "mongoose";

const inboxMessageSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 4000 },
  link: { type: String, trim: true, maxlength: 1000 },
  readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });
inboxMessageSchema.index({ ownerId: 1, createdAt: -1 });
inboxMessageSchema.index({ ownerId: 1, readBy: 1, createdAt: -1 });
export const InboxMessage = model("InboxMessage", inboxMessageSchema);
