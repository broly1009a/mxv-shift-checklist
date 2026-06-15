import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Department } from './department.schema';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true, index: true })
  username: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', required: false, default: null })
  departmentId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Division', required: false, default: null })
  divisionId?: Types.ObjectId | null;

  @Prop({ required: true, enum: ['ADMIN', 'CHAIRMAN', 'CEO', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD', 'STAFF'], default: 'STAFF' })
  role: string;

  @Prop({ required: true, type: Boolean, default: false })
  isActive: boolean;

  @Prop({
    type: {
      theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
      autoRefreshInterval: { type: Number, default: 30 },
      telegramNotifications: { type: Boolean, default: true },
      telegramChatId: { type: String, default: '' },
      alertThresholdMinutes: { type: Number, default: 15 },
    },
    _id: false,
    default: () => ({})
  })
  settings: {
    theme: 'dark' | 'light';
    autoRefreshInterval: number;
    telegramNotifications: boolean;
    telegramChatId: string;
    alertThresholdMinutes: number;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.virtual('id').get(function (this: User) {
  return this._id.toHexString();
});
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete (ret as any).passwordHash;
    return ret;
  },
});
UserSchema.set('toObject', { virtuals: true });
