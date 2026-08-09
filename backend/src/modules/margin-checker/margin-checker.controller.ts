import {
  Controller,
  Post,
  Get,
  Body,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MarginCheckerService } from './margin-checker.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['margin-checker', 'api/v1/margin-checker'])
export class MarginCheckerController {
  constructor(private readonly service: MarginCheckerService) {}

  @Get('config')
  @Permissions('ACCESS_MARGIN_CHANGE')
  async getConfig(@Req() req: any) {
    const config = await this.service.loadConfig();
    if (req.user?.role !== 'ADMIN') {
      if (config.smtp) {
        config.smtp.pass = '********'; // Mask password for non-admins
      }
    }
    return config;
  }

  @Post('config')
  @Permissions('ACCESS_MARGIN_CHANGE')
  async saveConfig(@Req() req: any, @Body() config: any) {
    const oldConfig = await this.service.loadConfig();
    
    // Prevent non-admins from altering SMTP configuration
    if (req.user?.role !== 'ADMIN') {
      config.smtp = oldConfig.smtp;
    } else {
      // If admin submitted masked password, preserve the original password
      if (config.smtp && config.smtp.pass === '********') {
        config.smtp.pass = oldConfig.smtp?.pass;
      }
    }
    return this.service.saveConfig(config);
  }

  @Post('check-margin')
  @Permissions('ACCESS_MARGIN_CHANGE')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'futures', maxCount: 1 },
      { name: 'lme', maxCount: 1 },
      { name: 'acm', maxCount: 1 },
      { name: 'options', maxCount: 1 },
      { name: 'market', maxCount: 1 },
      { name: 'commodityConfig', maxCount: 1 },
    ]),
  )
  async checkMargin(
    @UploadedFiles()
    files: {
      futures?: any[];
      lme?: any[];
      acm?: any[];
      options?: any[];
      market?: any[];
      commodityConfig?: any[];
    },
  ) {
    const futures = files.futures?.[0]?.buffer;
    const lme = files.lme?.[0]?.buffer;
    const acm = files.acm?.[0]?.buffer;
    const options = files.options?.[0]?.buffer;
    const market = files.market?.[0]?.buffer;
    const commodityConfig = files.commodityConfig?.[0]?.buffer;

    if (!futures || !lme || !acm || !market) {
      throw new BadRequestException(
        'Thiếu các file bắt buộc: DSHHFutures, DSHHLME, DSHHACM hoặc MarketData',
      );
    }

    return this.service.checkMargin({
      futures,
      lme,
      acm,
      options,
      market,
      commodityConfig,
    });
  }

  @Post('check-change')
  @Permissions('ACCESS_MARGIN_CHANGE')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'cmeExcel', maxCount: 1 },
      { name: 'cmePdf', maxCount: 1 },
      { name: 'iceEUAg', maxCount: 1 },
      { name: 'iceSG', maxCount: 1 },
      { name: 'iceUS', maxCount: 1 },
      { name: 'bursaPdf', maxCount: 1 },
      { name: 'sgxExcel', maxCount: 1 },
      { name: 'jpxExcel', maxCount: 1 },
      { name: 'lmeExcel', maxCount: 1 },
      { name: 'futures', maxCount: 1 },
      { name: 'lmeMargin', maxCount: 1 },
      { name: 'options', maxCount: 1 },
      { name: 'commodityConfig', maxCount: 1 },
    ]),
  )
  async checkMarginChange(
    @UploadedFiles()
    files: {
      cmeExcel?: any[];
      cmePdf?: any[];
      iceEUAg?: any[];
      iceSG?: any[];
      iceUS?: any[];
      bursaPdf?: any[];
      sgxExcel?: any[];
      jpxExcel?: any[];
      lmeExcel?: any[];
      futures?: any[];
      lmeMargin?: any[];
      options?: any[];
      commodityConfig?: any[];
    },
  ) {
    const cmeExcel = files.cmeExcel?.[0]?.buffer;
    const cmePdf = files.cmePdf?.[0]?.buffer;
    const iceEUAg = files.iceEUAg?.[0]?.buffer;
    const iceSG = files.iceSG?.[0]?.buffer;
    const iceUS = files.iceUS?.[0]?.buffer;
    const bursaPdf = files.bursaPdf?.[0]?.buffer;
    const sgxExcel = files.sgxExcel?.[0]?.buffer;
    const jpxExcel = files.jpxExcel?.[0]?.buffer;
    const lmeExcel = files.lmeExcel?.[0]?.buffer;
    const futures = files.futures?.[0]?.buffer;
    const lmeMargin = files.lmeMargin?.[0]?.buffer;
    const options = files.options?.[0]?.buffer;
    const commodityConfig = files.commodityConfig?.[0]?.buffer;

    return this.service.checkMarginChange({
      cmeExcel,
      cmePdf,
      iceEUAg,
      iceSG,
      iceUS,
      bursaPdf,
      sgxExcel,
      jpxExcel,
      lmeExcel,
      futures,
      lmeMargin,
      options,
      commodityConfig,
    });
  }
}
