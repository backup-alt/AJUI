import { Schema, model, Document, Types } from "mongoose";

export interface IPasswordResetToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
}

const passwordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

export const PasswordResetToken = model<IPasswordResetToken>(
  "PasswordResetToken",
  passwordResetTokenSchema
);
