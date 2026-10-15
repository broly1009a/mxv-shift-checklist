import { Schema, Document, Types } from 'mongoose';
import { mongoConnector } from '@/mongo/mongoConnector';
import { Password } from '@mss/common';
import { Identity } from '@svl/share';

export interface IUser {
  email: string;
  username: string;
  fullname: string;
  phoneNumber: string;
  password: string;
  PIN: string;
  createdBy: string;
  avatar?: string;
  department?: string;
  joinDepartmentTime?: number;
  lastModifiedBy?: string;
  note?: string;
  requirePIN: boolean;
  requireChangePassword: boolean;
  numLoginFail: number;
  lastLoginAt?: number;
  role: string[];
  groupRole: string[];
  type: Identity.Enums.UserType;
  status: Identity.Enums.UserStatus;
}

export interface IUserDoc extends Document {
  email: string;
  username: string;
  fullname: string;
  phoneNumber: string;
  password: string;
  PIN: string;
  createdBy: string;
  avatar?: string;
  department?: string;
  joinDepartmentTime?: number;
  lastModifiedBy?: string;
  note?: string;
  requirePIN: boolean;
  requireChangePassword: boolean;
  numLoginFail: number;
  lastLoginAt?: number;
  role: string[];
  groupRole: Types.ObjectId[];
  type: Identity.Enums.UserType;
  status: Identity.Enums.UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    email: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    fullname: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    password: { type: String, required: true },
    PIN: { type: String, required: true },
    createdBy: { type: String, required: true },
    avatar: { type: String },
    department: { type: String },
    lastModifiedBy: { type: String },
    note: { type: String },
    requirePIN: { type: Boolean, default: true },
    requireChangePassword: { type: Boolean, default: true },
    numLoginFail: { type: Number, default: 0 },
    lastLoginAt: { type: Number },
    role: { type: [String], default: [] },
    groupRole: [{ type: Schema.Types.ObjectId, ref: 'groupRoles' }],
    type: { type: Number, enum: Identity.Enums.UserType, default: Identity.Enums.UserType.USER, required: true },
    status: { type: String, enum: Identity.Enums.UserStatus, default: Identity.Enums.UserStatus.ACTIVE }
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  const salt = Password.getSalt(8);

  if (this.isModified('password')) {
    this.password = await Password.toHash(this.password, salt);
  }

  if (this.isModified('PIN')) {
    this.PIN = await Password.toHash(this.PIN, salt);
  }

  next();
});

const UserModel = mongoConnector.db.model<IUserDoc>('Users', UserSchema);
export default UserModel;
