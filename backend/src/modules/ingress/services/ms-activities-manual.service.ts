import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { MsApiAdapter } from '../adapters/ms-api.adapter';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  getMsBackupBase,
  resolveDailySubfolder,
  resolveStoragePathCrossPlatform,
  resolveTradingSessionDate,
} from '../../../shared/helpers/file-path.helper';

export interface IMsActivityItem {
  _id: string;
  memberCode?: string;
  memberName?: string;
  username: string;
  ipAddress?: string;
  action: string;
  datetime: number;
  description?: string;
  sessionDate?: string;
  note?: string;
}

export interface IMsActivitiesQueryResult {
  items: IMsActivityItem[];
  pagination: {
    page: number;
    limit: number;
    totalRows: number;
    totalPages: number;
  };
  filter: {
    startDate: string;
    endDate: string;
    startMs: number;
    endMs: number;
  };
}

@Injectable()
export class MsActivitiesManualService {
  private readonly logger = new Logger(MsActivitiesManualService.name);

  constructor(
    private readonly msApiAdapter: MsApiAdapter,
    private readonly settingsService: SystemSettingsService,
  ) {}

  /**
   * Chuyển đổi ngày (YYYY-MM-DD hoặc DD/MM/YYYY hoặc DD.MM.YYYY) sang Epoch Milliseconds múi giờ VN (UTC+7)
   */
  public parseVnDateRange(
    startDateStr?: string,
    endDateStr?: string,
  ): { startMs: number; endMs: number; resolvedStart: string; resolvedEnd: string } {
    const today = new Date();
    // Chuyển sang ngày theo giờ VN
    const vnNow = new Date(today.getTime() + 7 * 60 * 60 * 1000);
    const defaultY = vnNow.getUTCFullYear();
    const defaultM = vnNow.getUTCMonth() + 1;
    const defaultD = vnNow.getUTCDate();
    const defaultDateStr = `${defaultY}-${String(defaultM).padStart(2, '0')}-${String(defaultD).padStart(2, '0')}`;

    const parseSingle = (dStr?: string): { y: number; m: number; d: number; formatted: string } => {
      if (!dStr) {
        return {
          y: defaultY,
          m: defaultM,
          d: defaultD,
          formatted: defaultDateStr,
        };
      }
      const s = dStr.trim();
      let y = defaultY;
      let m = defaultM;
      let d = defaultD;

      if (s.includes('-')) {
        const parts = s.split('-').map(Number);
        if (parts.length === 3) {
          if (parts[0] > 1000) {
            [y, m, d] = parts;
          } else {
            [d, m, y] = parts;
          }
        }
      } else if (s.includes('/')) {
        const parts = s.split('/').map(Number);
        if (parts.length === 3) {
          if (parts[2] > 1000) {
            [d, m, y] = parts;
          } else {
            [y, m, d] = parts;
          }
        }
      } else if (s.includes('.')) {
        const parts = s.split('.').map(Number);
        if (parts.length === 3) {
          if (parts[2] > 1000) {
            [d, m, y] = parts;
          } else {
            [y, m, d] = parts;
          }
        }
      }

      const formatted = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { y, m, d, formatted };
    };

    const parsedStart = parseSingle(startDateStr);
    const parsedEnd = parseSingle(endDateStr || startDateStr);

    // Bắt đầu ngày 00:00:00 VN (UTC+7 tương đương UTC - 7 giờ)
    const startMs = Date.UTC(parsedStart.y, parsedStart.m - 1, parsedStart.d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000;
    // Kết thúc ngày 23:59:59.999 VN
    const endMs = Date.UTC(parsedEnd.y, parsedEnd.m - 1, parsedEnd.d, 0, 0, 0, 0) - 7 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000 - 1;

    return {
      startMs,
      endMs,
      resolvedStart: parsedStart.formatted,
      resolvedEnd: parsedEnd.formatted,
    };
  }

  /**
   * Format epoch timestamp sang chuỗi DD/MM/YYYY HH:mm:ss theo múi giờ Việt Nam (UTC+7)
   */
  public formatVietnamDateTime(epochMs?: number): string {
    if (!epochMs) return '';
    const d = new Date(epochMs);
    if (isNaN(d.getTime())) return '';
    const vnDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    const day = String(vnDate.getUTCDate()).padStart(2, '0');
    const month = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
    const year = vnDate.getUTCFullYear();
    const hours = String(vnDate.getUTCHours()).padStart(2, '0');
    const mins = String(vnDate.getUTCMinutes()).padStart(2, '0');
    const secs = String(vnDate.getUTCSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
  }

  /**
   * Gọi API M-System lấy danh sách nhật ký thao tác có phân trang
   */
  public async getActivities(params: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<IMsActivitiesQueryResult> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const { startMs, endMs, resolvedStart, resolvedEnd } = this.parseVnDateRange(
      params.startDate,
      params.endDate,
    );

    const session = await this.msApiAdapter.getValidToken();
    let token = session.token;
    const baseUrl = session.baseUrl;
    const adminUrl = session.adminUrl;

    const url = `${baseUrl}/approval/admin/activities?limit=${limit}&offset=${offset}&sort_by=desc(datetime)&sessionDate[gte]=${startMs}&sessionDate[lte]=${endMs}`;

    const headers: Record<string, string> = {
      accept: 'application/json, text/plain, */*',
      authorization: `Bearer ${token}`,
      origin: adminUrl,
      referer: `${adminUrl}/`,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    let res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000),
    });

    // Tự động làm mới Token khi M-System từ chối (401 Invalid accessToken) và thử lại
    if (res.status === 401) {
      this.logger.warn(`[MsActivitiesManual] Token bị từ chối 401 trong getActivities, đang tự động đăng nhập làm mới...`);
      const fresh = await this.msApiAdapter.getValidToken(true);
      token = fresh.token;
      headers.authorization = `Bearer ${token}`;
      res = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(30000),
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`M-System API returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = await res.json();
    if (json.status !== 'ok') {
      throw new Error(json.errMsg || json.message || 'Lỗi không xác định từ M-System API');
    }

    let items: IMsActivityItem[] = Array.isArray(json.data) ? json.data : [];

    // Lọc tìm kiếm nếu có
    if (params.search && params.search.trim()) {
      const kw = params.search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          (i.username && i.username.toLowerCase().includes(kw)) ||
          (i.action && i.action.toLowerCase().includes(kw)) ||
          (i.description && i.description.toLowerCase().includes(kw)) ||
          (i.ipAddress && i.ipAddress.toLowerCase().includes(kw)) ||
          (i.memberCode && i.memberCode.toLowerCase().includes(kw)),
      );
    }

    const totalRows = json.pagination?.totalRows ?? items.length;
    const totalPages = Math.ceil(totalRows / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        totalRows,
        totalPages,
      },
      filter: {
        startDate: resolvedStart,
        endDate: resolvedEnd,
        startMs,
        endMs,
      },
    };
  }

  /**
   * Kéo toàn bộ dữ liệu theo khoảng ngày (phân trang tuần tự) và xuất file Excel NKTTHT.xlsx chuẩn 100%
   */
  public async exportActivitiesToExcel(
    params: {
      startDate?: string;
      endDate?: string;
      search?: string;
      saveToBackup?: boolean;
    },
    res?: Response,
  ): Promise<{ buffer: Buffer; fileName: string; totalRows: number; savedBackupPath?: string }> {
    const { startMs, endMs, resolvedStart, resolvedEnd } = this.parseVnDateRange(
      params.startDate,
      params.endDate,
    );

    const session = await this.msApiAdapter.getValidToken();
    let token = session.token;
    const baseUrl = session.baseUrl;
    const adminUrl = session.adminUrl;

    const batchLimit = 50; // Kéo an toàn 50 dòng/lần tránh quá tải M-System
    let offset = 0;
    let allItems: IMsActivityItem[] = [];
    let totalRows = 0;
    const startTime = Date.now();

    this.logger.log(
      `[MsActivitiesManual] Bắt đầu quét kéo toàn bộ dữ liệu NKTTHT từ ${resolvedStart} đến ${resolvedEnd} (gte=${startMs}, lte=${endMs})...`,
    );

    while (true) {
      const url = `${baseUrl}/approval/admin/activities?limit=${batchLimit}&offset=${offset}&sort_by=desc(datetime)&sessionDate[gte]=${startMs}&sessionDate[lte]=${endMs}`;

      let fetchRes = await fetch(url, {
        method: 'GET',
        headers: {
          accept: 'application/json, text/plain, */*',
          authorization: `Bearer ${token}`,
          origin: adminUrl,
          referer: `${adminUrl}/`,
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (fetchRes.status === 401) {
        this.logger.warn(`[MsActivitiesManual] Token hết hạn trong khi fetch, đang làm mới...`);
        const fresh = await this.msApiAdapter.getValidToken(true);
        token = fresh.token;
        fetchRes = await fetch(url, {
          method: 'GET',
          headers: {
            accept: 'application/json, text/plain, */*',
            authorization: `Bearer ${token}`,
            origin: adminUrl,
            referer: `${adminUrl}/`,
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          signal: AbortSignal.timeout(30000),
        });
      }

      if (!fetchRes.ok) {
        const txt = await fetchRes.text().catch(() => '');
        throw new Error(`Lỗi tải dữ liệu từ M-System (HTTP ${fetchRes.status}): ${txt.slice(0, 200)}`);
      }

      const json = await fetchRes.json();
      if (json.status !== 'ok') {
        throw new Error(json.errMsg || json.message || 'Lỗi không xác định từ M-System');
      }

      const batchItems: IMsActivityItem[] = Array.isArray(json.data) ? json.data : [];
      if (batchItems.length === 0) {
        break;
      }

      allItems.push(...batchItems);
      totalRows = json.pagination?.totalRows ?? allItems.length;

      offset += batchItems.length;
      if (offset >= totalRows || batchItems.length < batchLimit) {
        break;
      }

      // Giới hạn an toàn chống lặp vô hạn
      if (allItems.length >= 100000) {
        this.logger.warn(`[MsActivitiesManual] Đã đạt ngưỡng an toàn 100.000 dòng, dừng kéo tiếp.`);
        break;
      }
    }

    // Lọc từ khóa nếu người dùng yêu cầu
    if (params.search && params.search.trim()) {
      const kw = params.search.trim().toLowerCase();
      allItems = allItems.filter(
        (i) =>
          (i.username && i.username.toLowerCase().includes(kw)) ||
          (i.action && i.action.toLowerCase().includes(kw)) ||
          (i.description && i.description.toLowerCase().includes(kw)) ||
          (i.ipAddress && i.ipAddress.toLowerCase().includes(kw)) ||
          (i.memberCode && i.memberCode.toLowerCase().includes(kw)),
      );
    }

    this.logger.log(
      `[MsActivitiesManual] Hoàn tất kéo ${allItems.length} dòng dữ liệu NKTTHT trong ${Date.now() - startTime}ms. Đang sinh file Excel...`,
    );

    // Sinh file Excel chuẩn bằng ExcelJS
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MXV Shift System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('NKTTHT', {
      views: [{ showGridLines: true }],
    });

    // Định nghĩa các cột theo đúng chuẩn Ground Truth người dùng yêu cầu:
    // STT | Người thực hiện | Thao tác | Mô tả | Thời gian thực hiện | Ghi chú
    worksheet.columns = [
      { header: 'STT', key: 'stt', width: 10 },
      { header: 'Người thực hiện', key: 'username', width: 24 },
      { header: 'Thao tác', key: 'action', width: 36 },
      { header: 'Mô tả', key: 'description', width: 50 },
      { header: 'Thời gian thực hiện', key: 'datetime', width: 24 },
      { header: 'Ghi chú', key: 'note', width: 30 },
    ];

    // Format Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E3A8A' }, // Xanh Navy Enterprise MXV
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
    });

    // Ghi dữ liệu từng dòng
    allItems.forEach((item, idx) => {
      const rowNum = idx + 2;
      const noteContent = item.note || (item.ipAddress ? `IP: ${item.ipAddress}` : '');
      const row = worksheet.addRow({
        stt: idx + 1,
        username: item.username || '',
        action: item.action || '',
        description: item.description || '',
        datetime: this.formatVietnamDateTime(item.datetime),
        note: noteContent,
      });

      row.height = 22;
      row.eachCell((cell, colNumber) => {
        cell.font = {
          name: 'Segoe UI',
          size: 10,
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
        // Canh giữa cho STT và Thời gian, canh trái cho text
        if (colNumber === 1 || colNumber === 5) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        }
      });
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(uint8Array);
    const fileName = 'NKTTHT.xlsx';

    // Tùy chọn lưu tự động vào thư mục Backup M-System của ngày phiên
    let savedBackupPath: string | undefined;
    if (params.saveToBackup) {
      try {
        const msBackupBase = await getMsBackupBase(this.settingsService);
        const resolvedBase = resolveStoragePathCrossPlatform(msBackupBase);
        const { dateObj } = resolveTradingSessionDate(resolvedEnd);
        const { fullPath } = resolveDailySubfolder(resolvedBase, dateObj);

        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
        }
        savedBackupPath = path.join(fullPath, fileName);
        fs.writeFileSync(savedBackupPath, buffer);
        this.logger.log(`[MsActivitiesManual] Đã lưu file đồng thời vào Backup ca trực: ${savedBackupPath}`);
      } catch (saveErr: any) {
        this.logger.warn(`[MsActivitiesManual] Không thể lưu file vào thư mục backup: ${saveErr.message}`);
      }
    }

    // Nếu có response express, stream trực tiếp về client
    if (res) {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    }

    return {
      buffer,
      fileName,
      totalRows: allItems.length,
      savedBackupPath,
    };
  }
}

