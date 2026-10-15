import mongoose, { Schema } from "mongoose";
import { mongoConnector } from "@/mongo/mongoConnector";

export interface IMailHistoryDoc extends mongoose.Document {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  content: string; // Stored as stringified JSON
  status: string; // 'SUCCESS' | 'FAILED'
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MailHistorySchema = new Schema(
  {
    to: { type: [String], required: true },
    cc: { type: [String] },
    bcc: { type: [String] },
    subject: { type: String, required: true },
    content: { type: String, required: true },
    status: { type: String, enum: ["SUCCESS", "FAILED"], required: true },
    error: { type: String },
  },
  {
    timestamps: true,
  }
);

export const MailHistoryModel = mongoConnector.db.model<IMailHistoryDoc>(
  "MailHistories",
  MailHistorySchema
);
