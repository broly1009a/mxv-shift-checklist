import mongoose, { Schema } from "mongoose";
import { mongoConnector } from "@/mongo/mongoConnector";

export interface ITeamsHistoryDoc extends mongoose.Document {
  webhookUrl: string;
  payload: string;
  status: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TeamsHistorySchema = new Schema(
  {
    webhookUrl: { type: String, required: true },
    payload: { type: String, required: true },
    status: { type: String, enum: ["SUCCESS", "FAILED"], required: true },
    error: { type: String },
  },
  {
    timestamps: true,
  }
);

export const TeamsHistoryModel = mongoConnector.db.model<ITeamsHistoryDoc>(
  "TeamsHistories",
  TeamsHistorySchema
);
