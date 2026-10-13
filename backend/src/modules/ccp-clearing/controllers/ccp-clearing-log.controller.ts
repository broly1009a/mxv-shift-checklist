import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CcpClearingLog } from '../schemas/ccp-clearing-log.schema';

@Controller('api/v1/ccp-clearing/logs')
export class CcpClearingLogController {
  constructor(
    @InjectModel(CcpClearingLog.name)
    private readonly ccpLogModel: Model<CcpClearingLog>,
  ) {}

  @Get(':id')
  async getById(@Param('id') id: string) {
    const log = await this.ccpLogModel.findById(id).lean().exec();
    if (!log) {
      throw new NotFoundException(`Không tìm thấy nhật ký bù trừ CCP ID: ${id}`);
    }
    return {
      success: true,
      data: log,
    };
  }

  @Get('by-date/:tradingDate')
  async getByDate(@Param('tradingDate') tradingDate: string) {
    const logs = await this.ccpLogModel
      .find({ tradingDate })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return {
      success: true,
      count: logs.length,
      data: logs,
    };
  }
}
