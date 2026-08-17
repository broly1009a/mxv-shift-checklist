// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { resolveDailySubfolder } from './helpers/bot-path.helper';

export interface CqgAuditResult {
  key: string;
  filename: string;
  type: 'RAW' | 'CONSOLIDATED' | 'MANUAL';
  status: 'OK' | 'MISSING' | 'OUTDATED';
  lastModified?: Date;
}

export const REQUIRED_CQG_FILES = [
  { key: 'FR1', filename: 'FR1.xlsx', type: 'RAW' as const },
  { key: 'FR2', filename: 'FR2.xlsx', type: 'RAW' as const },
  { key: 'OD1', filename: 'OD1.xlsx', type: 'RAW' as const },
  { key: 'OD2', filename: 'OD2.xlsx', type: 'RAW' as const },
  { key: 'OP1', filename: 'OP1.xlsx', type: 'RAW' as const },
  { key: 'OP2', filename: 'OP2.xlsx', type: 'RAW' as const },
  { key: 'PS1', filename: 'PS1.xlsx', type: 'RAW' as const },
  { key: 'PS2', filename: 'PS2.xlsx', type: 'RAW' as const },
  { key: 'FR', filename: 'FR.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'Od', filename: 'Od.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'OP', filename: 'OP.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'PS', filename: 'PS.xlsx', type: 'CONSOLIDATED' as const },
  { key: 'AS', filename: 'AS.xlsx', type: 'MANUAL' as const },
];

@Injectable()
export class CqgSyncService {
  private readonly logger = new Logger(CqgSyncService.name);

  constructor(private readonly settingsService: SystemSettingsService) {}

  /**
   * Retrieves the configured CQG backup base folder and resolves the daily subfolder.
   * Path format: baseDir\YYYY\TMM.YYYY\DD.MM
   */
  async getDailyBackupPath(
    targetDate: Date = new Date(),
  ): Promise<{ baseDir: string; fullPath: string }> {
    const baseDir = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      'M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
    );

    const { fullPath } = resolveDailySubfolder(baseDir, targetDate);
    return { baseDir, fullPath };
  }

  /**
   * Scans the daily backup folder and returns the status of required files.
   */
  async scanCqgBackupFiles(
    targetDate: Date = new Date(),
  ): Promise<CqgAuditResult[]> {
    const { fullPath } = await this.getDailyBackupPath(targetDate);
    const todayStr = targetDate.toDateString();
    const results: CqgAuditResult[] = [];

    // Scan CQG files
    for (const f of REQUIRED_CQG_FILES) {
      const filePath = path.join(fullPath, f.filename);
      if (!fs.existsSync(fullPath) || !fs.existsSync(filePath)) {
        results.push({
          key: f.key,
          filename: f.filename,
          type: f.type,
          status: 'MISSING',
        });
      } else {
        const stat = fs.statSync(filePath);
        const fileDateStr = new Date(stat.mtime).toDateString();
        const isToday = fileDateStr === todayStr;
        results.push({
          key: f.key,
          filename: f.filename,
          type: f.type,
          status: isToday ? 'OK' : 'OUTDATED',
          lastModified: stat.mtime,
        });
      }
    }

    // Scan M-System TTTT.xlsx file
    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    let msFilePath = '';
    const possiblePaths = [
      path.join(msBackupBase, subFolder, 'TTTT.xlsx'),
      path.join(msBackupBase, 'TTTT.xlsx'),
      path.join(msBackupBase, subFolder, 'TTM.xlsx'),
      path.join(msBackupBase, 'TTM.xlsx'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        msFilePath = p;
        break;
      }
    }

    if (msFilePath) {
      const stat = fs.statSync(msFilePath);
      const fileDateStr = new Date(stat.mtime).toDateString();
      const isToday = fileDateStr === todayStr;
      results.push({
        key: 'MS_TTTT',
        filename: `TTTT.xlsx (M-System - ${path.basename(msFilePath)})`,
        type: 'RAW',
        status: isToday ? 'OK' : 'OUTDATED',
        lastModified: stat.mtime,
      });
    } else {
      results.push({
        key: 'MS_TTTT',
        filename: 'TTTT.xlsx (M-System)',
        type: 'RAW',
        status: 'MISSING',
      });
    }

    return results;
  }

  /**
   * Merges all missing/outdated consolidated CQG reports from their raw counterparts.
   */
  async autoMergeMissingFiles(
    targetDate: Date = new Date(),
  ): Promise<{ success: boolean; logs: string[] }> {
    const logs: string[] = [];
    const { fullPath } = await this.getDailyBackupPath(targetDate);

    if (!fs.existsSync(fullPath)) {
      const errorMsg = `Thư mục backup CQG cho ngày ${targetDate.toLocaleDateString('vi-VN')} không tồn tại: ${fullPath}`;
      this.logger.error(errorMsg);
      return { success: false, logs: [errorMsg] };
    }

    const audit = await this.scanCqgBackupFiles(targetDate);
    logs.push(
      `Bắt đầu chạy quy trình tự động ghép file tại thư mục: ${fullPath}`,
    );

    // Resolve M-System backup path for PS reconciliation
    // M-System backup path is typically configured in settings
    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    );

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    // Try finding TTTT.xlsx first (realized PnL), then TTM.xlsx (open positions), supporting both nested and flat paths
    let ttmPath = '';
    const possiblePaths = [
      path.join(msBackupBase, subFolder, 'TTTT.xlsx'),
      path.join(msBackupBase, 'TTTT.xlsx'),
      path.join(msBackupBase, subFolder, 'TTM.xlsx'),
      path.join(msBackupBase, 'TTM.xlsx'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        ttmPath = p;
        break;
      }
    }

    if (!ttmPath) {
      ttmPath = path.join(msBackupBase, 'TTTT.xlsx');
    }
    this.logger.log(`Sử dụng file MS để đối chiếu PS: ${ttmPath}`);

    const runMerge = async (
      name: string,
      mergeFn: () => void | Promise<void>,
      rawKeys: string[],
    ) => {
      const missingRaw = rawKeys.filter((k) => {
        const item = audit.find((a) => a.key === k);
        return !item || item.status === 'MISSING';
      });

      if (missingRaw.length > 0) {
        const msg = `⚠️ Bỏ qua ghép ${name}.xlsx vì thiếu file nguồn: ${missingRaw.join(', ')}`;
        this.logger.warn(msg);
        logs.push(msg);
        return;
      }

      try {
        logs.push(`Đang ghép file ${name}.xlsx...`);
        await mergeFn();
        logs.push(`✅ Ghép file ${name}.xlsx thành công.`);
      } catch (err: any) {
        const msg = `❌ Lỗi khi ghép file ${name}.xlsx: ${err.message}`;
        this.logger.error(msg, err.stack);
        logs.push(msg);
      }
    };

    // 1. Merge FR.xlsx
    const frItem = audit.find((a) => a.key === 'FR');
    if (!frItem || frItem.status !== 'OK') {
      await runMerge(
        'FR',
        () =>
          this.mergeFR(
            path.join(fullPath, 'FR1.xlsx'),
            path.join(fullPath, 'FR2.xlsx'),
            path.join(fullPath, 'FR.xlsx'),
          ),
        ['FR1', 'FR2'],
      );
    } else {
      logs.push(`FR.xlsx đã tồn tại và cập nhật hôm nay.`);
    }

    // 2. Merge OP.xlsx
    const opItem = audit.find((a) => a.key === 'OP');
    if (!opItem || opItem.status !== 'OK') {
      await runMerge(
        'OP',
        () =>
          this.mergeOP(
            path.join(fullPath, 'OP1.xlsx'),
            path.join(fullPath, 'OP2.xlsx'),
            path.join(fullPath, 'OP.xlsx'),
          ),
        ['OP1', 'OP2'],
      );
    } else {
      logs.push(`OP.xlsx đã tồn tại và cập nhật hôm nay.`);
    }

    // 3. Merge Od.xlsx (OD1 and OD2)
    const odItem = audit.find((a) => a.key === 'Od');
    if (!odItem || odItem.status !== 'OK') {
      await runMerge(
        'Od',
        () =>
          this.mergeOD(
            path.join(fullPath, 'OD1.xlsx'),
            path.join(fullPath, 'OD2.xlsx'),
            path.join(fullPath, 'Od.xlsx'),
          ),
        ['OD1', 'OD2'],
      );
    } else {
      logs.push(`Od.xlsx đã tồn tại và cập nhật hôm nay.`);
    }

    // 4. Merge PS.xlsx
    const psItem = audit.find((a) => a.key === 'PS');
    if (!psItem || psItem.status !== 'OK') {
      await runMerge(
        'PS',
        () =>
          this.mergePS(
            path.join(fullPath, 'PS1.xlsx'),
            path.join(fullPath, 'PS2.xlsx'),
            path.join(fullPath, 'PS.xlsx'),
            ttmPath,
          ),
        ['PS1', 'PS2'],
      );
    } else {
      logs.push(`PS.xlsx đã tồn tại và cập nhật hôm nay.`);
    }

    logs.push('Hoàn tất quy trình kiểm tra và tự động ghép file.');
    return { success: true, logs };
  }

  /**
   * Logic: Merge FR1.xlsx and FR2.xlsx.
   * Copies A2:H of FR1 (headers + data excluding last 2 rows footer).
   * Copies A3:H of FR2 (excluding headers and footer).
   */
  private mergeFR(src1: string, src2: string, dest: string) {
    const wb1 = XLSX.readFile(src1);
    const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], {
      header: 1,
    });
    const lr1 = rows1.length;

    // Header at rows1[1], Data starting rows1[2] to rows1[lr1 - 3]
    const headerRow = rows1[1] || [];
    const data1 = lr1 > 2 ? rows1.slice(2, lr1 - 2) : [];
    const mergedData = [headerRow, ...data1];

    if (fs.existsSync(src2)) {
      const wb2 = XLSX.readFile(src2);
      const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], {
        header: 1,
      });
      const lr2 = rows2.length;
      if (lr2 > 4) {
        // Copy A3:H & (lr2 - 2) -> index 2 to lr2 - 3
        const data2 = rows2.slice(2, lr2 - 2);
        mergedData.push(...data2);
      }
    }

    const nwb = XLSX.utils.book_new();
    const ns = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
    XLSX.writeFile(nwb, dest, { compression: true });
  }

  /**
   * Logic: Merge OP1.xlsx and OP2.xlsx.
   * Copies A2:M of OP1 (including header).
   * Copies A3:M of OP2.
   */
  private mergeOP(src1: string, src2: string, dest: string) {
    const wb1 = XLSX.readFile(src1);
    const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], {
      header: 1,
    });

    // Header at rows1[1], Data from rows1[2] onwards
    const headerRow = rows1[1] || [];
    const data1 = rows1.slice(2);
    const mergedData = [headerRow, ...data1];

    if (fs.existsSync(src2)) {
      const wb2 = XLSX.readFile(src2);
      const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], {
        header: 1,
      });
      const lr2 = rows2.length;
      if (lr2 > 3) {
        // Copy A3:M & lr2 -> index 2 to end
        const data2 = rows2.slice(2);
        mergedData.push(...data2);
      }
    }

    const nwb = XLSX.utils.book_new();
    const ns = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
    XLSX.writeFile(nwb, dest, { compression: true });
  }

  /**
   * Logic: Merge OD1.xlsx and OD2.xlsx.
   * Copies A3:Q of OD1.
   * Copies A4:Q of OD2, appending at row lr1 - 3 (overwriting last rows of OD1).
   */
  private mergeOD(src1: string, src2: string, dest: string) {
    const wb1 = XLSX.readFile(src1);
    const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], {
      header: 1,
    });
    const lr1 = rows1.length;

    // Header at rows1[2], Data starting from index 3
    const data1 = rows1.slice(2); // header + data

    let mergedData = [...data1];

    if (fs.existsSync(src2)) {
      const wb2 = XLSX.readFile(src2);
      const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], {
        header: 1,
      });
      const lr2 = rows2.length;
      if (lr2 > 3) {
        // Copy A4:Q & lr2 -> index 3 to end
        const data2 = rows2.slice(3);

        // Overwrite last 2 rows of data1 by concat at index lr1 - 4
        // (Since data1 started at rows1[2], it has length lr1 - 2. Paste at lr1 - 3 of OD1 is index lr1 - 4 of rows1,
        // which corresponds to index lr1 - 6 of data1. Let's trace it)
        // Wait, the VBA writes to Target cells (lr1 - 3, 1). Since OD1 started at cell A3 (index 2 of rows1),
        // and target sheet has headers on row 1 (which is index 2 of OD1).
        // Let's do exact JS array index replacement:
        // Rows1 index: 2 is OD1 row 3.
        // Excel Row lr1 - 3: is rows1 index lr1 - 4.
        // Target Sheet Row lr1 - 3: is target sheet index lr1 - 4 (if target starts at row 1).
        const pasteIdx = lr1 - 4;
        if (pasteIdx >= 0 && pasteIdx < data1.length) {
          mergedData = data1.slice(0, pasteIdx).concat(data2);
        } else {
          mergedData.push(...data2);
        }
      }
    }

    const nwb = XLSX.utils.book_new();
    const ns = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
    XLSX.writeFile(nwb, dest, { compression: true });
  }

  /**
   * Logic: Merge PS1.xlsx and PS2.xlsx, and construct reconciliation sheets.
   */
  private mergePS(src1: string, src2: string, dest: string, ttmPath: string) {
    const wb1 = XLSX.readFile(src1);
    const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], {
      header: 1,
    });

    // 1. Merge Sheet1
    const headerRow = rows1[1] || [];
    const data1 = rows1.slice(2);
    const mergedData = [headerRow, ...data1];

    if (fs.existsSync(src2)) {
      const wb2 = XLSX.readFile(src2);
      const rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], {
        header: 1,
      });
      const lr2 = rows2.length;
      if (lr2 > 3) {
        const data2 = rows2.slice(2);
        mergedData.push(...data2);
      }
    }

    const ws1 = XLSX.utils.aoa_to_sheet(mergedData);

    // 2. Check CQG-MS Sheet
    // Filters Sheet1 rows where column A is not empty
    const sheet2Rows = mergedData
      .filter((row, idx) => {
        if (idx === 0) return true; // keep header
        return (
          row[0] !== undefined &&
          row[0] !== null &&
          String(row[0]).trim() !== ''
        );
      })
      .map((row) => row.slice(0, 10)); // columns A:J

    // Suffix replacement in Column A
    for (let i = 1; i < sheet2Rows.length; i++) {
      let acc = String(sheet2Rows[i][0] || '').trim();
      acc = acc
        .replace(/F$/i, '')
        .replace(/L$/i, '-L')
        .replace(/S$/i, '-S')
        .replace(/--/g, '-');
      sheet2Rows[i][0] = acc;
    }

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);

    // Add formulas to columns K, L, M, N (indices 10 to 13)
    for (let i = 1; i < sheet2Rows.length; i++) {
      const r = i + 1;
      ws2[XLSX.utils.encode_cell({ r: i, c: 10 })] = {
        t: 's',
        f: `A${r}&D${r}`,
        v: '',
      }; // Ma check
      ws2[XLSX.utils.encode_cell({ r: i, c: 11 })] = {
        t: 'n',
        f: `I${r}`,
        v: 0,
      }; // CQG
      ws2[XLSX.utils.encode_cell({ r: i, c: 12 })] = {
        t: 'n',
        f: `SUMIF('Check MS-CQG'!Z:Z,'Check CQG-MS'!K${r},'Check MS-CQG'!T:T)`,
        v: 0,
      }; // MS
      ws2[XLSX.utils.encode_cell({ r: i, c: 13 })] = {
        t: 'n',
        f: `L${r}-M${r}`,
        v: 0,
      }; // Check
    }

    // Set headers
    ws2[XLSX.utils.encode_cell({ r: 0, c: 10 })] = { t: 's', v: 'Ma check' };
    ws2[XLSX.utils.encode_cell({ r: 0, c: 11 })] = { t: 's', v: 'CQG' };
    ws2[XLSX.utils.encode_cell({ r: 0, c: 12 })] = { t: 's', v: 'MS' };
    ws2[XLSX.utils.encode_cell({ r: 0, c: 13 })] = { t: 's', v: 'Check' };

    // Update ref range of ws2
    if (ws2['!ref']) {
      const range = XLSX.utils.decode_range(ws2['!ref']);
      range.e.c = 13;
      ws2['!ref'] = XLSX.utils.encode_range(range);
    }

    // 3. Check MS-CQG Sheet
    let ttmRows: any[][] = [];
    if (fs.existsSync(ttmPath)) {
      try {
        const wbTtm = XLSX.readFile(ttmPath);
        ttmRows = XLSX.utils.sheet_to_json(wbTtm.Sheets[wbTtm.SheetNames[0]], {
          header: 1,
        });
      } catch (err: any) {
        this.logger.error(
          `Không thể đọc file MS tại ${ttmPath}: ${err.message}`,
        );
      }
    }

    // Pad rows to ensure they have at least 20 columns (column T is index 19)
    const sheet3Rows = ttmRows.map((row) => {
      const newRow = [...row];
      while (newRow.length < 20) {
        newRow.push(null);
      }
      return newRow;
    });

    // If empty, create standard headers
    if (sheet3Rows.length === 0) {
      const emptyHeaders = Array(20).fill(null);
      emptyHeaders[7] = 'Mã TKGD';
      emptyHeaders[9] = 'Mã HĐ';
      emptyHeaders[19] = 'KL ròng';
      sheet3Rows.push(emptyHeaders);
    }

    const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);

    // Add formulas for columns Z to AC (indices 25 to 28)
    for (let i = 1; i < sheet3Rows.length; i++) {
      const r = i + 1;
      ws3[XLSX.utils.encode_cell({ r: i, c: 25 })] = {
        t: 's',
        f: `H${r}&J${r}`,
        v: '',
      }; // Ma check
      ws3[XLSX.utils.encode_cell({ r: i, c: 26 })] = {
        t: 'n',
        f: `SUMIF(Z:Z,Z${r},T:T)`,
        v: 0,
      }; // MS
      ws3[XLSX.utils.encode_cell({ r: i, c: 27 })] = {
        t: 'n',
        f: `VLOOKUP(Z${r},'Check CQG-MS'!K:L,2,0)`,
        v: 0,
      }; // CQG
      ws3[XLSX.utils.encode_cell({ r: i, c: 28 })] = {
        t: 'n',
        f: `AA${r}-AB${r}`,
        v: 0,
      }; // Check
    }

    // Set headers
    ws3[XLSX.utils.encode_cell({ r: 0, c: 25 })] = { t: 's', v: 'Ma check' };
    ws3[XLSX.utils.encode_cell({ r: 0, c: 26 })] = { t: 's', v: 'MS' };
    ws3[XLSX.utils.encode_cell({ r: 0, c: 27 })] = { t: 's', v: 'CQG' };
    ws3[XLSX.utils.encode_cell({ r: 0, c: 28 })] = { t: 's', v: 'Check' };

    // Update ref range of ws3
    if (ws3['!ref']) {
      const range = XLSX.utils.decode_range(ws3['!ref']);
      range.e.c = 28;
      ws3['!ref'] = XLSX.utils.encode_range(range);
    }

    // 4. JS-based reconciliation for MS-CQG Sheet
    // Sum MS Net Positions by Account + Symbol (indices 7 and 9, position index 19)
    const msSummary = new Map<
      string,
      { account: string; symbol: string; position: number }
    >();
    for (let i = 1; i < sheet3Rows.length; i++) {
      const account = String(sheet3Rows[i][7] || '').trim();
      const symbol = String(sheet3Rows[i][9] || '').trim();
      const position = parseFloat(sheet3Rows[i][19]) || 0;
      if (!account || !symbol) continue;

      const key = `${account}_${symbol}`;
      const existing = msSummary.get(key) || { account, symbol, position: 0 };
      existing.position += position;
      msSummary.set(key, existing);
    }

    // Sum CQG Net Positions by Account + Symbol (indices 0 and 3, position index 8)
    const cqgSummary = new Map<
      string,
      { account: string; symbol: string; position: number }
    >();
    for (let i = 1; i < sheet2Rows.length; i++) {
      const account = String(sheet2Rows[i][0] || '').trim();
      const symbol = String(sheet2Rows[i][3] || '').trim();
      const position = parseFloat(sheet2Rows[i][8]) || 0;
      if (!account || !symbol) continue;

      const key = `${account}_${symbol}`;
      const existing = cqgSummary.get(key) || { account, symbol, position: 0 };
      existing.position += position;
      cqgSummary.set(key, existing);
    }

    // Compare and find discrepancies
    const sheet4Data: any[][] = [['Account', 'Symbol', 'MS', 'CQG', 'Check']];
    const allKeys = new Set([...msSummary.keys(), ...cqgSummary.keys()]);

    for (const key of allKeys) {
      const ms = msSummary.get(key);
      const cqg = cqgSummary.get(key);
      const account = ms?.account || cqg?.account || '';
      const symbol = ms?.symbol || cqg?.symbol || '';
      const msVal = ms?.position || 0;
      const cqgVal = cqg?.position || 0;
      const diff = msVal - cqgVal;

      if (Math.abs(diff) > 0.001) {
        sheet4Data.push([account, symbol, msVal, cqgVal, diff]);
      }
    }

    const ws4 = XLSX.utils.aoa_to_sheet(sheet4Data);

    // Save Workbook
    const nwb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(nwb, ws1, 'Sheet1');
    XLSX.utils.book_append_sheet(nwb, ws2, 'Check CQG-MS');
    XLSX.utils.book_append_sheet(nwb, ws3, 'Check MS-CQG');
    XLSX.utils.book_append_sheet(nwb, ws4, 'MS-CQG');

    // Hide Sheet3 ('Check MS-CQG')
    if (!nwb.Workbook) nwb.Workbook = {};
    nwb.Workbook.Sheets = [
      { Hidden: 0 },
      { Hidden: 0 },
      { Hidden: 1 }, // Hidden
      { Hidden: 0 },
    ];

    XLSX.writeFile(nwb, dest, { compression: true });
  }
}
