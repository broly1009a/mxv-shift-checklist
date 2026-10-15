import { Document, Schema, Types } from "mongoose";
import { Audit } from "@svl/share";
import { mongoConnector } from "@/mongo/mongoConnector";

export interface IAuditLog {
  correlation_id: string;
  owner: string;
  title: string;
  content: string;
  attach_data?: {
    raw?: any;
    metadata?: any;
  };
  time: Date;
  ip: string;
  device: string;
  client: string;
  os: string;
  action: Audit.Enums.AuditAction;
  created_by: Audit.Enums.AuditCreatedBy;
  status: Audit.Enums.AuditStatus;
  member_id?: string;
  account_id?: string;
  broker_id?: string;
  sender?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface IAuditLogDoc extends Document, IAuditLog {
  _id: Types.ObjectId;
}

const AuditLogSchema = new Schema<IAuditLogDoc>(
  {
    correlation_id: {
      type: String,
      unique: true,
      required: true
    },
    owner: {
      type: String
    },
    title: {
      type: String
    },
    content: {
      type: String
    },
    attach_data: {
      type: new Schema(
        {
          raw: { type: Schema.Types.Mixed },
          metadata: { type: Schema.Types.Mixed },
        },
        { _id: false },
      ),
    },
    time: {
      type: Date,
      default: () => new Date()
    },
    ip: {
      type: String
    },
    device: {
      type: String
    },
    client: {
      type: String
    },
    os: {
      type: String
    },
    action: {
      type: Number,
      enum: Object.values(Audit.Enums.AuditAction).filter(
        (value) => typeof value === "number"
      ),
      default: Audit.Enums.AuditAction.CREATE,
    },
    created_by: {
      type: Number,
      enum: Object.values(Audit.Enums.AuditCreatedBy).filter(
        (value) => typeof value === "number"
      ),
    },
    status: {
      type: Number,
      enum: Object.values(Audit.Enums.AuditStatus).filter(
        (value) => typeof value === "number"
      ),
      default: Audit.Enums.AuditStatus.PENDING,
    },
    member_id: {
      type: String
    },
    account_id: {
      type: String
    },
    broker_id: {
      type: String
    },
    sender: {
      type: String
    },
    created_at: {
      type: Date,
      required: false
    },
    updated_at: {
      type: Date,
      required: false
    }
  },
  {
    collection: "audit_logs",
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
    versionKey: false,
    toJSON: {
      transform: (_doc: any, ret: any) => {
        ret.audit_log_id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  },
);

AuditLogSchema.index({ title: "text", content: "text" });
AuditLogSchema.index({ owner: 1, time: -1 });
AuditLogSchema.index({ status: 1, time: -1 });
AuditLogSchema.index({ member_id: 1, account_id: 1, broker_id: 1 });

export const AuditLogModel = mongoConnector.db.model<IAuditLogDoc>(
  "audit_logs",
  AuditLogSchema
);
