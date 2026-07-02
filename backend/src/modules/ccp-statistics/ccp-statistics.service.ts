import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export class CcpConfig {
  fixedMembers: string[];
  tkMmCodes: string[];
}

@Injectable()
export class CcpStatisticsService {
  private readonly logger = new Logger(CcpStatisticsService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'ccp-statistics');

  constructor(
    private readonly systemSettingsService: SystemSettingsService,
  ) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async getConfig(): Promise<CcpConfig> {
    const defaultVal = JSON.stringify({
      fixedMembers: ['001', '003', '012', '045', '046', '048', '082', '083', '999'],
      tkMmCodes: ['082E9999999-M'],
    });

    const configStr = await this.systemSettingsService.getSetting(
      'ccp_statistics_config',
      defaultVal,
    );

    try {
      return JSON.parse(configStr);
    } catch (err) {
      return JSON.parse(defaultVal);
    }
  }

  async saveConfig(config: CcpConfig) {
    await this.systemSettingsService.setSetting(
      'ccp_statistics_config',
      JSON.stringify(config),
    );
    return { success: true, message: 'Cấu hình CCP đã được lưu thành công' };
  }

  private parseBuffer(buffer: Buffer): any[][] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  }

  private parseVal(val: any): number {
    if (val === null || val === undefined) return 0;
    const str = String(val).replace(/,/g, '').trim();
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  async processCcpData(
    files: {
      dsgdCcp: Buffer;
      dsgdMmCcp: Buffer;
      dstkgd: Buffer;
      nr: Buffer;
      ttm: Buffer;
      tttt: Buffer;
    },
    selectedDate: Date,
  ): Promise<string> {
    const config = await this.getConfig();
    const tkMmCodes = config.tkMmCodes || [];
    const fixedMembers = [...(config.fixedMembers || [])];
    
    // Add MM codes to fixed members list and sort them
    for (const code of tkMmCodes) {
      if (!fixedMembers.includes(code)) {
        fixedMembers.push(code);
      }
    }
    fixedMembers.sort();

    // 1. Read files and skip headers
    const dsgdCcpRows = this.parseBuffer(files.dsgdCcp).slice(1);
    const dsgdMmCcpRows = this.parseBuffer(files.dsgdMmCcp).slice(1);
    const dstkgdRows = this.parseBuffer(files.dstkgd).slice(1);
    const nrRows = this.parseBuffer(files.nr).slice(1);
    const ttmRows = this.parseBuffer(files.ttm).slice(1);
    const ttttRows = this.parseBuffer(files.tttt).slice(1);

    // Merge DSGD
    const mergedDsgd = [...dsgdCcpRows, ...dsgdMmCcpRows];

    // Format selectedDate to dd/MM/yyyy
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDate.getFullYear();
    const todayStrDate = `${day}/${month}/${year}`;

    // Target file path
    const outputFileName = 'Thong_ke_kich_ban_Pilot_Bac_Final.xlsx';
    const outputPath = path.join(this.uploadDir, outputFileName);

    const workbook = new ExcelJS.Workbook();
    if (fs.existsSync(outputPath)) {
      try {
        await workbook.xlsx.readFile(outputPath);
      } catch (err) {
        this.logger.error(`Error reading existing file: ${err.message}. Starting fresh.`);
      }
    }

    // Initialize or get worksheets
    const wsGiaoDich = workbook.getWorksheet('Giao dịch') || workbook.addWorksheet('Giao dịch');
    const wsTaiKhoan = workbook.getWorksheet('Tài khoản') || workbook.addWorksheet('Tài khoản');
    const wsNopRut = workbook.getWorksheet('Nộp Rút') || workbook.addWorksheet('Nộp Rút');
    const wsTtm = workbook.getWorksheet('Trạng thái mở') || workbook.addWorksheet('Trạng thái mở');
    const wsTttt = workbook.getWorksheet('Trạng thái tất toán') || workbook.addWorksheet('Trạng thái tất toán');

    // 2. PROCESS GIAO DỊCH
    this.processGiaoDichSheet(wsGiaoDich, mergedDsgd, fixedMembers, tkMmCodes, todayStrDate, selectedDate);

    // 3. PROCESS TÀI KHOẢN MỞ MỚI
    this.processTaiKhoanSheet(wsTaiKhoan, dstkgdRows, todayStrDate, selectedDate);

    // 4. PROCESS NỘP RÚT
    this.processNopRutSheet(wsNopRut, nrRows, fixedMembers, tkMmCodes, todayStrDate, selectedDate);

    // 5. PROCESS TRẠNG THÁI MỞ
    this.processTtmSheet(wsTtm, ttmRows, fixedMembers, tkMmCodes, todayStrDate, selectedDate);

    // 6. PROCESS TRẠNG THÁI TẤT TOÁN
    this.processTtttSheet(wsTttt, ttttRows, fixedMembers, tkMmCodes, todayStrDate, selectedDate);

    // Save final report
    await workbook.xlsx.writeFile(outputPath);
    return outputPath;
  }

  private processGiaoDichSheet(
    ws: ExcelJS.Worksheet,
    dsgdRows: any[][],
    fixedMembers: string[],
    tkMmCodes: string[],
    todayStrDate: string,
    selectedDate: Date,
  ) {
    const isNew = ws.actualRowCount === 0;

    ws.getCell('I2').value = 'TK MM:';
    ws.getCell('J2').value = tkMmCodes.join(', ');

    if (isNew) {
      ws.getCell('B2').value = 'THỐNG KÊ GIAO DỊCH TRONG GIAI ĐOẠN PILOT BẠC THỎI (từ 08/06/2026 - )';
      ws.getCell('B2').font = { bold: true };

      const headers = ['STT', 'Ngày', 'TVKD', 'Số lot giao dịch', 'Giá trị giao dịch', 'Thực hiện giao dịch đủ cả 4 loại lệnh hay k (Y/N)', 'Nếu là N thì thiếu loại lệnh nào'];
      headers.forEach((h, idx) => {
        const cell = ws.getCell(4, idx + 2);
        cell.value = h;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      ws.getRow(4).height = 24;
    }

    // Grouping
    const groupsRaw: Record<string, any[][]> = {};
    for (const row of dsgdRows) {
      const maTKGD = row[5] ? String(row[5]).trim() : '';
      const maThanhVien = row[21] ? String(row[21]).trim() : '';
      const key = tkMmCodes.includes(maTKGD) ? maTKGD : maThanhVien;
      if (key) {
        if (!groupsRaw[key]) groupsRaw[key] = [];
        groupsRaw[key].push(row);
      }
    }

    const requiredCommands = ['STP', 'STL', 'LMT', 'MKT'];
    const gdGroups = fixedMembers.map(mem => {
      const g = groupsRaw[mem] || [];
      const commands = g
        .map(row => (row[8] ? String(row[8]).trim().toUpperCase() : ''))
        .filter(cmd => cmd !== '');
      const uniqueCommands = Array.from(new Set(commands));
      const missingCommands = requiredCommands.filter(c => !uniqueCommands.includes(c));

      const soLot = g.reduce((sum, row) => sum + this.parseVal(row[10]), 0);
      const giaTri = g.reduce((sum, row) => {
        const kl = this.parseVal(row[10]);
        const gia = this.parseVal(row[13]);
        return sum + kl * gia * 1000;
      }, 0);

      return {
        TVKD: mem,
        soLot,
        giaTri,
        isFull: missingCommands.length === 0 ? 'Y' : 'N',
        missing: missingCommands.length === 0 ? '' : missingCommands.join(', '),
      };
    });

    const pos = this.getAppendPosition(ws, 5, 2, 3, todayStrDate, selectedDate);
    
    // Add rows
    gdGroups.forEach((grp, idx) => {
      const r = pos.insertRow + idx;
      ws.getCell(r, 4).value = grp.TVKD;
      ws.getCell(r, 5).value = grp.soLot;
      ws.getCell(r, 5).numFmt = '#,##0';
      ws.getCell(r, 6).value = grp.giaTri;
      ws.getCell(r, 6).numFmt = '#,##0';
      ws.getCell(r, 7).value = grp.isFull;
      ws.getCell(r, 8).value = grp.missing;

      // Apply borders
      for (let col = 2; col <= 8; col++) {
        ws.getCell(r, col).border = this.thinBorder();
      }
    });

    // Merge and set STT & Date
    if (gdGroups.length > 0) {
      ws.mergeCells(pos.insertRow, 2, pos.insertRow + gdGroups.length - 1, 2);
      const cellStt = ws.getCell(pos.insertRow, 2);
      cellStt.value = pos.stt;
      cellStt.alignment = { horizontal: 'center', vertical: 'middle' };

      ws.mergeCells(pos.insertRow, 3, pos.insertRow + gdGroups.length - 1, 3);
      const cellDate = ws.getCell(pos.insertRow, 3);
      cellDate.value = todayStrDate;
      cellDate.alignment = { horizontal: 'center', vertical: 'middle' };

      // Apply header styling to new headers
      if (isNew) {
        for (let col = 2; col <= 8; col++) {
          ws.getCell(4, col).border = this.thinBorder();
        }
      }
    }

    this.autofitColumns(ws, 2, 8);
  }

  private processTaiKhoanSheet(
    ws: ExcelJS.Worksheet,
    dstkgdRows: any[][],
    todayStrDate: string,
    selectedDate: Date,
  ) {
    const isNew = ws.actualRowCount === 0;

    if (isNew) {
      const headers = ['Ngày', 'TVKD', 'Mã TKGD tạo mới'];
      headers.forEach((h, idx) => {
        const cell = ws.getCell(1, idx + 1);
        cell.value = h;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
      ws.getRow(1).height = 24;
    }

    // Filter accounts created today
    const parsedToday = new Date(selectedDate);
    parsedToday.setHours(0, 0, 0, 0);

    const todayStr1 = `${String(selectedDate.getDate()).padStart(2, '0')}/${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${selectedDate.getFullYear()}`;
    const todayStr2 = `${selectedDate.getDate()}/${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`;
    const todayStr3 = `${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${String(selectedDate.getDate()).padStart(2, '0')}/${selectedDate.getFullYear()}`;

    const filtered = dstkgdRows
      .filter(row => {
        const ngayMo = row[7];
        if (!ngayMo) return false;
        const ngayMoStr = String(ngayMo).trim();
        if (
          ngayMoStr.includes(todayStr1) ||
          ngayMoStr.includes(todayStr2) ||
          ngayMoStr.includes(todayStr3)
        ) {
          return true;
        }

        // Try date parsing
        const parsed = Date.parse(ngayMoStr);
        if (!isNaN(parsed)) {
          const d = new Date(parsed);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === parsedToday.getTime();
        }
        return false;
      })
      .map(row => ({
        maThanhVien: row[3] ? String(row[3]).trim() : '',
        soTKGD: row[1] ? String(row[1]).trim() : '',
      }))
      .sort((a, b) => a.maThanhVien.localeCompare(b.maThanhVien));

    if (filtered.length > 0) {
      const pos = this.getAppendPosition(ws, 2, -1, 1, todayStrDate, selectedDate);
      
      filtered.forEach((item, idx) => {
        const r = pos.insertRow + idx;
        ws.getCell(r, 2).value = item.maThanhVien;
        ws.getCell(r, 3).value = item.soTKGD;

        for (let col = 1; col <= 3; col++) {
          ws.getCell(r, col).border = this.thinBorder();
        }
      });

      ws.mergeCells(pos.insertRow, 1, pos.insertRow + filtered.length - 1, 1);
      const cellDate = ws.getCell(pos.insertRow, 1);
      cellDate.value = todayStrDate;
      cellDate.alignment = { horizontal: 'center', vertical: 'middle' };

      if (isNew) {
        for (let col = 1; col <= 3; col++) {
          ws.getCell(1, col).border = this.thinBorder();
        }
      }
    }

    this.autofitColumns(ws, 1, 3);
  }

  private processNopRutSheet(
    ws: ExcelJS.Worksheet,
    nrRows: any[][],
    fixedMembers: string[],
    tkMmCodes: string[],
    todayStrDate: string,
    selectedDate: Date,
  ) {
    const isNew = ws.actualRowCount === 0;

    ws.getCell('I2').value = 'TK MM:';
    ws.getCell('J2').value = tkMmCodes.join(', ');

    if (isNew) {
      ws.getCell('B2').value = 'THỐNG KÊ NỘP RÚT TRONG GIAI ĐOẠN PILOT BẠC THỎI (từ 08/06/2026 - )';
      ws.getCell('B2').font = { bold: true };

      ws.getCell('B4').value = 'STT';
      ws.mergeCells(4, 2, 5, 2);
      ws.getCell('C4').value = 'Ngày';
      ws.mergeCells(4, 3, 5, 3);
      ws.getCell('D4').value = 'TVKD';
      ws.mergeCells(4, 4, 5, 4);

      ws.getCell('E4').value = 'Nộp tiền';
      ws.mergeCells(4, 5, 4, 6);
      ws.getCell('E5').value = 'Số lệnh';
      ws.getCell('F5').value = 'Giá trị';

      ws.getCell('G4').value = 'Rút tiền';
      ws.mergeCells(4, 7, 4, 8);
      ws.getCell('G5').value = 'Số lệnh';
      ws.getCell('H5').value = 'Giá trị';

      // Formatting
      for (let r = 4; r <= 5; r++) {
        for (let c = 2; c <= 8; c++) {
          const cell = ws.getCell(r, c);
          cell.font = { bold: true };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = this.thinBorder();
        }
      }
    }

    // Grouping
    const groupsRaw: Record<string, any[][]> = {};
    for (const row of nrRows) {
      const soTKGD = row[3] ? String(row[3]).trim() : '';
      const maThanhVien = row[1] ? String(row[1]).trim() : '';
      const key = tkMmCodes.includes(soTKGD) ? soTKGD : maThanhVien;
      if (key) {
        if (!groupsRaw[key]) groupsRaw[key] = [];
        groupsRaw[key].push(row);
      }
    }

    const pos = this.getAppendPosition(ws, 6, 2, 3, todayStrDate, selectedDate);

    fixedMembers.forEach((member, idx) => {
      const r = pos.insertRow + idx;
      ws.getCell(r, 4).value = member;

      let soLenhNop = 0;
      let giaTriNop = 0;
      let soLenhRut = 0;
      let giaTriRut = 0;

      if (groupsRaw[member]) {
        const g = groupsRaw[member];
        const nop = g.filter(row => {
          const loai = row[5] ? String(row[5]).toLowerCase() : '';
          return loai.includes('nộp') || loai.includes('nop');
        });
        const rut = g.filter(row => {
          const loai = row[5] ? String(row[5]).toLowerCase() : '';
          return loai.includes('rút') || loai.includes('rut');
        });

        soLenhNop = nop.length;
        giaTriNop = nop.reduce((sum, row) => sum + this.parseVal(row[6]), 0);
        soLenhRut = rut.length;
        giaTriRut = rut.reduce((sum, row) => sum + this.parseVal(row[6]), 0);
      }

      ws.getCell(r, 5).value = soLenhNop;
      ws.getCell(r, 5).numFmt = '#,##0';
      ws.getCell(r, 6).value = giaTriNop;
      ws.getCell(r, 6).numFmt = '#,##0';
      
      ws.getCell(r, 7).value = soLenhRut;
      ws.getCell(r, 7).numFmt = '#,##0';
      ws.getCell(r, 8).value = giaTriRut;
      ws.getCell(r, 8).numFmt = '#,##0';

      for (let col = 2; col <= 8; col++) {
        ws.getCell(r, col).border = this.thinBorder();
      }
    });

    if (fixedMembers.length > 0) {
      ws.mergeCells(pos.insertRow, 2, pos.insertRow + fixedMembers.length - 1, 2);
      const cellStt = ws.getCell(pos.insertRow, 2);
      cellStt.value = pos.stt;
      cellStt.alignment = { horizontal: 'center', vertical: 'middle' };

      ws.mergeCells(pos.insertRow, 3, pos.insertRow + fixedMembers.length - 1, 3);
      const cellDate = ws.getCell(pos.insertRow, 3);
      cellDate.value = todayStrDate;
      cellDate.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    this.autofitColumns(ws, 2, 8);
  }

  private processTtmSheet(
    ws: ExcelJS.Worksheet,
    ttmRows: any[][],
    fixedMembers: string[],
    tkMmCodes: string[],
    todayStrDate: string,
    selectedDate: Date,
  ) {
    const isNew = ws.actualRowCount === 0;

    ws.getCell('I2').value = 'TK MM:';
    ws.getCell('J2').value = tkMmCodes.join(', ');

    if (isNew) {
      ws.getCell('B2').value = 'THỐNG KÊ TRẠNG THÁI MỞ TRONG GIAI ĐOẠN PILOT BẠC THỎI (từ 08/06/2026 - )';
      ws.getCell('B2').font = { bold: true };

      const headers = ['STT', 'Ngày', 'TVKD', 'TTM mua', 'TTM bán', 'Lãi lỗ dự kiến'];
      headers.forEach((h, idx) => {
        const cell = ws.getCell(4, idx + 2);
        cell.value = h;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = this.thinBorder();
      });
      ws.getRow(4).height = 24;
    }

    // Grouping
    const groupsRaw: Record<string, any[][]> = {};
    for (const row of ttmRows) {
      const maTKGD = row[3] ? String(row[3]).trim() : '';
      const maThanhVien = row[0] ? String(row[0]).trim() : '';
      const key = tkMmCodes.includes(maTKGD) ? maTKGD : maThanhVien;
      if (key) {
        if (!groupsRaw[key]) groupsRaw[key] = [];
        groupsRaw[key].push(row);
      }
    }

    const ttmGroups = fixedMembers.map(mem => {
      const g = groupsRaw[mem] || [];
      const ttmMua = g.reduce((sum, row) => sum + this.parseVal(row[8]), 0);
      const ttmBan = g.reduce((sum, row) => sum + this.parseVal(row[9]), 0);
      const laiLo = g.reduce((sum, row) => sum + this.parseVal(row[14]), 0);

      return {
        TVKD: mem,
        ttmMua,
        ttmBan,
        laiLo,
      };
    });

    const pos = this.getAppendPosition(ws, 5, 2, 3, todayStrDate, selectedDate);

    ttmGroups.forEach((grp, idx) => {
      const r = pos.insertRow + idx;
      ws.getCell(r, 4).value = grp.TVKD;
      ws.getCell(r, 5).value = grp.ttmMua;
      ws.getCell(r, 5).numFmt = '#,##0';
      ws.getCell(r, 6).value = grp.ttmBan;
      ws.getCell(r, 6).numFmt = '#,##0';
      ws.getCell(r, 7).value = grp.laiLo;
      ws.getCell(r, 7).numFmt = '#,##0';

      for (let col = 2; col <= 7; col++) {
        ws.getCell(r, col).border = this.thinBorder();
      }
    });

    if (ttmGroups.length > 0) {
      ws.mergeCells(pos.insertRow, 2, pos.insertRow + ttmGroups.length - 1, 2);
      const cellStt = ws.getCell(pos.insertRow, 2);
      cellStt.value = pos.stt;
      cellStt.alignment = { horizontal: 'center', vertical: 'middle' };

      ws.mergeCells(pos.insertRow, 3, pos.insertRow + ttmGroups.length - 1, 3);
      const cellDate = ws.getCell(pos.insertRow, 3);
      cellDate.value = todayStrDate;
      cellDate.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    this.autofitColumns(ws, 2, 7);
  }

  private processTtttSheet(
    ws: ExcelJS.Worksheet,
    ttttRows: any[][],
    fixedMembers: string[],
    tkMmCodes: string[],
    todayStrDate: string,
    selectedDate: Date,
  ) {
    const isNew = ws.actualRowCount === 0;

    ws.getCell('H2').value = 'TK MM:';
    ws.getCell('I2').value = tkMmCodes.join(', ');

    if (isNew) {
      ws.getCell('B2').value = 'THỐNG KÊ TRẠNG THÁI TẤT TOÁN TRONG GIAI ĐOẠN PILOT BẠC THỎI (từ 08/06/2026 - )';
      ws.getCell('B2').font = { bold: true };

      const headers = ['STT', 'Ngày', 'TVKD', 'KLTT', 'Lãi lỗ thực tế'];
      headers.forEach((h, idx) => {
        const cell = ws.getCell(4, idx + 2);
        cell.value = h;
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = this.thinBorder();
      });
      ws.getRow(4).height = 24;
    }

    // Grouping
    const groupsRaw: Record<string, any[][]> = {};
    for (const row of ttttRows) {
      const maTKGD = row[3] ? String(row[3]).trim() : '';
      const maThanhVien = row[0] ? String(row[0]).trim() : '';
      const key = tkMmCodes.includes(maTKGD) ? maTKGD : maThanhVien;
      if (key) {
        if (!groupsRaw[key]) groupsRaw[key] = [];
        groupsRaw[key].push(row);
      }
    }

    const ttttGroups = fixedMembers.map(mem => {
      const g = groupsRaw[mem] || [];
      const kltt = g.reduce((sum, row) => sum + this.parseVal(row[10]), 0);
      const laiLo = g.reduce((sum, row) => sum + this.parseVal(row[5]), 0);

      return {
        TVKD: mem,
        kltt,
        laiLo,
      };
    });

    const pos = this.getAppendPosition(ws, 5, 2, 3, todayStrDate, selectedDate);

    ttttGroups.forEach((grp, idx) => {
      const r = pos.insertRow + idx;
      ws.getCell(r, 4).value = grp.TVKD;
      ws.getCell(r, 5).value = grp.kltt;
      ws.getCell(r, 5).numFmt = '#,##0';
      ws.getCell(r, 6).value = grp.laiLo;
      ws.getCell(r, 6).numFmt = '#,##0';

      for (let col = 2; col <= 6; col++) {
        ws.getCell(r, col).border = this.thinBorder();
      }
    });

    if (ttttGroups.length > 0) {
      ws.mergeCells(pos.insertRow, 2, pos.insertRow + ttttGroups.length - 1, 2);
      const cellStt = ws.getCell(pos.insertRow, 2);
      cellStt.value = pos.stt;
      cellStt.alignment = { horizontal: 'center', vertical: 'middle' };

      ws.mergeCells(pos.insertRow, 3, pos.insertRow + ttttGroups.length - 1, 3);
      const cellDate = ws.getCell(pos.insertRow, 3);
      cellDate.value = todayStrDate;
      cellDate.alignment = { horizontal: 'center', vertical: 'middle' };
    }

    this.autofitColumns(ws, 2, 6);
  }

  private thinBorder(): ExcelJS.Borders {
    return {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    } as any;
  }

  private getAppendPosition(
    ws: ExcelJS.Worksheet,
    dataStartRow: number,
    sttColIndex: number,
    ngayColIndex: number,
    todayStr: string,
    selectedDate: Date,
  ): { insertRow: number; stt: number } {
    if (ws.actualRowCount < dataStartRow) {
      return { insertRow: dataStartRow, stt: 1 };
    }

    const endRow = ws.actualRowCount;
    let currentRow = dataStartRow;
    let lastBlockStart = -1;
    let lastBlockEnd = -1;
    let lastDate = '';
    let lastStt = 0;

    while (currentRow <= endRow) {
      const cellVal = ws.getCell(currentRow, ngayColIndex).value;
      if (cellVal !== null && cellVal !== undefined) {
        lastBlockStart = currentRow;
        lastDate = String(cellVal).trim();
        if (sttColIndex > 0) {
          const sttVal = ws.getCell(currentRow, sttColIndex).value;
          lastStt = parseInt(String(sttVal)) || 0;
        }

        let blockEnd = currentRow;
        for (let r = currentRow + 1; r <= endRow + 1; r++) {
          const nextVal = ws.getCell(r, ngayColIndex).value;
          if (r > endRow || (nextVal !== null && nextVal !== undefined)) {
            blockEnd = r - 1;
            break;
          }
        }

        lastBlockEnd = blockEnd;
        currentRow = blockEnd + 1;
      } else {
        currentRow++;
      }
    }

    if (lastBlockStart !== -1) {
      // Validate dates
      const [lastD, lastM, lastY] = lastDate.split('/').map(Number);
      const parsedLastDate = new Date(lastY, lastM - 1, lastD);
      const parsedSelectedDate = new Date(selectedDate);
      parsedSelectedDate.setHours(0, 0, 0, 0);
      parsedLastDate.setHours(0, 0, 0, 0);

      if (parsedSelectedDate.getTime() < parsedLastDate.getTime()) {
        throw new Error(
          `Ngày xử lý (${todayStr}) không được trước ngày cuối cùng trong file (${lastDate}) tại sheet ${ws.name}.`
        );
      }

      if (lastDate === todayStr) {
        // Delete current day's existing rows to re-insert (idempotency)
        const rowCount = lastBlockEnd - lastBlockStart + 1;
        ws.spliceRows(lastBlockStart, rowCount);
        return { insertRow: lastBlockStart, stt: lastStt === 0 ? 1 : lastStt };
      } else {
        return { insertRow: lastBlockEnd + 1, stt: lastStt + 1 };
      }
    }

    return { insertRow: dataStartRow, stt: 1 };
  }

  private autofitColumns(ws: ExcelJS.Worksheet, startCol: number, endCol: number) {
    for (let c = startCol; c <= endCol; c++) {
      const col = ws.getColumn(c);
      let maxLen = 10;
      col.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.value) {
          const len = String(cell.value).length;
          if (len > maxLen) maxLen = len;
        }
      });
      col.width = maxLen + 4;
    }
  }
}
