/**
 * ============================================================================
 * REST CLIENT - CORECCP SEARCH & EXPORT API CLIENT
 * ============================================================================
 */

import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { ICcpAuthSession } from './types';

export class CoreCcpRestClient {
  /**
   * KIỂU 1: Gọi REST Search API với pageSize 200,000 lấy toàn bộ dữ liệu JSON
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
      page: { pageIndex: 1, pageSize: 200000 },
    };

    const res = await this.makeJsonRequest(session, baseUrl, endpoint, payload, refererRoute);
    if (res.status === 200 && res.data && res.data.success) {
      const rows = res.data.data || [];
      const totalCount = res.data.page?.totalCount || rows.length;
      return { rows, totalCount };
    }
    throw new Error(`Search API ${searchCode} thất bại (${res.status}): ${JSON.stringify(res.data)}`);
  }

  /**
   * KIỂU 2: Kích hoạt Job tạo file Excel trên Server (/ccp/export/create)
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
    const payload = {
      searchcode: searchCode,
      search: filterPayload.search || {},
      filter: filterPayload.filter || {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 20 },
      exptype: 'XLSX',
      fekey,
    };

    const res = await this.makeJsonRequest(session, baseUrl, endpoint, payload, refererRoute);
    if (res.status === 200 && res.data && res.data.success) {
      return { success: true, code: res.data.code };
    }
    throw new Error(`Export Create ${searchCode} thất bại: ${JSON.stringify(res.data)}`);
  }

  /**
   * KIỂU 2: Tải file Excel nhị phân trực tiếp từ Server (/ccp/report/download/{id})
   */
  async downloadReportBinary(
    session: ICcpAuthSession,
    reportId: string | number,
    baseUrl = 'https://uat-coreccp.mxv.com.vn',
    refererRoute = '',
  ): Promise<Buffer> {
    const endpoint = `/ccp/report/download/${reportId}`;

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(baseUrl);
      const req = https.request({
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
        },
        timeout: 30000,
      }, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Tải file download/${reportId} thất bại: HTTP ${res.statusCode}`));
        }
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(Buffer.from(chunk)));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout khi tải /report/download/${reportId}`));
      });
      req.end();
    });
  }

  /**
   * Xuất mảng JSON ra file Excel .XLSX bằng ExcelJS
   */
  async convertJsonToExcel(rows: any[], sheetName: string, targetFilePath: string): Promise<void> {
    const dir = path.dirname(targetFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName || 'Sheet1');

    if (rows.length === 0) {
      worksheet.addRow(['(Không có dữ liệu phát sinh trong phiên)']);
      await workbook.xlsx.writeFile(targetFilePath);
      return;
    }

    const headers = Object.keys(rows[0]);
    worksheet.columns = headers.map(key => ({
      header: key,
      key,
      width: Math.max(key.length + 4, 15),
    }));

    rows.forEach(row => worksheet.addRow(row));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    await workbook.xlsx.writeFile(targetFilePath);
  }

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

      const req = https.request({
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
        },
        timeout: 20000,
      }, (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 200, data: JSON.parse(body) });
          } catch {
            resolve({ status: res.statusCode || 200, data: { raw: body } });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout khi gọi ${endpoint}`));
      });

      req.write(postData);
      req.end();
    });
  }
}
