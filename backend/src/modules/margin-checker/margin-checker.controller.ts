import {
  Controller,
  Post,
  Get,
  Body,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MarginCheckerService } from './margin-checker.service';

@Controller('margin-checker')
export class MarginCheckerController {
  constructor(private readonly service: MarginCheckerService) {}

  @Get('config')
  async getConfig() {
    return this.service.loadConfig();
  }

  @Post('config')
  async saveConfig(@Body() config: any) {
    return this.service.saveConfig(config);
  }

  @Post('check-margin')
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
