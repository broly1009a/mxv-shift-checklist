/**
 * ============================================================================
 * CORECCP-REST.CLIENT.TS
 * ============================================================================
 * HTTP Client chuyên dụng tương tác với hệ thống CoreCCP REST API:
 * - Kiểu 1: Search API với pageSize: 200,000 -> Trả về mảng JSON siêu tốc
 * - Kiểu 2: Kích hoạt Export Job (POST /ccp/export/create) & Tải file nhị phân (/report/download/{id})
 * - Tiện ích chuyển đổi JSON thành Excel .XLSX bằng ExcelJS
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { ICcpAuthSession, ICcpExportCreatePayload } from './coreccp.types';

@Injectable()
export class CoreCcpRestClient {
  private readonly logger = new Logger(CoreCcpRestClient.name);

  /**
   * KIỂU 1: Gọi REST Search API với pageSize cực lớn (200,000) lấy toàn bộ dữ liệu JSON
   */
  async searchFullJson(
    session: ICcpAuthSession,
    searchCode: string,
    baseUrl = 'https://uat-coreccp.mxv.com.vn',
    refererRoute = '',
    filterPayload: Record<string, any> = {},
  ): Promise<{ rows: any[]; totalCount: number }> {
    const endpoint = `/ccp/inquiry/maintain/${searchCode}/search/${searchCode}`;
    const payload = {
      searchcode: searchCode,
      search: filterPayload.search || {},
      filter: filterPayload.filter || {},
      orderBy: {},
      page: {
        pageIndex: 1,
        pageSize: 200000, // Lấy toàn bộ bản ghi theo cơ chế tối ưu của CoreCCP
      },
    };

    this.logger.log(`[REST] [Kiểu 1] Đang gọi Search API: ${endpoint} (pageSize: 200,000)...`);
    const res = await this.makeJsonRequest(session, baseUrl, endpoint, payload, refererRoute);

    if (res.status === 200 && res.data && res.data.success) {
      const rows = res.data.payload?.data || res.data.data || [];
      const totalCount = res.data.payload?.page?.totalCount || res.data.page?.totalCount || rows.length;
      this.logger.log(`[REST] ✓ Nhận thành công ${rows.length} bản ghi JSON cho ${searchCode}`);
      return { rows, totalCount };
    }

    throw new Error(`Gọi Search API ${searchCode} thất bại (Status: ${res.status}): ${JSON.stringify(res.data)}`);
  }

  /**
   * KIỂU 2 (Bước 1): Kích hoạt Job tạo file Excel trên Server (/ccp/export/create)
   */
  async createExportJob(
    session: ICcpAuthSession,
    searchCode: string,
    fekey: string,
    baseUrl = 'https://uat-coreccp.mxv.com.vn',
    refererRoute = '',
    filterPayload: Record<string, any> = {},
  ): Promise<{ success: boolean; code: string }> {
    const endpoint = '/ccp/export/create';
    const payload: ICcpExportCreatePayload = {
      searchcode: searchCode,
      search: filterPayload.search || {},
      filter: filterPayload.filter || {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 20 },
      exptype: 'XLSX',
      fekey,
    };

    this.logger.log(`[REST] [Kiểu 2] Kích hoạt Export Job cho: ${searchCode} (fekey: ${fekey})...`);
    const res = await this.makeJsonRequest(session, baseUrl, endpoint, payload, refererRoute);

    if (res.status === 200 && res.data && res.data.success) {
      this.logger.log(`[REST] ✓ Server đã tiếp nhận Export Job cho ${searchCode} (Response code: ${res.data.code})`);
      return { success: true, code: res.data.code };
    }

    throw new Error(`Kích hoạt Export Job ${searchCode} thất bại: ${JSON.stringify(res.data)}`);
  }

  /**
   * KIỂU 2 (Bước 2): Tải file Excel nhị phân trực tiếp từ Server (/ccp/report/download/{id})
   */
  async downloadReportBinary(
    session: ICcpAuthSession,
    reportId: string | number,
    baseUrl = 'https://uat-coreccp.mxv.com.vn',
    refererRoute = '',
  ): Promise<Buffer> {
    const endpoint = `/ccp/report/download/${reportId}`;
    this.logger.log(`[REST] Đang tải file nhị phân từ: ${baseUrl}${endpoint}...`);

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(baseUrl);
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: endpoint,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'connectkey': 'fsscssiam2021',
          'Cookie': `SESSION=${session.sessionCookie}`,
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
          'Referer': `${baseUrl}${refererRoute || '/'}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreCCP-Bot-Ingress/1.0',
        },
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Tải file download/${reportId} thất bại với HTTP status: ${res.statusCode}`));
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          this.logger.log(`[REST] ✓ Đã nhận Buffer file nhị phân (${(buffer.length / 1024).toFixed(1)} KB)`);
          resolve(buffer);
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout khi tải file /report/download/${reportId}`));
      });
      req.end();
    });
  }

  /**
   * Xuất mảng JSON ra file Excel .XLSX bằng ExcelJS (Dành cho các màn hình Kiểu 1)
   * Tự động nạp Schema cột chuẩn trích xuất từ UI ag-Grid (nếu có) để đặt tiêu đề tiếng Việt chuẩn
   */
  async convertJsonToExcel(
    rows: any[],
    sheetName: string,
    targetFilePath: string,
    schemaKey?: string,
  ): Promise<void> {
    const dir = path.dirname(targetFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName || 'Sheet1');

    if (rows.length === 0) {
      worksheet.addRow(['(Không có dữ liệu phát sinh trong phiên)']);
      await workbook.xlsx.writeFile(targetFilePath);
      return;
    }

    // 1. Thử nạp Schema Cột trích xuất từ UI nếu có schemaKey
    let columnsDef: Array<{ header: string; key: string; width?: number }> = [];
    if (schemaKey) {
      try {
        const schemaPath = path.join(__dirname, 'schemas', 'ag_grid_column_schemas.json');
        if (fs.existsSync(schemaPath)) {
          const allSchemas = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
          const targetSchema = allSchemas[schemaKey.toUpperCase()] || allSchemas[schemaKey];
          if (targetSchema && Array.prototype.isPrototypeOf(targetSchema.columns)) {
            columnsDef = targetSchema.columns.map((c: any) => ({
              header: c.header || c.key,
              key: c.key,
              width: Math.max((c.header || c.key).length + 4, 15),
            }));
          }
        }
      } catch { }
    }

    // 2. Nếu không tìm thấy Schema, tự động nhận diện từ key JSON của bản ghi đầu
    if (columnsDef.length === 0) {
      const keys = Object.keys(rows[0]);
      columnsDef = keys.map((key) => ({
        header: key,
        key: key,
        width: Math.max(key.length + 4, 15),
      }));
    }

    worksheet.columns = columnsDef;

    // Thêm các dòng dữ liệu
    rows.forEach((row) => worksheet.addRow(row));

    // Định dạng Header row (màu nền xám nhẹ, in đậm, căn giữa)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    await workbook.xlsx.writeFile(targetFilePath);
    this.logger.log(`[REST] ✓ Đã tạo file Excel .XLSX từ JSON: ${path.basename(targetFilePath)} (${rows.length} dòng, ${columnsDef.length} cột)`);
  }

  /**
   * Hàm gọi HTTPS JSON nội bộ
   */
  private makeJsonRequest(
    session: ICcpAuthSession,
    baseUrl: string,
    endpoint: string,
    payload: any,
    refererRoute: string,
  ): Promise<{ status: number; data: any }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(baseUrl);
      const postData = JSON.stringify(payload);

      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Accept': 'application/json, text/plain, */*',
          'Authorization': `Bearer ${session.accessToken}`,
          'connectkey': 'fsscssiam2021',
          'Cookie': `SESSION=${session.sessionCookie}`,
          'Origin': baseUrl,
          'Referer': `${baseUrl}${refererRoute || '/'}`,
          'x-devicetype': 'WEB',
          'x-lang': 'vi',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreCCP-Bot-Ingress/1.0',
        },
        timeout: 20000,
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({ status: res.statusCode || 200, data });
          } catch {
            resolve({ status: res.statusCode || 200, data: { raw: body } });
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout khi gọi ${endpoint}`));
      });

      req.write(postData);
      req.end();
    });
  }
}
