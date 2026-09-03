import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type TkgdUserConfigDocument = TkgdUserConfig & Document;

export class MSystemCredentialsSubDoc {
  @Prop({ default: '' })
  username: string;

  @Prop({ default: '' })
  passwordEncrypted: string;

  @Prop({ default: '' })
  pinEncrypted: string;
}

export class OutlookConfigSubDoc {
  @Prop({ default: 'clearing.acc@mxv.vn' })
  targetMailbox: string;

  @Prop({ default: '' })
  refreshToken: string;

  @Prop({ default: '' })
  clientId: string;

  @Prop({ default: '' })
  tenantId: string;

  @Prop({ default: '' })
  clientSecret: string;
}

export class StorageConfigSubDoc {
  @Prop({ default: 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD' })
  windowsPath: string;

  @Prop({ default: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD' })
  linuxPath: string;

  @Prop({ default: '' })
  templatePath: string;
}

export class PreferencesSubDoc {
  @Prop({ default: true })
  autoHighlightExcel: boolean;

  @Prop({ default: true })
  saveToAtlas: boolean;
}

@Schema({ timestamps: true, collection: 'tkgd_user_configs' })
export class TkgdUserConfig {
  @Prop({ required: true, unique: true, index: true })
  userEmail: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ default: 'Thanh toán bù trừ' })
  department: string;

  @Prop({ type: MSystemCredentialsSubDoc, default: () => ({}) })
  msystem: MSystemCredentialsSubDoc;

  @Prop({ type: OutlookConfigSubDoc, default: () => ({}) })
  outlook: OutlookConfigSubDoc;

  @Prop({ type: StorageConfigSubDoc, default: () => ({}) })
  storage: StorageConfigSubDoc;

  @Prop({ type: PreferencesSubDoc, default: () => ({}) })
  preferences: PreferencesSubDoc;

  @Prop({ default: true })
  isActive: boolean;
}

export const TkgdUserConfigSchema = SchemaFactory.createForClass(TkgdUserConfig);
