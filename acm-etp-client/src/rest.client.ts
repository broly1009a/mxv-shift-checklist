/**
 * rest.client.ts
 * HTTP Client chuyên dụng cho hệ thống ACM ETP Exchange Management
 * Hỗ trợ:
 * 1. Tải trực tiếp file nhị phân báo cáo (.xlsx / .xls) từ Endpoint Export
 * 2. Gọi API phân trang (Pagination JSON)
 */

import * as fs from 'fs';
import * as path from 'path';
import { IAcmPageQuery, IAcmReportDef, IAcmSession } from './types';

export class AcmRestClient {
  private readonly defaultBaseUrl = 'https://acm-etp.acmmex.com';

  constructor(
    private readonly baseUrl: string = process.env.ACM_BASE_URL || 'https://acm-etp.acmmex.com'
  ) {}

  /**
   * Tải file báo cáo nhị phân (Excel) từ ACM ETP API và lưu vào đĩa
   */
  public async downloadReportFile(
    session: IAcmSession,
    reportDef: IAcmReportDef,
    targetFilePath?: string,
    overrideQueryParams?: Record<string, string>
  ): Promise<{ filePath: string; sizeBytes: number; durationMs: number; filename: string }> {
    const startTime = Date.now();

    // 1. Chuẩn bị query parameters
    const queryParams: Record<string, string> = {
      token: session.token,
      ...(reportDef.defaultQueryParams || {}),
      ...(overrideQueryParams || {}),
    };

    const qStr = Object.keys(queryParams)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');

    const fullUrl = `${this.baseUrl}${reportDef.exportEndpoint}?${qStr}`;

    // 2. Thiết lập Headers theo chuẩn browser request từ ACM ETP
    const headers: Record<string, string> = {
      'Accept':
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cookie': session.cookies,
      'token': session.token,
      'Referer': `${this.baseUrl}/exchange/index.html`,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Sec-Ch-Ua': '"Chromium";v="120", "Not A?Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    };

    // 3. Thực hiện GET download
    const res = await fetch(fullUrl, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(
        `Tải báo cáo [${reportDef.name}] thất bại! HTTP Status: ${res.status} - ${errorText.slice(0, 200)}`
      );
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json: any = await res.json();
      if (json && json.code !== 0) {
        throw new Error(
          `ACM ETP Server từ chối xuất file: ${json.msg || JSON.stringify(json)}`
        );
      }
    }

    // 4. Trích xuất tên file nếu header Content-Disposition có
    let outFileName = reportDef.fileName;
    const disposition = res.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        outFileName = match[1].replace(/['"]/g, '').trim();
      }
    }

    // 5. Lưu buffer ra đĩa
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0) {
      throw new Error(`Dữ liệu tải về từ ACM ETP rỗng (0 bytes)!`);
    }

    const resolvedPath =
      targetFilePath || path.resolve(process.cwd(), 'output', outFileName);
    const targetDir = path.dirname(resolvedPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, buffer);
    const durationMs = Date.now() - startTime;

    return {
      filePath: resolvedPath,
      sizeBytes: buffer.length,
      durationMs,
      filename: path.basename(resolvedPath),
    };
  }

  /**
   * Truy vấn API phân trang (JSON)
   */
  public async fetchPagedData(
    session: IAcmSession,
    pageEndpoint: string,
    query: IAcmPageQuery = {}
  ): Promise<{ code: number; msg?: string; page?: { list: any[]; totalCount: number; pageSize: number; currPage: number } }> {
    const queryParams: Record<string, string> = {
      order: query.order || '',
      orderField: query.orderField || '',
      page: String(query.page || 1),
      limit: String(query.limit || 10),
      _t: String(Date.now()),
    };

    // Bổ sung các query đặc thù (brokerid, investorid, instrumentid...)
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && !queryParams[k]) {
        queryParams[k] = String(v);
      }
    }

    const qStr = Object.keys(queryParams)
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join('&');

    const fullUrl = `${this.baseUrl}${pageEndpoint}?${qStr}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en',
      'Cookie': session.cookies,
      'token': session.token,
      'Referer': `${this.baseUrl}/exchange/index.html`,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    const res = await fetch(fullUrl, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      throw new Error(`Gọi API phân trang thất bại! HTTP Status: ${res.status}`);
    }

    return (await res.json()) as any;
  }
}
