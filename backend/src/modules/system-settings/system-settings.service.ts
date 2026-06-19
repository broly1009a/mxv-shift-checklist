import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSetting } from '../../schemas/system-setting.schema';

@Injectable()
export class SystemSettingsService {
  constructor(
    @InjectModel(SystemSetting.name) private readonly systemSettingModel: Model<SystemSetting>,
  ) {}

  async getSetting(key: string, defaultValue: string = ''): Promise<string> {
    const setting = await this.systemSettingModel.findOne({ key }).exec();
    return setting ? setting.value : defaultValue;
  }

  async setSetting(key: string, value: string): Promise<SystemSetting> {
    let setting = await this.systemSettingModel.findOne({ key }).exec();
    if (setting) {
      setting.value = value;
      return setting.save();
    } else {
      setting = new this.systemSettingModel({ key, value });
      return setting.save();
    }
  }

  async findAll(): Promise<SystemSetting[]> {
    return this.systemSettingModel.find().exec();
  }
}
