import { Schema, Document } from "mongoose";
import { mongoConnector } from "@/mongo/mongoConnector";
import { Identity } from "@svl/share";

export interface IApproval {
  apiUrl: string;
  collectionName: string;
  documentId: string;
  description: string;
  action: Identity.Enums.ApprovalAction;
  status: Identity.Enums.ApprovalStatus;
  oldValue: string;
  pendingValue: string;
  tags: string;
  rejectedReason?: string;
  approvalDate?: number;
  createdBy: string;
  lastModifiedBy?: string;
}

export interface IApprovalDoc extends Document {
  apiUrl: string;
  collectionName: string;
  documentId: string;
  description: string;
  action: Identity.Enums.ApprovalAction;
  status: Identity.Enums.ApprovalStatus;
  oldValue: string;
  pendingValue: string;
  tags: string;
  rejectedReason?: string;
  approvalDate?: number;
  createdBy: string;
  lastModifiedBy?: string;
}

const ApprovalSchema = new Schema<IApprovalDoc>(
  {
    apiUrl: { type: String, required: true },
    collectionName: { type: String, required: true },
    documentId: { type: String, required: true },
    description: { type: String, required: true },
    action: {
      type: String,
      enum: Identity.Enums.ApprovalAction,
      required: true,
    },
    status: {
      type: String,
      enum: Identity.Enums.ApprovalStatus,
      default: Identity.Enums.ApprovalStatus.PENDING,
    },
    oldValue: { type: String, required: true },
    pendingValue: { type: String, required: true },
    rejectedReason: { type: String, required: false },
    approvalDate: { type: Number, required: false },
    lastModifiedBy: {
      type: String,
      required: false,
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const ApprovalModel = mongoConnector.db.model<IApprovalDoc>(
  "approvals",
  ApprovalSchema
);

export default ApprovalModel;
