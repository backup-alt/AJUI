import { Schema, model } from "mongoose";

const inboxMessageSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 4000 },
}, { timestamps: true });
inboxMessageSchema.index({ ownerId: 1, createdAt: -1 });
export const InboxMessage = model("InboxMessage", inboxMessageSchema);
