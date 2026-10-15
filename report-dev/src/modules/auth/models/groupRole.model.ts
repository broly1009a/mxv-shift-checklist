import { Schema, Document } from 'mongoose';
import { mongoConnector } from '@/mongo/mongoConnector';
import { Identity } from '@svl/share';

export interface IGroupRole {
  name: string;
  description?: string;
  role?: string[];
  status: Identity.Enums.GroupRoleStatus;
  createdBy: string;
  lastModifiedBy?: string;
}

export interface IGroupRoleDoc extends Document {
  name: string;
  description?: string;
  role: string[];
  status: Identity.Enums.GroupRoleStatus;
  createdBy: string;
  lastModifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GroupRoleSchema = new Schema<IGroupRoleDoc>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    role: { type: [String], default: [] },
    status: { type: String, required: true, enum: Identity.Enums.GroupRoleStatus, default: Identity.Enums.GroupRoleStatus.ACTIVE },
    createdBy: { type: String, required: true },
    lastModifiedBy: { type: String }
  },
  { timestamps: true }
);

const GroupRoleModel = mongoConnector.db.model<IGroupRoleDoc>('groupRoles', GroupRoleSchema);
export default GroupRoleModel;
