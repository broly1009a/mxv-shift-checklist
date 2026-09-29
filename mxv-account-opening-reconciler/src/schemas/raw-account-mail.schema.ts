import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type RawAccountMailDocument = RawAccountMail & Document;

@Schema({ _id: false })
export class AttachmentMeta {
  @Prop({ required: true })
  name: string;

  @Prop()
  contentType?: string;

  @Prop()
  size?: number;

  @Prop()
  storagePath?: string;

  @Prop({ enum: ['hop_dong', 'pl01', 'cccd_truoc', 'cccd_sau', 'other'], default: 'other' })
  fileType: string;
}

export const AttachmentMetaSchema = SchemaFactory.createForClass(AttachmentMeta);

@Schema({ timestamps: true, collection: 'raw_account_mails' })
export class RawAccountMail {
  @Prop({ unique: true, index: true, required: true })
  messageId: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true, index: true })
  senderEmail: string;

  @Prop()
  senderName?: string;

  @Prop({ required: true, index: true })
  receivedDateTime: Date;

  @Prop({ required: true })
  bodyRawText: string;

  @Prop()
  bodyHtml?: string;

  @Prop({ type: [AttachmentMetaSchema], default: [] })
  attachments: AttachmentMeta[];

  @Prop({
    enum: ['PENDING', 'PARSED', 'RECONCILED', 'FAILED'],
    default: 'PENDING',
    index: true,
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  rawHeaders?: any;
}

export const RawAccountMailSchema = SchemaFactory.createForClass(RawAccountMail);
