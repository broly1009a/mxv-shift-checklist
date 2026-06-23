import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationChannel } from '../../schemas/notification-channel.schema';
import { NotificationRule } from '../../schemas/notification-rule.schema';
import { NotificationLog } from '../../schemas/notification-log.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(NotificationChannel.name)
    private readonly channelModel: Model<NotificationChannel>,
    @InjectModel(NotificationRule.name)
    private readonly ruleModel: Model<NotificationRule>,
    @InjectModel(NotificationLog.name)
    private readonly logModel: Model<NotificationLog>,
  ) {}

  // =========================================================================
  // Channels CRUD
  // =========================================================================
  async getChannels(): Promise<NotificationChannel[]> {
    return this.channelModel.find().exec();
  }

  async getChannelById(id: string): Promise<NotificationChannel> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID kênh không hợp lệ');
    }
    const channel = await this.channelModel.findById(id).exec();
    if (!channel) throw new NotFoundException('Không tìm thấy kênh cấu hình');
    return channel;
  }

  async createChannel(data: any): Promise<NotificationChannel> {
    const existing = await this.channelModel.findOne({ code: data.code }).exec();
    if (existing) {
      throw new BadRequestException(`Mã kênh '${data.code}' đã tồn tại`);
    }
    const newChannel = new this.channelModel(data);
    return newChannel.save();
  }

  async updateChannel(id: string, data: any): Promise<NotificationChannel> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID kênh không hợp lệ');
    }
    const updated = await this.channelModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy kênh cấu hình');
    return updated;
  }

  async deleteChannel(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID kênh không hợp lệ');
    }
    const result = await this.channelModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Không tìm thấy kênh cấu hình');
    return { success: true };
  }

  // =========================================================================
  // Rules CRUD
  // =========================================================================
  async getRules(): Promise<NotificationRule[]> {
    return this.ruleModel
      .find()
      .populate('departmentId')
      .populate('shiftSlotId')
      .populate('channelIds')
      .exec();
  }

  async getRuleById(id: string): Promise<NotificationRule> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID luật cấu hình không hợp lệ');
    }
    const rule = await this.ruleModel
      .findById(id)
      .populate('departmentId')
      .populate('shiftSlotId')
      .populate('channelIds')
      .exec();
    if (!rule) throw new NotFoundException('Không tìm thấy luật cấu hình');
    return rule;
  }

  async createRule(data: any): Promise<NotificationRule> {
    const existing = await this.ruleModel.findOne({ code: data.code }).exec();
    if (existing) {
      throw new BadRequestException(`Mã luật '${data.code}' đã tồn tại`);
    }
    
    // Validate channel IDs
    if (data.channelIds && data.channelIds.length > 0) {
      for (const chId of data.channelIds) {
        if (!Types.ObjectId.isValid(chId)) {
          throw new BadRequestException(`ID kênh '${chId}' không hợp lệ`);
        }
        const chExists = await this.channelModel.findById(chId).exec();
        if (!chExists) {
          throw new NotFoundException(`Kênh với ID '${chId}' không tồn tại`);
        }
      }
    }

    const newRule = new this.ruleModel(data);
    return newRule.save();
  }

  async updateRule(id: string, data: any): Promise<NotificationRule> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID luật cấu hình không hợp lệ');
    }
    const updated = await this.ruleModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy luật cấu hình');
    return updated;
  }

  async deleteRule(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID luật cấu hình không hợp lệ');
    }
    const result = await this.ruleModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Không tìm thấy luật cấu hình');
    return { success: true };
  }

  // =========================================================================
  // Logs & Dry-run test
  // =========================================================================
  async getLogs(limit = 100): Promise<NotificationLog[]> {
    return this.logModel
      .find()
      .populate('channelId')
      .populate('ruleId')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async triggerTestNotification(data: {
    eventType: string;
    ruleId?: string;
    recipient: string;
    payload?: Record<string, any>;
  }): Promise<NotificationLog> {
    let rule: NotificationRule | null = null;
    if (data.ruleId) {
      if (Types.ObjectId.isValid(data.ruleId)) {
        rule = await this.ruleModel.findById(data.ruleId).exec();
      }
    }

    // Determine channels
    const channels = rule ? rule.channelIds : [];
    const channelId = channels.length > 0 ? channels[0] : null;
    let channelType = 'EMAIL'; // Default fallback

    if (channelId) {
      const channel = await this.channelModel.findById(channelId).exec();
      if (channel) {
        channelType = channel.type;
      }
    }

    const newLog = new this.logModel({
      eventType: data.eventType,
      channelType,
      channelId: channelId ? new Types.ObjectId(channelId.toString()) : null,
      ruleId: rule ? rule._id : null,
      recipient: data.recipient,
      status: 'SENT', // Mark as SENT since it's a successful mock transmission
      payload: data.payload || {},
      sentAt: new Date(),
    });

    return newLog.save();
  }
}
