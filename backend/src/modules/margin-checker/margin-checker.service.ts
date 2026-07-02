import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import * as nodemailer from 'nodemailer';
import { TelegramService } from '../telegram/telegram.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
const { PDFParse } = require('pdf-parse');

@Injectable()
export class MarginCheckerService {
  private readonly logger = new Logger(MarginCheckerService.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async loadConfig() {
    const defaultVal = JSON.stringify({
      marginOnOrder: {
        warningRate: 20,
        isSendWarning: true,
        email: ['it.support@mxv.vn'],
        telegramChatId: '',
      },
      marginChange: {
        isSendWarning: true,
        email: ['it.support@mxv.vn'],
        telegramChatId: '',
      },
      smtp: {
        host: 'smtp.office365.com',
        port: 587,
        user: 'it.support@mxv.vn',
        pass: 'OFmng239',
        senderEmail: 'it.support@mxv.vn',
        senderName: 'MXV IT Support',
      },
    });

    const configStr = await this.systemSettingsService.getSetting(
      'margin_checker_config',
      defaultVal,
    );
    try {
      return JSON.parse(configStr);
    } catch (err) {
      return JSON.parse(defaultVal);
    }
  }

  async saveConfig(config: any) {
    await this.systemSettingsService.setSetting(
      'margin_checker_config',
      JSON.stringify(config),
    );
    return { success: true, message: 'Cấu hình đã được lưu thành công' };
  }

  cleanFormula(formula: string): string {
    return formula
      .replace(/\b(\d+(\.\d+)?)m\b/gi, '$1') // Remove C# decimal 'm' suffix
      .replace(/\(decimal\)/g, '')            // Remove C# typecast
      .replace(/,\s*MidpointRounding\.AwayFromZero/gi, '') // Remove MidpointRounding
      .replace(/,\s*,/g, ',')
      .replace(/,\s*\)/g, ')')
      .replace(/Math\.Round/g, 'round')
      .replace(/Math\.Max/g, 'Math.max')
      .replace(/Math\.Min/g, 'Math.min')
      .replace(/Math\.Abs/g, 'Math.abs');
  }

  evaluateFormula(formula: string, context: Record<string, number>): number {
    const cleaned = this.cleanFormula(formula);
    let jsExpr = cleaned;
    
    // Sort keys by length descending to prevent substring matching issues
    const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const val = context[key];
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      jsExpr = jsExpr.replace(regex, val.toString());
    }

    const sandbox = {
      Math,
      round: (val: number, decimals: number = 0) => {
        const factor = Math.pow(10, decimals);
        return Math.round(val * factor) / factor;
      },
    };

    try {
      const script = new vm.Script(jsExpr);
      const result = script.runInNewContext(sandbox);
      return Number(result);
    } catch (err) {
      this.logger.error(`Lỗi đánh giá công thức: ${formula} -> ${jsExpr}. Lỗi: ${err.message}`);
      throw err;
    }
  }

  adjustBackDate(date: Date): Date {
    const day = date.getDay(); // 0: Sunday, 6: Saturday
    const newDate = new Date(date);
    if (day === 6) {
      newDate.setDate(newDate.getDate() - 1);
    } else if (day === 0) {
      newDate.setDate(newDate.getDate() - 2);
    }
    return newDate;
  }

  adjustForwardDate(date: Date): Date {
    const day = date.getDay(); // 0: Sunday, 6: Saturday
    const newDate = new Date(date);
    if (day === 6) {
      newDate.setDate(newDate.getDate() + 2);
    } else if (day === 0) {
      newDate.setDate(newDate.getDate() + 1);
    }
    return newDate;
  }

  async sendEmailNotification(
    config: any,
    toEmails: string[],
    subject: string,
    htmlBody: string,
    attachments: Array<{ filename: string; content: Buffer }> = [],
  ) {
    const smtp = config.smtp || {
      host: 'smtp.office365.com',
      port: 587,
      user: 'it.support@mxv.vn',
      pass: 'OFmng239',
      senderEmail: 'it.support@mxv.vn',
      senderName: 'MXV IT Support',
    };

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
        tls: {
          ciphers: 'SSLv3',
          rejectUnauthorized: false,
        },
      });

      const info = await transporter.sendMail({
        from: `"${smtp.senderName}" <${smtp.senderEmail}>`,
        to: toEmails.join(', '),
        subject: subject,
        html: htmlBody,
        attachments: attachments,
      });

      this.logger.log(`Email đã gửi thành công: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      this.logger.error(`Lỗi gửi mail: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  async sendTelegramNotification(chatId: string, message: string) {
    if (!chatId) return;
    try {
      await this.telegramService.sendMessage(message);
      this.logger.log(`Đã gửi cảnh báo Telegram đến chat ID: ${chatId}`);
    } catch (err) {
      this.logger.error(`Lỗi gửi Telegram: ${err.message}`);
    }
  }

  // File parsers
  parseMarketData(buffer: Buffer): Array<{ MaHD: string; GTT: number }> {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 1) throw new Error("File market.csv không có dữ liệu");

    const headers = lines[0].split(',').map((h: any) => String(h || '').trim().replace(/"/g, ''));
    const maHDIndex = headers.findIndex((h: any) => h.toLowerCase() === 'mã hợp đồng');
    const gttIndex = headers.findIndex((h: any) => h.toLowerCase() === 'giá thanh toán');

    if (maHDIndex === -1 || gttIndex === -1) {
      throw new Error("Không tìm thấy cột 'Mã hợp đồng' hoặc 'Giá thanh toán' trong file market.csv");
    }

    const result: Array<{ MaHD: string; GTT: number }> = [];
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map((c: any) => String(c || '').trim().replace(/"/g, ''));
      if (columns.length <= Math.max(maHDIndex, gttIndex)) continue;

      const maHD = columns[maHDIndex];
      const gttRaw = columns[gttIndex];
      const gtt = parseFloat(gttRaw);

      if (maHD && !isNaN(gtt)) {
        result.push({ MaHD: maHD, GTT: gtt });
      }
    }
    return result;
  }

  parseCommodities(buffers: Buffer[]): any[] {
    const result: any[] = [];
    for (const buffer of buffers) {
      if (!buffer) continue;
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) continue;

      const headers = rows[0].map((h: any) => String(h || '').trim());
      const maHangHoaIndex = headers.findIndex((h: any) => h.toLowerCase() === 'mã hàng hóa');
      const tenHangHoaIndex = headers.findIndex((h: any) => h.toLowerCase() === 'tên hàng hóa');
      const soGDIndex = headers.findIndex((h: any) => h.toLowerCase() === 'sở giao dịch');
      const tienTeIndex = headers.findIndex((h: any) => h.toLowerCase() === 'tiền tệ');
      const donViYetGiaIndex = headers.findIndex((h: any) => h.toLowerCase().startsWith('đơn vị yết giá'));
      const doLonHDIndex = headers.findIndex((h: any) => h.toLowerCase() === 'độ lớn hđ');
      const mucKyQuyNgoaiTeIndex = headers.findIndex((h: any) => h.toLowerCase() === 'mức ký quý ban đầu mxv(ngoại tệ)');

      if (maHangHoaIndex === -1 || tenHangHoaIndex === -1 || soGDIndex === -1 ||
          tienTeIndex === -1 || donViYetGiaIndex === -1 || doLonHDIndex === -1 ||
          mucKyQuyNgoaiTeIndex === -1) {
        throw new Error("Không tìm thấy đủ các cột trong file danh sách hàng hóa");
      }

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const maHangHoa = String(row[maHangHoaIndex] || '').trim();
        const tenHangHoa = String(row[tenHangHoaIndex] || '').trim();
        const soGD = String(row[soGDIndex] || '').trim();
        const tienTe = String(row[tienTeIndex] || '').trim();
        const donViYetGia = parseFloat(String(row[donViYetGiaIndex]).replace(/,/g, ''));
        const doLonHD = parseFloat(String(row[doLonHDIndex]).replace(/,/g, ''));
        const mucKyQuyNgoaiTe = parseFloat(String(row[mucKyQuyNgoaiTeIndex]).replace(/,/g, ''));

        if (maHangHoa && tenHangHoa && soGD && tienTe && !isNaN(donViYetGia) && !isNaN(doLonHD) && !isNaN(mucKyQuyNgoaiTe)) {
          result.push({
            MaHangHoa: maHangHoa,
            TenHangHoa: tenHangHoa,
            SoGD: soGD,
            TienTe: tienTe,
            DonViYetGia: donViYetGia,
            DoLonHD: doLonHD,
            MucKyQuyNgoaiTe: mucKyQuyNgoaiTe,
          });
        }
      }
    }
    return result;
  }

  parseContracts(buffers: Buffer[]): any[] {
    const result: any[] = [];
    for (const buffer of buffers) {
      if (!buffer) continue;
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) continue;

      const headers = rows[0].map((h: any) => String(h || '').trim());
      const maHDIndex = headers.findIndex((h: any) => h.toLowerCase() === 'mã hđ');
      const maHHIndex = headers.findIndex((h: any) => h.toLowerCase() === 'mã hàng hóa');
      const ngayGDCuoiCungIndex = headers.findIndex((h: any) => h.toLowerCase() === 'ngày giao dịch cuối cùng');
      const trangThaiIndex = headers.findIndex((h: any) => h.toLowerCase() === 'trạng thái');

      if (maHDIndex === -1 || maHHIndex === -1 || ngayGDCuoiCungIndex === -1 || trangThaiIndex === -1) {
        throw new Error("Không tìm thấy đủ các cột trong file hợp đồng");
      }

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const maHD = String(row[maHDIndex] || '').trim();
        const maHangHoa = String(row[maHHIndex] || '').trim();
        const ngayGDCuoiCung = String(row[ngayGDCuoiCungIndex] || '').trim();
        const trangThai = String(row[trangThaiIndex] || '').trim();

        if (maHD && maHangHoa && ngayGDCuoiCung && trangThai) {
          result.push({
            MaHD: maHD,
            MaHangHoa: maHangHoa,
            NgayGDCuoiCung: ngayGDCuoiCung,
            TrangThai: trangThai,
          });
        }
      }
    }
    return result;
  }

  parseCommodityMargin(buffers: Buffer[]): any[] {
    const result: any[] = [];
    for (const buffer of buffers) {
      if (!buffer) continue;
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length < 2) continue;

      const headers = rows[0].map((h: any) => String(h || '').trim());
      const maHangHoaIndex = headers.findIndex((h: any) => h.toLowerCase() === 'mã hàng hóa');
      const marginIndex = headers.findIndex((h: any) => h.toLowerCase() === 'mức ký quý ban đầu mxv(ngoại tệ)');

      if (maHangHoaIndex === -1 || marginIndex === -1) {
        throw new Error("Không tìm thấy đủ các cột trong file hàng hóa margin");
      }

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0) continue;

        const maHangHoa = String(row[maHangHoaIndex] || '').trim();
        const marginVal = parseFloat(String(row[marginIndex]).replace(/,/g, ''));

        if (maHangHoa && !isNaN(marginVal)) {
          result.push({
            MaHangHoa: maHangHoa,
            Margin: marginVal,
          });
        }
      }
    }
    return result;
  }

  parseCommodityConfig(buffer?: Buffer): any[] {
    let wb: XLSX.WorkBook;
    if (buffer) {
      wb = XLSX.read(buffer, { type: 'buffer' });
    } else {
      const defaultPath = path.resolve(
        __dirname,
        '../../../../it-tool-src/margin-checker/margin-checker/bin/Debug/Configuration/Commodity.xlsx',
      );
      if (fs.existsSync(defaultPath)) {
        wb = XLSX.readFile(defaultPath);
      } else {
        throw new Error('Không tìm thấy cấu hình Commodity.xlsx mặc định');
      }
    }
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (rows.length < 2) throw new Error('File Commodity.xlsx không có dữ liệu');

    const headers = rows[0].map((h: any) => String(h || '').trim());
    const tenHangHoaIndex = headers.findIndex((h: any) => h.toLowerCase() === 'tên hàng hóa');
    const maHangHoaIndex = headers.findIndex((h: any) => h.toLowerCase() === 'mã hàng hóa');
    const nhomHangHoaIndex = headers.findIndex((h: any) => h.toLowerCase().startsWith('nhóm hàng hóa'));
    const soGDIndex = headers.findIndex((h: any) => h.toLowerCase() === 'sở giao dịch hàng hóa có liên thông');
    const tienTeIndex = headers.findIndex((h: any) => h.toLowerCase() === 'tiền tệ');
    const congThucIndex = headers.findIndex((h: any) => h.toLowerCase().startsWith('công thức'));
    const productCodeIndex = headers.findIndex((h: any) => h.toLowerCase() === 'product code');
    const combinedCommodityIndex = headers.findIndex((h: any) => h.toLowerCase() === 'combined commodity');
    const tyLeEx1Index = headers.findIndex((h: any) => h.toLowerCase() === 'tỷ lệ exchange 1');
    const tyLeEx2Index = headers.findIndex((h: any) => h.toLowerCase() === 'tỷ lệ exchange 2');

    if (
      maHangHoaIndex === -1 ||
      tenHangHoaIndex === -1 ||
      soGDIndex === -1 ||
      tienTeIndex === -1 ||
      nhomHangHoaIndex === -1 ||
      congThucIndex === -1 ||
      productCodeIndex === -1 ||
      combinedCommodityIndex === -1 ||
      tyLeEx1Index === -1 ||
      tyLeEx2Index === -1
    ) {
      throw new Error('Không tìm thấy đủ các cột trong file Commodity.xlsx');
    }

    const result: any[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;

      const maHangHoa = String(row[maHangHoaIndex] || '').trim();
      const tenHangHoa = String(row[tenHangHoaIndex] || '').trim();
      const soGD = String(row[soGDIndex] || '').trim();
      const tienTe = String(row[tienTeIndex] || '').trim();
      const nhomHH = String(row[nhomHangHoaIndex] || '').trim();
      const congThuc = String(row[congThucIndex] || '').trim();
      const productCode = String(row[productCodeIndex] || '').trim();
      const combinedCommodity = String(row[combinedCommodityIndex] || '').trim();
      const tyLeEx1 = String(row[tyLeEx1Index] || '').trim();
      const tyLeEx2 = String(row[tyLeEx2Index] || '').trim();

      if (maHangHoa && tenHangHoa && soGD && tienTe && nhomHH && combinedCommodity) {
        result.push({
          MaHangHoa: maHangHoa,
          TenHangHoa: tenHangHoa,
          SoGD: soGD,
          TienTe: tienTe,
          NhomHH: nhomHH,
          CongThuc: congThuc,
          ProductCode: productCode,
          CombinedCommodity: combinedCommodity,
          TyLeEx1: tyLeEx1,
          TyLeEx2: tyLeEx2,
        });
      }
    }
    return result;
  }

  // CME PDF and Excel parser
  async getCMEData(excelBuffer: Buffer, pdfBuffer: Buffer) {
    const contents: any[] = [];
    let outrights: any[] = [];
    const maintenanceItems: any[] = [];

    const wb = XLSX.read(excelBuffer, { type: 'buffer' });
    const tocSheet = wb.Sheets['Table of Contents'];
    if (tocSheet) {
      const rows: any[] = XLSX.utils.sheet_to_json(tocSheet, { header: 1 });
      if (rows.length > 8) {
        const headers = rows[7].map((h: any) => String(h || '').trim());
        const combinedCommodityIndex = headers.findIndex((h: any) => h.toLowerCase() === 'combined commodity');
        const productCodeIndex = headers.findIndex((h: any) => h.toLowerCase() === 'product code');
        const nameIndex = headers.findIndex((h: any) => h.toLowerCase() === 'name');
        const scalingFactorIndex = headers.findIndex((h: any) => h.toLowerCase() === 'scaling factor');

        if (combinedCommodityIndex !== -1 && productCodeIndex !== -1 && nameIndex !== -1 && scalingFactorIndex !== -1) {
          for (let r = 8; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            const combinedCommodity = String(row[combinedCommodityIndex] || '').trim();
            const productCode = String(row[productCodeIndex] || '').trim();
            const name = String(row[nameIndex] || '').trim();
            const scalingFactor = parseFloat(String(row[scalingFactorIndex]).replace(/,/g, ''));

            if (combinedCommodity && productCode && name && !isNaN(scalingFactor)) {
              contents.push({
                CombinedCommodity: combinedCommodity,
                ProductCode: productCode,
                Name: name,
                ScalingFactor: scalingFactor,
              });
            }
          }
        }
      }
    }

    const outrightSheet = wb.Sheets['Outright'];
    if (outrightSheet) {
      const rows: any[] = XLSX.utils.sheet_to_json(outrightSheet, { header: 1 });
      if (rows.length > 4) {
        const headers = rows[3].map((h: any) => String(h || '').trim());
        const combinedCommodityIndex = headers.findIndex((h: any) => h.toLowerCase() === 'combined commodity');
        const newMarginIndex = headers.findIndex((h: any) => h.toLowerCase() === 'new margin');

        if (combinedCommodityIndex !== -1 && newMarginIndex !== -1) {
          const tempOutrights: any[] = [];
          for (let r = 4; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            const combinedCommodity = String(row[combinedCommodityIndex] || '').trim();
            const newMargin = parseFloat(String(row[newMarginIndex]).replace(/,/g, ''));

            if (combinedCommodity && !isNaN(newMargin)) {
              tempOutrights.push({
                CombinedCommodity: combinedCommodity,
                NewMargin: newMargin,
              });
            }
          }

          const groups = new Map<string, number>();
          for (const item of tempOutrights) {
            const current = groups.get(item.CombinedCommodity) || 0;
            if (item.NewMargin > current) {
              groups.set(item.CombinedCommodity, item.NewMargin);
            }
          }
          outrights = Array.from(groups.entries()).map(([CombinedCommodity, NewMargin]) => ({
            CombinedCommodity,
            NewMargin,
          }));
        }
      }
    }

    const seen = new Set<string>();
    const pdf = new PDFParse({ data: pdfBuffer });
    await (pdf as any).load();
    const text = (await pdf.getText()).text;
    const regex = /^([A-Z0-9]{2,5})\b.*?\bUSD\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)/gm;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const cc = match[1].trim();
      const newMaintStr = match[5].replace(/,/g, '');
      const newMaintenance = parseFloat(newMaintStr);
      if (!seen.has(cc) && !isNaN(newMaintenance)) {
        maintenanceItems.push({
          CC: cc,
          NewMaintenance: newMaintenance,
        });
        seen.add(cc);
      }
    }

    return { contents, outrights, maintenanceItems };
  }

  // ICE parser
  getICEData(buffers: Buffer[]): any[] {
    const iceData: any[] = [];
    for (const buffer of buffers) {
      if (!buffer) continue;
      const text = buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) continue;

      const headers = lines[0].split(',').map((h: any) => String(h || '').trim().replace(/"/g, ''));
      const logicalCommodityCodeIndex = headers.findIndex((h: any) => h.toLowerCase() === 'logical commodity code');
      const newAppliedMarginRateIndex = headers.findIndex((h: any) => h.toLowerCase() === 'new applied margin rate');

      if (logicalCommodityCodeIndex === -1 || newAppliedMarginRateIndex === -1) {
        throw new Error('Không tìm thấy đủ các cột trong file ICE');
      }

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p: any) => String(p || '').trim().replace(/"/g, ''));
        if (parts.length <= Math.max(logicalCommodityCodeIndex, newAppliedMarginRateIndex)) continue;

        const logicalCommodityCode = parts[logicalCommodityCodeIndex];
        const newAppliedMarginRate = parseFloat(parts[newAppliedMarginRateIndex].replace(/,/g, ''));

        if (logicalCommodityCode && !isNaN(newAppliedMarginRate)) {
          iceData.push({
            LogicalCommodityCode: logicalCommodityCode,
            NewAppliedMarginRate: newAppliedMarginRate,
          });
        }
      }
    }

    const groups = new Map<string, number>();
    for (const item of iceData) {
      const current = groups.get(item.LogicalCommodityCode) || 0;
      if (item.NewAppliedMarginRate > current) {
        groups.set(item.LogicalCommodityCode, item.NewAppliedMarginRate);
      }
    }
    return Array.from(groups.entries()).map(([LogicalCommodityCode, NewAppliedMarginRate]) => ({
      LogicalCommodityCode,
      NewAppliedMarginRate,
    }));
  }

  // SGX Excel parser
  getSGXData(excelBuffer: Buffer): any[] {
    const sgxData: any[] = [];
    const wb = XLSX.read(excelBuffer, { type: 'buffer' });
    const ws = wb.Sheets['Outright Margin'];
    if (ws) {
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length > 1) {
        const headers = rows[0].map((h: any) => String(h || '').trim());
        const contractCodeIndex = headers.findIndex((h: any) => h.toLowerCase() === 'contract code');
        const initialMarginIndex = headers.findIndex((h: any) => h.toLowerCase() === 'initial margin');

        if (contractCodeIndex !== -1 && initialMarginIndex !== -1) {
          for (let r = 1; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            const contractCode = String(row[contractCodeIndex] || '').trim();
            const initialMargin = parseFloat(String(row[initialMarginIndex]).replace(/,/g, ''));
            if (contractCode && !isNaN(initialMargin)) {
              sgxData.push({
                ContractCode: contractCode,
                InitialMargin: initialMargin,
              });
            }
          }
        }
      }
    }

    const groups = new Map<string, number>();
    for (const item of sgxData) {
      const current = groups.get(item.ContractCode) || 0;
      if (item.InitialMargin > current) {
        groups.set(item.ContractCode, item.InitialMargin);
      }
    }
    return Array.from(groups.entries()).map(([ContractCode, InitialMargin]) => ({
      ContractCode,
      InitialMargin,
    }));
  }

  // JPX CSV parser
  getJPXData(csvBuffer: Buffer): any[] {
    const jpxData: any[] = [];
    const text = csvBuffer.toString('utf-8');
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 1) throw new Error('File JPX Excel.csv không có dữ liệu');

    const headers = lines[0].split(',').map((h: any) => String(h || '').trim().replace(/"/g, ''));
    const combinedCommodityGroupIndex = headers.findIndex((h: any) => h.toLowerCase() === 'combined commodity group');
    const bplIndex = headers.findIndex((h: any) => h.toLowerCase() === 'bpl');

    if (combinedCommodityGroupIndex === -1 || bplIndex === -1) {
      throw new Error('Không tìm thấy cột trong JPX Excel.csv');
    }

    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map((c: any) => String(c || '').trim().replace(/"/g, ''));
      if (columns.length <= Math.max(combinedCommodityGroupIndex, bplIndex)) continue;

      const combinedCommodityGroup = columns[combinedCommodityGroupIndex];
      const bpl = parseFloat(columns[bplIndex].replace(/,/g, ''));
      if (combinedCommodityGroup && !isNaN(bpl)) {
        jpxData.push({
          CombinedCommodityGroup: combinedCommodityGroup,
          BPL: bpl,
        });
      }
    }

    const groups = new Map<string, number>();
    for (const item of jpxData) {
      const current = groups.get(item.CombinedCommodityGroup) || 0;
      if (item.BPL > current) {
        groups.set(item.CombinedCommodityGroup, item.BPL);
      }
    }
    return Array.from(groups.entries()).map(([CombinedCommodityGroup, BPL]) => ({
      CombinedCommodityGroup,
      BPL,
    }));
  }

  // LME Excel parser
  getLMEData(excelBuffer: Buffer): any[] {
    const lmeData: any[] = [];
    const wb = XLSX.read(excelBuffer, { type: 'buffer' });
    const ws = wb.Sheets['Summary Parameters'];
    if (ws) {
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (rows.length > 7) {
        const row5 = rows[5] || [];
        const row6 = rows[6] || [];

        let codeIndex = -1;
        let perLotIndex = -1;

        for (let col = 0; col < Math.max(row5.length, row6.length); col++) {
          const h1 = String(row5[col] || '').trim();
          if (h1.toLowerCase() === 'code') codeIndex = col;
          const h2 = String(row6[col] || '').trim();
          if (h2.toLowerCase() === '$ per lot') perLotIndex = col;
        }

        if (codeIndex !== -1 && perLotIndex !== -1) {
          for (let r = 7; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            const code = String(row[codeIndex] || '').trim();
            const perLot = parseFloat(String(row[perLotIndex]).replace(/,/g, ''));
            if (code && !isNaN(perLot)) {
              lmeData.push({
                Code: code,
                PerLot: perLot,
              });
            }
          }
        }
      }
    }

    const groups = new Map<string, number>();
    for (const item of lmeData) {
      const current = groups.get(item.Code) || 0;
      if (item.PerLot > current) {
        groups.set(item.Code, item.PerLot);
      }
    }
    return Array.from(groups.entries()).map(([Code, PerLot]) => ({
      Code,
      PerLot,
    }));
  }

  async getBursaData(bursaBuffer: Buffer): Promise<any[]> {
    const bursaData: any[] = [];
    const bursaPdf = new PDFParse({ data: bursaBuffer });
    await (bursaPdf as any).load();
    const text = (await bursaPdf.getText()).text;
    const lines = text.split('\n').map((l: any) => l.trim()).filter(Boolean);
    let inCommodityTable = false;
    for (const line of lines) {
      if (line.toLowerCase().startsWith('commodity')) {
        inCommodityTable = true;
        continue;
      }
      if (inCommodityTable && line.toLowerCase().startsWith('cpo intracommodity')) {
        inCommodityTable = false;
        break;
      }
      if (inCommodityTable) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const cc = parts[0];
          const nums = parts.slice(1).map((p: any) => {
            const d = parseFloat(p.replace(/,/g, ''));
            return isNaN(d) ? null : d;
          });
          bursaData.push({
            CombinedCommodity: cc,
            SPANPriceScanRange: nums[0] ?? 0,
          });
        }
      }
    }
    return bursaData;
  }

  // Check margin on order (Báo cáo vi phạm mức ký quỹ)
  async checkMargin(files: {
    futures?: Buffer;
    lme?: Buffer;
    acm?: Buffer;
    options?: Buffer;
    market?: Buffer;
    commodityConfig?: Buffer;
  }) {
    const config = await this.loadConfig();
    const now = new Date();
    const timeStr = this.formatDateString(now, 'ddMMyy_HHmm');
    const longDateTime = now.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const current = this.adjustBackDate(now);
    const yesterday = this.adjustBackDate(new Date(current.getTime() - 24 * 60 * 60 * 1000));
    const tomorrow = this.adjustForwardDate(new Date(current.getTime() + 24 * 60 * 60 * 1000));

    const currentStr = this.formatDateString(current, 'dd/MM/yyyy');
    const yesterdayStr = this.formatDateString(yesterday, 'dd/MM/yyyy');
    const tomorrowStr = this.formatDateString(tomorrow, 'dd/MM/yyyy');

    if (!files.futures || !files.lme || !files.acm || !files.market) {
      throw new Error('Thiếu các file bắt buộc: DSHHFutures, DSHHLME, DSHHACM hoặc MarketData');
    }

    const commodities = this.parseCommodities([files.futures, files.lme, files.acm]);
    const contracts = this.parseContracts([files.futures, files.lme, files.acm]);
    const market = this.parseMarketData(files.market);
    const commodityConfig = this.parseCommodityConfig(files.commodityConfig);

    const marginData: any[] = [];
    for (const commodity of commodities) {
      const relatedContracts = contracts
        .filter((c: any) => c.MaHangHoa === commodity.MaHangHoa && c.TrangThai === 'Hoạt động')
        .map((c: any) => {
          const parsed = this.parseDate(c.NgayGDCuoiCung);
          return {
            Contract: c,
            ParsedDate: parsed,
          };
        })
        .filter((c: any) => c.ParsedDate !== null)
        .sort(
          (a: any, b: any) =>
            Math.abs(a.ParsedDate!.getTime() - now.getTime()) -
            Math.abs(b.ParsedDate!.getTime() - now.getTime()),
        );

      let chosenContract = null;
      if (relatedContracts.length > 0) {
        chosenContract = relatedContracts[0].Contract;
      }

      const specialCodes = ['LALZ', 'LDKZ', 'LEDZ', 'LNIZ', 'LTIZ', 'LZHZ'];
      const matchedItem = specialCodes.includes(commodity.MaHangHoa)
        ? market.find((m: any) => m.MaHD === commodity.MaHangHoa)
        : chosenContract
        ? market.find((m: any) => m.MaHD === chosenContract.MaHD)
        : null;

      if (matchedItem) {
        marginData.push({
          MaHangHoa: commodity.MaHangHoa,
          TenHangHoa: commodity.TenHangHoa,
          SoGD: commodity.SoGD,
          TienTe: commodity.TienTe,
          DonViYetGia: commodity.DonViYetGia,
          DoLonHD: commodity.DoLonHD,
          MucKyQuyNgoaiTe: commodity.MucKyQuyNgoaiTe,
          MaHD: chosenContract ? chosenContract.MaHD : commodity.MaHangHoa,
          GTT: matchedItem.GTT,
        });
      }
    }

    const excelData: any[] = [];
    const warningData: any[] = [];
    const warningRate = config.marginOnOrder.warningRate / 100;

    const commodityDict = new Map<string, any>();
    for (const c of commodityConfig) {
      if (!commodityDict.has(c.MaHangHoa)) {
        commodityDict.set(c.MaHangHoa, c);
      }
    }

    for (const item of marginData) {
      const comConfig = commodityDict.get(item.MaHangHoa);
      if (!comConfig) continue;

      const giaTriHH = item.GTT * item.DoLonHD * item.DonViYetGia;
      const tyLeEx1 = parseFloat(comConfig.TyLeEx1) || 1;
      const tyLeEx2 = parseFloat(comConfig.TyLeEx2) || 1;
      const kqExchangeApDung = giaTriHH * tyLeEx1 * tyLeEx2;

      const data = {
        PhienGD: currentStr,
        MaHangHoa: item.MaHangHoa,
        TenHangHoa: item.TenHangHoa,
        SoGD: item.SoGD,
        KyQuyBD: item.MucKyQuyNgoaiTe,
        KyQuyKH: item.MucKyQuyNgoaiTe * 1.2,
        TienTe: item.TienTe,
        GTT: item.GTT,
        MucKQTruoc: item.MucKyQuyNgoaiTe / giaTriHH,
        MucKQSau: (item.MucKyQuyNgoaiTe * 1.2) / giaTriHH,
        GiaTriHH: giaTriHH,
        DoLonHD: item.DoLonHD,
        DonViYetGia: item.DonViYetGia,
        KQExchangeApDung: kqExchangeApDung,
        TyTrongKQExchangeApDung: kqExchangeApDung / giaTriHH,
        ChenhMxvExchange: (item.MucKyQuyNgoaiTe - kqExchangeApDung) / kqExchangeApDung,
      };

      excelData.push(data);
      if (data.MucKQSau < warningRate) {
        warningData.push(data);
      }
    }

    const excelReportBuffer = this.exportMarginCheckingExcel(
      excelData,
      yesterdayStr,
      tomorrowStr,
      timeStr,
    );

    if (config.marginOnOrder.isSendWarning && warningData.length > 0) {
      // Send Email
      const subject =
        'MXV Margin Checker – Cảnh báo hàng hóa vi phạm tỷ lệ Mức ký quỹ trên giá trị lệnh';
      let tableHtml =
        "<table border='1' cellpadding='5' cellspacing='0' style='border-collapse:collapse;'>";
      tableHtml +=
        '<thead><tr>' +
        '<th>STT</th>' +
        '<th>Mã Hàng Hóa</th>' +
        '<th>Mức ký quỹ trên trị giá từng lệnh (trước x 1.2)</th>' +
        '<th>Mức ký quỹ trên trị giá từng lệnh (sau x 1.2)</th>' +
        '</tr></thead><tbody>';

      let stt = 1;
      for (const item of warningData) {
        tableHtml +=
          `<tr>` +
          `<td>${stt}</td>` +
          `<td>${item.MaHangHoa}</td>` +
          `<td>${(item.MucKQTruoc * 100).toFixed(2)}%</td>` +
          `<td>${(item.MucKQSau * 100).toFixed(2)}%</td>` +
          `</tr>`;
        stt++;
      }
      tableHtml += '</tbody></table>';

      const emailBody =
        `<p>MXV Margin Checker – Cảnh báo hàng hóa vi phạm tỷ lệ Mức ký quỹ trên giá trị lệnh (${currentStr})</p>` +
        `<p>Hệ thống MXV Margin Checker cảnh báo: Có <strong>${warningData.length}</strong> hàng hóa vi phạm tỷ lệ Mức ký quỹ trên giá trị lệnh ngày phiên <strong>${currentStr}</strong>.</p>` +
        tableHtml +
        `<p><em>Lưu ý: Đây là thư gửi tự động từ hệ thống, vui lòng không trả lời thư này.</em></p><p>Trân trọng,<br>MXV.</p>`;

      const attachments = [
        {
          filename: `Check muc ky quy hang hoa_${timeStr}.xlsx`,
          content: excelReportBuffer,
        },
      ];

      await this.sendEmailNotification(
        config,
        config.marginOnOrder.email,
        subject,
        emailBody,
        attachments,
      );

      // Send Telegram Alert
      if (config.marginOnOrder.telegramChatId) {
        const teleMessage =
          `⚠️ *[MXV Margin Checker]* Cảnh báo vi phạm mức ký quỹ\n` +
          `📅 Ngày phiên: ${currentStr}\n` +
          `🔴 Số lượng vi phạm: ${warningData.length} hàng hóa\n` +
          `Vui lòng kiểm tra email hệ thống để xem chi tiết báo cáo đính kèm.`;
        await this.sendTelegramNotification(config.marginOnOrder.telegramChatId, teleMessage);
      }
    }

    return {
      success: true,
      warningCount: warningData.length,
      lastCheck: longDateTime,
      excelReportBase64: excelReportBuffer.toString('base64'),
      excelReportFilename: `Check muc ky quy hang hoa_${timeStr}.xlsx`,
      data: excelData,
    };
  }

  // Check margin changes from exchanges
  async checkMarginChange(files: {
    cmeExcel?: Buffer;
    cmePdf?: Buffer;
    iceEUAg?: Buffer;
    iceSG?: Buffer;
    iceUS?: Buffer;
    bursaPdf?: Buffer;
    sgxExcel?: Buffer;
    jpxExcel?: Buffer;
    lmeExcel?: Buffer;
    futures?: Buffer;
    lmeMargin?: Buffer;
    options?: Buffer;
    commodityConfig?: Buffer;
  }) {
    const config = await this.loadConfig();
    const now = new Date();
    const timeStr = this.formatDateString(now, 'ddMMyy_HHmm');
    const longDateTime = now.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const cmeData =
      files.cmeExcel && files.cmePdf
        ? await this.getCMEData(files.cmeExcel, files.cmePdf)
        : { contents: [], outrights: [], maintenanceItems: [] };

    const iceData =
      files.iceEUAg || files.iceSG || files.iceUS
        ? this.getICEData([files.iceEUAg, files.iceSG, files.iceUS].filter(Boolean) as Buffer[])
        : [];

    const bursaData = files.bursaPdf ? await this.getBursaData(files.bursaPdf) : [];
    const sgxData = files.sgxExcel ? this.getSGXData(files.sgxExcel) : [];
    const jpxData = files.jpxExcel ? this.getJPXData(files.jpxExcel) : [];
    const lmeData = files.lmeExcel ? this.getLMEData(files.lmeExcel) : [];

    const commodityMargin =
      files.futures || files.lmeMargin || files.options
        ? this.parseCommodityMargin([files.futures, files.lmeMargin, files.options].filter(Boolean) as Buffer[])
        : [];

    const commodityConfig = this.parseCommodityConfig(files.commodityConfig);

    const excelData: any[] = [];
    for (const c of commodityConfig) {
      let kyQuy = 0;
      let foundData = null;

      const dataSources = [
        () => lmeData.find((x: any) => x.Code === c.CombinedCommodity),
        () => jpxData.find((x: any) => x.CombinedCommodityGroup === c.CombinedCommodity),
        () => sgxData.find((x: any) => x.ContractCode === c.CombinedCommodity),
        () => bursaData.find((x: any) => x.CombinedCommodity === c.CombinedCommodity),
        () => iceData.find((x: any) => x.LogicalCommodityCode === c.CombinedCommodity),
        () => cmeData.maintenanceItems.find((x: any) => x.CC === c.CombinedCommodity),
        () => {
          if (!c.ProductCode) return null;
          const content = cmeData.contents.find(
            (x: any) => x.CombinedCommodity === c.CombinedCommodity && x.ProductCode === c.ProductCode,
          );
          const outright = cmeData.outrights.find(
            (x: any) => x.CombinedCommodity === c.CombinedCommodity,
          );
          if (content && outright) {
            content.NewMargin = outright.NewMargin;
          }
          return content;
        },
      ];

      for (const getData of dataSources) {
        foundData = getData();
        if (!foundData) continue;

        const formula = c.CongThuc;
        // Build numeric variables context
        const context: Record<string, number> = {};
        for (const [key, val] of Object.entries(foundData)) {
          if (typeof val === 'number') {
            context[key] = val;
          }
        }

        try {
          kyQuy = this.evaluateFormula(formula, context);
          break;
        } catch (err) {
          this.logger.error(
            `Lỗi EvaluateFormula cho ${c.MaHangHoa}: ${err.message}`,
          );
          foundData = null;
        }
      }

      if (!foundData) {
        const cm = commodityMargin.find(x => x.MaHangHoa === c.MaHangHoa);
        if (cm) {
          kyQuy = cm.Margin;
          foundData = cm;
        }
      }

      excelData.push({
        TenHangHoa: c.TenHangHoa,
        MaHangHoa: c.MaHangHoa,
        NhomHH: c.NhomHH,
        SoGD: c.SoGD,
        KyQuy: kyQuy,
        TienTe: c.TienTe,
        IsNew: false,
      });
    }

    // Compare with current values to identify changes
    for (const item of excelData) {
      const matched = commodityMargin.find(m => m.MaHangHoa === item.MaHangHoa);
      if (matched && item.KyQuy !== matched.Margin) {
        item.IsNew = true;
      }
    }

    const countNew = excelData.filter(x => x.IsNew).length;
    const excelReportBuffer = this.exportMarginChangeExcel(excelData);

    if (config.marginChange.isSendWarning && countNew > 0) {
      // Send Email
      const subject = 'MXV Margin Checker – Cảnh báo thay đổi Mức ký quỹ';
      let tableHtml =
        "<table border='1' cellpadding='5' cellspacing='0' style='border-collapse:collapse;'>";
      tableHtml +=
        '<thead><tr>' +
        '<th>STT</th>' +
        '<th>Mã Hàng Hóa</th>' +
        '<th>Mức ký quỹ mới</th>' +
        '</tr></thead><tbody>';

      let stt = 1;
      for (const item of excelData) {
        if (item.IsNew) {
          tableHtml +=
            `<tr>` +
            `<td>${stt}</td>` +
            `<td>${item.MaHangHoa}</td>` +
            `<td>${item.KyQuy.toLocaleString('en-US', { maximumFractionDigits: 2 })}</td>` +
            `</tr>`;
          stt++;
        }
      }
      tableHtml += '</tbody></table>';

      const emailBody =
        `<p>MXV Margin Checker – Cảnh báo thay đổi Mức ký quỹ (${this.formatDateString(now, 'dd/MM/yyyy')})</p>` +
        `<p>Hệ thống MXV Margin Checker cảnh báo: Có <strong>${countNew}</strong> hàng hóa thay đổi Mức ký quỹ từ các Sở ngày phiên <strong>${this.formatDateString(now, 'dd/MM/yyyy')}</strong>.</p>` +
        tableHtml +
        `<p><em>Lưu ý: Đây là thư gửi tự động từ hệ thống, vui lòng không trả lời thư này.</em></p><p>Trân trọng,<br>MXV.</p>`;

      const attachments = [
        {
          filename: `Check thay doi ky quy_${timeStr}.xlsx`,
          content: excelReportBuffer,
        },
      ];

      await this.sendEmailNotification(
        config,
        config.marginChange.email,
        subject,
        emailBody,
        attachments,
      );

      // Send Telegram Alert
      if (config.marginChange.telegramChatId) {
        const teleMessage =
          `⚠️ *[MXV Margin Checker]* Cảnh báo thay đổi mức ký quỹ\n` +
          `📅 Ngày phiên: ${this.formatDateString(now, 'dd/MM/yyyy')}\n` +
          `🔵 Số lượng thay đổi: ${countNew} hàng hóa\n` +
          `Vui lòng kiểm tra email hệ thống để xem chi tiết báo cáo thay đổi đính kèm.`;
        await this.sendTelegramNotification(config.marginChange.telegramChatId, teleMessage);
      }
    }

    return {
      success: true,
      warningCount: countNew,
      lastCheck: longDateTime,
      excelReportBase64: excelReportBuffer.toString('base64'),
      excelReportFilename: `Check thay doi ky quy_${timeStr}.xlsx`,
      data: excelData,
    };
  }

  // Internal Helpers
  private formatDateString(date: Date, format: string): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).substring(2);
    const yyyy = String(date.getFullYear());
    const HH = String(date.getHours()).padStart(2, '0');
    const MM = String(date.getMinutes()).padStart(2, '0');

    return format
      .replace('dd', dd)
      .replace('MM', mm)
      .replace('yyyy', yyyy)
      .replace('yy', yy)
      .replace('HH', HH)
      .replace('mm', MM);
  }

  private parseDate(str: string): Date | null {
    if (!str) return null;
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }

  exportMarginCheckingExcel(
    reportData: any[],
    yesterdayStr: string,
    tomorrowStr: string,
    timeStr: string,
  ): Buffer {
    const wb = XLSX.utils.book_new();
    const aoa: any[][] = [];

    aoa[0] = [];
    aoa[0][0] = 'Update phiên giao dịch có ban hành KQ';
    aoa[0][4] = 'Hiệu lực áp dụng từ phiên';
    aoa[0][7] = 'Update GTT phiên liền trước';
    aoa[0][8] = 'Lớn hơn 5%: ban hành';

    aoa[1] = [];
    aoa[1][8] = 'Nhỏ hơn 5%: báo lại anh Quyết';
    aoa[1][10] =
      'Giá trị hợp đồng (VND) = Giá khớp (USD, JPY,...) * Độ lớn hợp đồng * Đơn vị yết giá';

    aoa[2] = [];
    aoa[2][4] = tomorrowStr;
    aoa[2][7] = yesterdayStr;

    aoa[3] = [
      'Phiên giao dịch',
      'Mã hàng hóa',
      'Tên hàng hóa',
      'Sở giao dịch',
      'Ký quỹ ban đầu (exchange, chưa x 1.2)',
      'Ký quỹ khách hàng (sau x 1.2)',
      'Tiền tệ',
      'GTT',
      'Mức KQ trước khi nhân 1.2',
      'Mức KQ sau khi nhân 1.2',
      'Giá trị hợp đồng',
      'Độ lớn HĐ',
      'Đơn vị yết giá',
      'Ký quỹ Exchange áp dụng',
      'Tỷ trọng ký quỹ Exchange áp dụng trên trị giá HĐ',
      'Chênh lệch giữa KQ ban hành của MXV và KQ áp dụng của Exchange',
    ];

    for (const item of reportData) {
      aoa.push([
        item.PhienGD,
        item.MaHangHoa,
        item.TenHangHoa,
        item.SoGD,
        item.KyQuyBD,
        item.KyQuyKH,
        item.TienTe,
        item.GTT,
        item.MucKQTruoc,
        item.MucKQSau,
        item.GiaTriHH,
        item.DoLonHD,
        item.DonViYetGia,
        item.KQExchangeApDung,
        item.TyTrongKQExchangeApDung,
        item.ChenhMxvExchange,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 0, c: 4 }, e: { r: 1, c: 6 } },
      { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } },
      { s: { r: 0, c: 8 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 8 }, e: { r: 1, c: 9 } },
    ];

    const totalRows = aoa.length;
    for (let r = 4; r < totalRows; r++) {
      const colsToFormatNumber = [4, 5, 7, 10, 11, 12, 13];
      for (const col of colsToFormatNumber) {
        const cellRef = XLSX.utils.encode_cell({ r, c: col });
        if (ws[cellRef]) {
          ws[cellRef].t = 'n';
          ws[cellRef].z = '#,##0.00';
        }
      }

      const colsToFormatPercent = [8, 9, 14, 15];
      for (const col of colsToFormatPercent) {
        const cellRef = XLSX.utils.encode_cell({ r, c: col });
        if (ws[cellRef]) {
          ws[cellRef].t = 'n';
          ws[cellRef].z = '0.00%';
        }
      }
    }

    ws['!cols'] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 25 },
      { wch: 12 },
      { wch: 20 },
      { wch: 20 },
      { wch: 10 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 25 },
      { wch: 25 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'CheckMucKyQuy');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  exportMarginChangeExcel(reportData: any[]): Buffer {
    const wb = XLSX.utils.book_new();
    const aoa: any[][] = [];
    aoa[0] = [
      'STT',
      'Tên hàng hóa',
      'Mã hàng hóa',
      'Nhóm hàng hóa',
      'Sở Giao dịch hàng hóa có liên thông',
      'Mức ký quỹ ban đầu',
      'Tiền tệ',
    ];

    let stt = 1;
    for (const item of reportData) {
      aoa.push([
        stt++,
        item.TenHangHoa,
        item.MaHangHoa,
        item.NhomHH,
        item.SoGD,
        item.KyQuy,
        item.TienTe,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const totalRows = aoa.length;
    for (let r = 1; r < totalRows; r++) {
      const cellRef = XLSX.utils.encode_cell({ r, c: 5 });
      if (ws[cellRef]) {
        ws[cellRef].t = 'n';
        ws[cellRef].z = '#,##0';
      }
    }

    ws['!cols'] = [
      { wch: 6 },
      { wch: 32 },
      { wch: 18 },
      { wch: 24 },
      { wch: 32 },
      { wch: 24 },
      { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'ThayDoiKyQuy');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
