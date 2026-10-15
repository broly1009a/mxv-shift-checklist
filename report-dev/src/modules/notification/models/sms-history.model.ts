import mongoose, { Schema } from "mongoose";
import { mongoConnector } from "@/mongo/mongoConnector";

export interface ISmsHistoryDoc extends mongoose.Document {
  to: string[];
  message: string;
  sender?: string;
  brandName?: string;
  providerMessageId?: string;
  payload: string;
  response?: string;
  status: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SmsHistorySchema = new Schema(
  {
    to: { type: [String], required: true },
    message: { type: String, required: true },
    sender: { type: String },
    brandName: { type: String },
    providerMessageId: { type: String },
    payload: { type: String, required: true },
    response: { type: String },
    status: { type: String, enum: ["SUCCESS", "FAILED"], required: true },
    error: { type: String },
  },
  {
    timestamps: true,
  }
);

export const SmsHistoryModel = mongoConnector.db.model<ISmsHistoryDoc>(
  "SmsHistories",
  SmsHistorySchema
);
