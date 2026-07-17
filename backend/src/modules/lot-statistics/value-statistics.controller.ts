import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ValueStatisticsService } from './value-statistics.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Controller('value-statistics')
export class ValueStatisticsController {
  private readonly logger = new Logger(ValueStatisticsController.name);

  constructor(
    private readonly valueStatisticsService: ValueStatisticsService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  @Get('config')
  async getConfig() {
    const macroPath = await this.settingsService.getSetting(
      'bot_macro_value_path',
      '',
    );
    const targetRoot = await this.settingsService.getSetting(
      'bot_lot_macro_target_root',
      'M:\\Quanlygiaodich\\Tai lieu hoat dong',
    );
    return {
      defaultMacroPath: macroPath,
      defaultTargetRoot: targetRoot,
    };
  }

  @Put('config')
  async saveConfig(@Body() config: { macroPath?: string; targetRoot?: string }) {
    if (config.macroPath !== undefined) {
      await this.settingsService.setSetting('bot_macro_value_path', config.macroPath);
    }
    if (config.targetRoot !== undefined) {
      await this.settingsService.setSetting('bot_lot_macro_target_root', config.targetRoot);
    }
    return { success: true };
  }

  @Post('process-local')
  async processLocal(
    @Body('ngayGD') ngayGD: string,
    @Body('macroPath') macroPath: string,
    @Body('targetRoot') targetRoot: string,
    @Body('dsgdPath') dsgdPath: string,
    @Body('updateCumulative') updateCumulative: any,
    @Body('pathNormal') pathNormal: string,
    @Body('pathAcm') pathAcm: string,
    @Body('pathLme') pathLme: string,
    @Body('pathOptions') pathOptions: string,
    @Body('pathSpread') pathSpread: string,
  ) {
    if (!ngayGD) {
      throw new HttpException(
        'Thiếu ngày giao dịch (ngayGD). Format: YYYY-MM-DD.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (isNaN(new Date(ngayGD).getTime())) {
      throw new HttpException(
        `Ngày giao dịch không hợp lệ: "${ngayGD}". Format: YYYY-MM-DD.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const payload: any = {
        macroPath: macroPath || undefined,
        targetRoot: targetRoot || undefined,
        dsgdPath: dsgdPath || undefined,
        updateCumulative: updateCumulative === true || updateCumulative === 'true',
        pathNormal: pathNormal || undefined,
        pathAcm: pathAcm || undefined,
        pathLme: pathLme || undefined,
        pathOptions: pathOptions || undefined,
        pathSpread: pathSpread || undefined,
      };

      const result = await this.valueStatisticsService.processValueStatistics(
        new Date(ngayGD),
        payload,
      );
      return result;
    } catch (err) {
      this.logger.error(`Lỗi xử lý value statistics cho ngày "${ngayGD}"`, err?.stack);
      throw new HttpException(
        err?.message ?? 'Lỗi xử lý thống kê giá trị',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
