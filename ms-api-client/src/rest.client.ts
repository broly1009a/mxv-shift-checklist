/**
 * ms-rest.client.ts
 * Client HTTP chuyên dụng tải file nhị phân báo cáo Excel/CSV từ M-System API
 */

import * as fs from 'fs';
import * as path from 'path';
import { IMsReportDef } from './types';

export class MsRestClient {
  private readonly defaultBaseUrl = 'https://api-dev.newgen.dev';
  private readonly defaultAdminUrl = 'https://admin-dev.msystem.newgen.dev';

  constructor(
    private readonly baseUrl: string = process.env.MS_BASE_URL || 'https://api-dev.newgen.dev',
    private readonly adminUrl: string = process.env.MS_ADMIN_URL || 'https://admin-dev.msystem.newgen.dev'
  ) {}

  /**
   * Tải file báo cáo nhị phân trực tiếp từ API và lưu vào đĩa
   */
  public async downloadReportFile(
    token: string,
    reportDef: IMsReportDef,
    targetFilePath?: string,
    overrideQueryParams?: Record<string, string>
  ): Promise<{ filePath: string; sizeBytes: number; durationMs: number; filename: string }> {
    const startTime = Date.now();

    // 1. Xây dựng URL hoàn chỉnh kèm query parameters
    let fullUrl = `${this.baseUrl}${reportDef.endpoint}`;
    const mergedQuery = { ...(reportDef.queryParams || {}), ...(overrideQueryParams || {}) };

    const queryKeys = Object.keys(mergedQuery);
    if (queryKeys.length > 0) {
      const qStr = queryKeys
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(mergedQuery[k])}`)
        .join('&');
      fullUrl += fullUrl.includes('?') ? `&${qStr}` : `?${qStr}`;
    }

    // 2. Thiết lập HTTP Headers chuẩn theo quy cách của Newgen
    const headers: Record<string, string> = {
      'accept': 'application/json, text/plain, */*',
      'authorization': `Bearer ${token}`,
      'origin': this.adminUrl,
      'referer': `${this.adminUrl}/`,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (reportDef.method === 'POST') {
      headers['content-type'] = 'application/json';
    }

    // 3. Thực hiện gọi HTTP
    const res = await fetch(fullUrl, {
      method: reportDef.method,
      headers,
      body: reportDef.method === 'POST' ? JSON.stringify(reportDef.bodyParams || {}) : undefined,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Tải file [${reportDef.name}] thất bại (HTTP ${res.status}): ${errText.slice(0, 300)}`);
    }

    // 4. Đọc dữ liệu nhị phân
    const arrayBuf = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const durationMs = Date.now() - startTime;

    // 5. Xác định tên file từ Content-Disposition hoặc mặc định
    let filename = reportDef.fileName;
    const disposition = res.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
      if (match && match[1]) {
        filename = match[1].trim();
      }
    }

    // 6. Lưu file vào đĩa
    const finalPath = targetFilePath || path.resolve(process.cwd(), 'output', filename);
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    fs.writeFileSync(finalPath, buffer);

    return {
      filePath: finalPath,
      sizeBytes: buffer.length,
      durationMs,
      filename,
    };
  }
}
