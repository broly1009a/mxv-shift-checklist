import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';

@Controller('api/v1/trading-ops/recon-logs')
export class TradingReconLogController {
  constructor(
    @InjectModel(TradingReconLog.name)
    private readonly reconLogModel: Model<TradingReconLog>,
  ) {}

  @Get(':id')
  async getById(@Param('id') id: string) {
    const log = await this.reconLogModel.findById(id).lean().exec();
    if (!log) {
      throw new NotFoundException(`Không tìm thấy nhật ký đối soát ID: ${id}`);
    }
    return {
      success: true,
      data: log,
    };
  }

  @Get('by-date/:tradingDate')
  async getByDate(@Param('tradingDate') tradingDate: string) {
    const logs = await this.reconLogModel
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
