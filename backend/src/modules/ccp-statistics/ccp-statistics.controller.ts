import {
  Controller,
  Post,
  Get,
  Body,
  UseInterceptors,
  UploadedFiles,
  Res,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as express from 'express';
import * as fs from 'fs';
import { CcpStatisticsService } from './ccp-statistics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ccp-statistics')
export class CcpStatisticsController {
  constructor(private readonly ccpStatisticsService: CcpStatisticsService) {}

  @Get('config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getConfig() {
    return this.ccpStatisticsService.getConfig();
  }

  @Post('config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async saveConfig(@Body() config: any) {
    return this.ccpStatisticsService.saveConfig(config);
  }

  @Post('process')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgdCcp', maxCount: 1 },
      { name: 'dsgdMmCcp', maxCount: 1 },
      { name: 'dstkgd', maxCount: 1 },
      { name: 'nr', maxCount: 1 },
      { name: 'ttm', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
    ]),
  )
  async processCcp(
    @UploadedFiles()
    files: {
      dsgdCcp?: any[];
      dsgdMmCcp?: any[];
      dstkgd?: any[];
      nr?: any[];
      ttm?: any[];
      tttt?: any[];
    },
    @Body('date') dateStr: string,
    @Res() res: express.Response,
  ) {
    if (
      !files.dsgdCcp?.[0] ||
      !files.dsgdMmCcp?.[0] ||
      !files.dstkgd?.[0] ||
      !files.nr?.[0] ||
      !files.ttm?.[0] ||
      !files.tttt?.[0]
    ) {
      throw new HttpException(
        'Vui lòng tải lên đầy đủ 6 file Excel (DSGD CCP, DSGD MM CCP, DSTKGD, NR, TTM, TTTT).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const selectedDate = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(selectedDate.getTime())) {
      throw new HttpException(
        'Ngày chọn không hợp lệ.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const outputPath = await this.ccpStatisticsService.processCcpData(
        {
          dsgdCcp: files.dsgdCcp[0].buffer,
          dsgdMmCcp: files.dsgdMmCcp[0].buffer,
          dstkgd: files.dstkgd[0].buffer,
          nr: files.nr[0].buffer,
          ttm: files.ttm[0].buffer,
          tttt: files.tttt[0].buffer,
        },
        selectedDate,
      );

      if (!fs.existsSync(outputPath)) {
        throw new HttpException(
          'Không tìm thấy file kết quả.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      res.set({
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="Thong_ke_kich_ban_Pilot_Bac_Final.xlsx"',
      });

      const stream = fs.createReadStream(outputPath);
      stream.pipe(res);
    } catch (err) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
