import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ValueStatisticsService } from './value-statistics.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('value-statistics')
export class ValueStatisticsController {
  private readonly logger = new Logger(ValueStatisticsController.name);

  constructor(
    private readonly valueStatisticsService: ValueStatisticsService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  @Get('config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getConfig() {
    const macroPath = await this.settingsService.getSetting(
      'bot_macro_value_path',
      '',
    );
    const targetRoot = await this.settingsService.getSetting(
      'bot_lot_macro_target_root',
      'M:\\Quanlygiaodich\\Tai lieu hoat dong',
    );
    const updateCumulative = await this.settingsService.getSetting(
      'bot_lot_macro_update_cumulative',
      'false',
    );
    const pathNormal = await this.settingsService.getSetting(
      'bot_lot_macro_path_normal',
      '',
    );
    const pathAcm = await this.settingsService.getSetting(
      'bot_lot_macro_path_acm',
      '',
    );
    const pathLme = await this.settingsService.getSetting(
      'bot_lot_macro_path_lme',
      '',
    );
    const pathOptions = await this.settingsService.getSetting(
      'bot_lot_macro_path_options',
      '',
    );
    const pathSpread = await this.settingsService.getSetting(
      'bot_lot_macro_path_spread',
      '',
    );
    const pathTvkd = await this.settingsService.getSetting(
      'bot_lot_macro_path_tvkd',
      '',
    );

    return {
      defaultMacroPath: macroPath,
      defaultTargetRoot: targetRoot,
      updateCumulative: updateCumulative === 'true',
      pathNormal,
      pathAcm,
      pathLme,
      pathOptions,
      pathSpread,
      pathTvkd,
    };
  }

  @Put('config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async saveConfig(
    @Body()
    config: {
      macroPath?: string;
      targetRoot?: string;
      updateCumulative?: boolean;
      pathNormal?: string;
      pathAcm?: string;
      pathLme?: string;
      pathOptions?: string;
      pathSpread?: string;
      pathTvkd?: string;
    },
  ) {
    if (config.macroPath !== undefined) {
      await this.settingsService.setSetting(
        'bot_macro_value_path',
        config.macroPath,
      );
    }
    if (config.targetRoot !== undefined) {
      await this.settingsService.setSetting(
        'bot_lot_macro_target_root',
        config.targetRoot,
      );
    }
    if (config.updateCumulative !== undefined) {
      await this.settingsService.setSetting(
        'bot_lot_macro_update_cumulative',
        String(config.updateCumulative),
      );
    }
    if (config.pathNormal !== undefined) {
      await this.settingsService.setSetting(
        'bot_lot_macro_path_normal',
        config.pathNormal,
      );
    }
    if (config.pathAcm !== undefined) {
      await this.settingsService.setSetting(
        'bot_lot_macro_path_acm',
        config.pathAcm,
      );
    }
    if (config.pathLme !== undefined) {
      await this.settingsService.setSetting(
        'bot_lot_macro_path_lme',
        config.pathLme,
      );
    }
    if (config.pathOptions !== undefined) {
      await this.settingsService.setSetting(
        'bot_lot_macro_path_options',
        config.pathOptions,
      );
    }
    if (config.pathSpread !== undefined) {
      await this.settingsService.setSetting(
        'bot_lot_macro_path_spread',
        config.pathSpread,
      );
    }
    if (config.pathTvkd !== undefined) {
      await this.settingsService.setSetting(
        'bot_lot_macro_path_tvkd',
        config.pathTvkd,
      );
    }
    return { success: true };
  }

  @Post('process-local')
  @Permissions('ACCESS_AUTO_SHIFT')
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
    @Body('pathTvkd') pathTvkd: string,
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
        updateCumulative:
          updateCumulative === true || updateCumulative === 'true',
        pathNormal: pathNormal || undefined,
        pathAcm: pathAcm || undefined,
        pathLme: pathLme || undefined,
        pathOptions: pathOptions || undefined,
        pathSpread: pathSpread || undefined,
        pathTvkd: pathTvkd || undefined,
      };

      const result = await this.valueStatisticsService.processValueStatistics(
        new Date(ngayGD),
        payload,
      );
      return result;
    } catch (err) {
      this.logger.error(
        `Lỗi xử lý value statistics cho ngày "${ngayGD}"`,
        err?.stack,
      );
      throw new HttpException(
        err?.message ?? 'Lỗi xử lý thống kê giá trị',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('process-tvkd-only')
  @Permissions('ACCESS_AUTO_SHIFT')
  async processTvkdOnly(
    @Body('ngayGD') ngayGD: string,
    @Body('targetRoot') targetRoot: string,
    @Body('dsgdPath') dsgdPath: string,
    @Body('pathTvkd') pathTvkd: string,
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
      const result = await this.valueStatisticsService.processTvkdOnly(
        new Date(ngayGD),
        { targetRoot, dsgdPath, pathTvkd }
      );
      return result;
    } catch (err) {
      this.logger.error(
        `Lỗi xử lý cập nhật riêng TVKD lũy kế cho ngày "${ngayGD}"`,
        err?.stack,
      );
      throw new HttpException(
        err?.message ?? 'Lỗi cập nhật riêng TVKD lũy kế',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
