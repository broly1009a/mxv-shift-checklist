import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { MsActivitiesManualService } from '../services/ms-activities-manual.service';

@Controller('api/v1/ingress')
@UseGuards(JwtAuthGuard)
export class MsActivitiesManualController {
  private readonly logger = new Logger(MsActivitiesManualController.name);

  constructor(
    private readonly manualService: MsActivitiesManualService,
  ) {}

  /**
   * Truy vấn danh sách nhật ký thao tác M-System có phân trang, hỗ trợ tìm kiếm và lọc ngày
   */
  @Get('ms-activities')
  async getActivities(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    try {
      const result = await this.manualService.getActivities({
        startDate,
        endDate,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        search,
      });
      return {
        success: true,
        data: result.items,
        pagination: result.pagination,
        filter: result.filter,
      };
    } catch (err: any) {
      this.logger.error(`Lỗi truy vấn ms-activities: ${err.message}`);
      throw new HttpException(
        {
          success: false,
          message: err.message || 'Không thể lấy dữ liệu nhật ký thao tác từ M-System',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Xuất toàn bộ danh sách thao tác thành file Excel NKTTHT.xlsx chuẩn 100%
   */
  @Get('ms-activities/export-excel')
  async exportActivitiesExcel(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('saveToBackup') saveToBackup?: string,
  ) {
    try {
      const isSaveToBackup = saveToBackup === 'true' || saveToBackup === '1';
      await this.manualService.exportActivitiesToExcel(
        {
          startDate,
          endDate,
          search,
          saveToBackup: isSaveToBackup,
        },
        res,
      );
    } catch (err: any) {
      this.logger.error(`Lỗi xuất Excel ms-activities: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: err.message || 'Không thể xuất file Excel NKTTHT từ M-System',
        });
      }
    }
  }

  /**
   * Kích hoạt lưu file NKTTHT.xlsx trực tiếp vào thư mục Backup M-System của ca trực
   */
  @Post('ms-activities/sync-to-backup')
  async syncToBackup(
    @Query('sessionDate') sessionDate?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const dateToUse = sessionDate || endDate || startDate;
      const res = await this.manualService.exportActivitiesToExcel({
        startDate: startDate || dateToUse,
        endDate: endDate || dateToUse,
        saveToBackup: true,
      });

      return {
        success: true,
        message: `Đã kết xuất và lưu thành công ${res.totalRows} dòng vào ${res.savedBackupPath || 'thư mục Backup M-System'}`,
        fileName: res.fileName,
        totalRows: res.totalRows,
        savedBackupPath: res.savedBackupPath,
      };
    } catch (err: any) {
      this.logger.error(`Lỗi đồng bộ NKTTHT vào backup: ${err.message}`);
      throw new HttpException(
        {
          success: false,
          message: err.message || 'Lỗi lưu NKTTHT vào thư mục Backup ca trực',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
