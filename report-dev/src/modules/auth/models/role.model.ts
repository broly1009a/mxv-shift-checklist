import { Schema, Document } from 'mongoose';
import { mongoConnector } from '@/mongo/mongoConnector';

export interface IRole {
  code: string;
  name?: string;
  module?: string;
  action?: string;
  description?: string;
  status?: string;
  source?: string;
  isSystem?: boolean;
  sortOrder?: number;
  createdBy?: string;
  lastModifiedBy?: string;
}

export interface IRoleDoc extends Document {
  code: string;
  name: string;
  module: string;
  action: string;
  description: string;
  status: string;
  source: string;
  isSystem: boolean;
  sortOrder: number;
  createdBy?: string;
  lastModifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRoleDoc>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    module: { type: String, default: '' },
    action: { type: String, default: '' },
    description: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'DEPRECATED'], default: 'ACTIVE' },
    source: { type: String, enum: ['SHARE'], default: 'SHARE' },
    isSystem: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: String },
    lastModifiedBy: { type: String }
  },
  { timestamps: true }
);

const RoleModel = mongoConnector.db.model<IRoleDoc>('roles', RoleSchema);
export default RoleModel;
