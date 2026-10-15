import mongoose, { Schema } from "mongoose";
import { mongoConnector } from "@/mongo/mongoConnector";

export interface IZaloHistoryDoc extends mongoose.Document {
  phoneNumber?: string;
  userId?: string;
  templateId?: string;
  payload: string;
  status: string;
  error?: string;
  messageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ZaloHistorySchema = new Schema(
  {
    phoneNumber: { type: String },
    userId: { type: String },
    templateId: { type: String },
    payload: { type: String, required: true },
    status: { type: String, enum: ["SUCCESS", "FAILED"], required: true },
    error: { type: String },
    messageId: { type: String },
  },
  {
    timestamps: true,
  }
);

export const ZaloHistoryModel = mongoConnector.db.model<IZaloHistoryDoc>(
  "ZaloHistories",
  ZaloHistorySchema
);
