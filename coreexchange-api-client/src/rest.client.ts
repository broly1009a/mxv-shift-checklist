/**
 * rest.client.ts
 * HTTP Client chuyên dụng cho hệ thống Core Exchange (CE)
 * Hỗ trợ:
 * 1. Gọi REST Search API lấy dữ liệu JSON bảng
 * 2. Xuất dữ liệu JSON thành file Excel (.xlsx) chuẩn nghiệp vụ
 * 3. Tải file nhị phân trực tiếp từ server
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import {
  ICoreExchangeAuthSession,
  ICoreExchangePageQuery,
  ICoreExchangeReportDef,
} from './types';

export class CoreExchangeRestClient {
  private readonly defaultBaseUrl = 'https://coreexchange.mxv.com.vn';

  constructor(
    private readonly baseUrl: string = process.env.COREEXCHANGE_BASE_URL || 'https://coreexchange.mxv.com.vn'
  ) {}

  /**
   * Gọi REST Search API lấy dữ liệu bảng
   */
  public async searchData(
    session: ICoreExchangeAuthSession,
    endpoint: string,
    query: ICoreExchangePageQuery = {}
  ): Promise<{ rows: any[]; totalCount: number; raw: any }> {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'Cookie': session.sessionCookie,
      'Referer': `${this.baseUrl}/DASHBOARD`,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
    }).catch(async () => {
      // Fallback sang GET nếu POST không hỗ trợ
      return fetch(fullUrl, { method: 'GET', headers });
    });

    if (!res.ok) {
      throw new Error(`Gọi API Core Exchange [${endpoint}] thất bại! HTTP Status: ${res.status}`);
    }

    const data: any = await res.json().catch(() => null);
    if (!data) return { rows: [], totalCount: 0, raw: null };

    // Bóc tách cấu trúc dữ liệu trả về từ Spring / REST Backend của MXV
    const rows =
      data.data ||
      data.list ||
      data.rows ||
      (Array.isArray(data) ? data : []);

    const totalCount =
      data.totalCount ||
      data.total ||
      (data.page && data.page.totalCount) ||
      rows.length;

    return { rows, totalCount, raw: data };
  }

  /**
   * Xuất danh sách bản ghi JSON ra file Excel (.xlsx) chuẩn Enterprise
   */
  public async exportJsonToExcel(
    rows: any[],
    reportDef: ICoreExchangeReportDef,
    targetFilePath: string
  ): Promise<{ filePath: string; sizeBytes: number; durationMs: number; filename: string }> {
    const startTime = Date.now();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MXV Shift Checklist Bot';
    workbook.lastModifiedBy = 'CoreExchange Client';
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheetName = reportDef.key.slice(0, 31);
    const worksheet = workbook.addWorksheet(sheetName, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    if (rows && rows.length > 0) {
      // Trích xuất tự động các cột từ row đầu tiên
      const sample = rows[0];
      const columns = Object.keys(sample).map((key) => ({
        header: key.toUpperCase(),
        key: key,
        width: Math.max(key.length + 5, 15),
      }));

      worksheet.columns = columns;

      // Định dạng header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' }, // Blue Enterprise
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
      headerRow.height = 25;

      // Thêm các dòng dữ liệu
      rows.forEach((r) => worksheet.addRow(r));
    } else {
      // Bảng rỗng
      worksheet.columns = [{ header: 'THÔNG BÁO', key: 'msg', width: 40 }];
      worksheet.addRow({ msg: 'Không có dữ liệu trong phiên giao dịch hiện tại' });
    }

    const targetDir = path.dirname(targetFilePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    fs.writeFileSync(targetFilePath, buffer);
    const durationMs = Date.now() - startTime;

    return {
      filePath: targetFilePath,
      sizeBytes: buffer.length,
      durationMs,
      filename: path.basename(targetFilePath),
    };
  }

  /**
   * Tải file nhị phân trực tiếp từ server nếu có endpoint tải file
   */
  public async downloadBinaryFile(
    session: ICoreExchangeAuthSession,
    endpoint: string,
    targetFilePath: string
  ): Promise<{ filePath: string; sizeBytes: number; durationMs: number; filename: string }> {
    const startTime = Date.now();
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const res = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Cookie': session.sessionCookie,
        'Referer': `${this.baseUrl}/DASHBOARD`,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) {
      throw new Error(`Tải file từ [${endpoint}] thất bại! HTTP Status: ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const targetDir = path.dirname(targetFilePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(targetFilePath, buffer);
    const durationMs = Date.now() - startTime;

    return {
      filePath: targetFilePath,
      sizeBytes: buffer.length,
      durationMs,
      filename: path.basename(targetFilePath),
    };
  }
}
