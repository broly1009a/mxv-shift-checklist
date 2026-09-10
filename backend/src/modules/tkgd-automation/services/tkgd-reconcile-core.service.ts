import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../../schemas/clean-account-record.schema';
import { TkgdConfigService } from './tkgd-config.service';
import { TkgdProgressService } from './tkgd-progress.service';
import { TkgdExcelExportService } from './tkgd-excel-export.service';
import { resolveTkgdOutputDir } from '../../bot-engine/helpers/tkgd-reconcile-exporter.helper';
import { runPythonExtractor } from '../../bot-engine/helpers/tkgd-python-bridge.helper';

function parseDate(dStr?: string): Date | undefined {
  if (!dStr) return undefined;
  const s = dStr.trim().replace(/-/g, '/');
  const p = s.split('/');
  if (p.length === 3) {
    let dd: number, mm: number, yyyy: number;
    if (p[0].length === 4) {
      yyyy = parseInt(p[0], 10);
      mm = parseInt(p[1], 10) - 1;
      dd = parseInt(p[2], 10);
    } else {
      dd = parseInt(p[0], 10);
      mm = parseInt(p[1], 10) - 1;
      yyyy = parseInt(p[2], 10);
    }
    const d = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? undefined : d;
}

function formatDateStr(d?: Date | string | null): string {
  if (!d) return '';
  if (typeof d === 'string') {
    const s = d.trim();
    const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      return `${dmyMatch[1].padStart(2, '0')}/${dmyMatch[2].padStart(2, '0')}/${dmyMatch[3]}`;
    }
  }
  const date = d instanceof Date ? d : parseDate(String(d));
  if (!date || isNaN(date.getTime())) return typeof d === 'string' ? d : '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function normalizeDateStr(d: string | undefined | null): string {
  if (!d) return '';
  const clean = String(d).trim().split('T')[0].split(' ')[0].replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }
  return clean;
}

function inferFromCCCD(soCCCD?: string): { gioiTinh?: string; namSinh?: number } {
  if (!soCCCD) return {};
  const clean = soCCCD.replace(/\D/g, '');
  if (clean.length !== 12) return {};
  const genderCenturyDigit = parseInt(clean.charAt(3), 10);
  let gioiTinh: string | undefined = undefined;
  let century = 1900;
  if (genderCenturyDigit === 0 || genderCenturyDigit === 1) {
    century = 1900;
    gioiTinh = genderCenturyDigit === 0 ? 'Nam' : 'Nữ';
  } else if (genderCenturyDigit === 2 || genderCenturyDigit === 3) {
    century = 2000;
    gioiTinh = genderCenturyDigit === 2 ? 'Nam' : 'Nữ';
  } else if (genderCenturyDigit === 4 || genderCenturyDigit === 5) {
    century = 2100;
    gioiTinh = genderCenturyDigit === 4 ? 'Nam' : 'Nữ';
  }
  const yearShort = parseInt(clean.substring(4, 6), 10);
  const namSinh = century + yearShort;
  return { gioiTinh, namSinh };
}

@Injectable()
export class TkgdReconcileCoreService {
  private readonly logger = new Logger(TkgdReconcileCoreService.name);

  constructor(
    @InjectModel(CleanAccountRecord.name) private cleanRecordModel: Model<CleanAccountRecordDocument>,
    private readonly configService: TkgdConfigService,
    private readonly progressService: TkgdProgressService,
    private readonly excelExportService: TkgdExcelExportService,
  ) {}

  /**
   * Lấy danh sách hồ sơ đối soát từ clean_account_records (Gom nhóm 1 Khách hàng = 1 Dòng)
   */
  async getRecords(
    options:
      | {
        limit?: number;
        skip?: number;
        page?: number;
        filter?: string;
        batchDate?: string;
        search?: string;
      }
      | number = 20,
    skipArg: number = 0,
    filterArg?: string
  ) {
    let limit = 20;
    let skip = 0;
    let page = 1;
    let filter: string | undefined = undefined;
    let batchDate: string | undefined = undefined;
    let search: string | undefined = undefined;

    if (typeof options === 'object') {
      limit = options.limit || 20;
      page = options.page || (options.skip ? Math.floor(options.skip / limit) + 1 : 1);
      skip = options.skip !== undefined ? options.skip : (page - 1) * limit;
      filter = options.filter;
      batchDate = options.batchDate;
      search = options.search;
    } else {
      limit = options;
      skip = skipArg;
      filter = filterArg;
      page = Math.floor(skip / limit) + 1;
    }

    const query: any = {};
    if (batchDate) {
      query['batchDate'] = batchDate;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { maTKGD: regex },
        { maTKGDBase: regex },
        { 'noiDungMail.tenTaiKhoan': regex },
        { 'noiDungMail.maTKGD_Futures': regex },
        { 'noiDungMail.maTKGD_ACM': regex },
        { 'ms.hoVaTen': regex },
        { 'ms.tenTKGD': regex },
        { 'ms.soCMND_HoChieu': regex },
      ];
    }

    const rawRecords = await this.cleanRecordModel
      .find(query)
      .sort({ createdAt: -1 })
      .lean();

    const extractBaseCode = (record: any): string => {
      if (record.maTKGDBase && record.maTKGDBase.trim()) return record.maTKGDBase.trim();
      if (record.noiDungMail?.maTKGD_Futures && record.noiDungMail.maTKGD_Futures.trim()) {
        return record.noiDungMail.maTKGD_Futures.trim();
      }
      if (record.maTKGD && record.maTKGD.trim()) {
        return record.maTKGD.trim().split('-')[0];
      }
      if (record.ms?.maTKGD && record.ms.maTKGD.trim()) {
        return record.ms.maTKGD.trim().split('-')[0];
      }
      return '';
    };

    const groupedMap = new Map<string, any>();

    for (const r of rawRecords) {
      const baseCode = extractBaseCode(r);
      const groupKey = baseCode || r._id.toString();

      if (!groupedMap.has(groupKey)) {
        const primaryDoc: any = {
          ...r,
          maTKGD: baseCode || r.maTKGD,
          maTKGDBase: baseCode,
          accountTypes: [r.accountType || (r.maTKGD?.includes('-A') ? 'ACM' : 'FUTURES')],
          subAccounts: [] as any[],
        };

        if (r.maTKGD?.includes('-')) {
          primaryDoc.subAccounts.push({
            code: r.maTKGD,
            type: r.accountType || (r.maTKGD.endsWith('-A') ? 'ACM' : 'SUB'),
            status: r.ketLuan?.trangThai || 'CHUA_XU_LY',
          });
        }
        if (r.noiDungMail?.hasACMRequest && !primaryDoc.accountTypes.includes('ACM')) {
          primaryDoc.accountTypes.push('ACM');
        }

        groupedMap.set(groupKey, primaryDoc);
      } else {
        const existing = groupedMap.get(groupKey);
        const rType = r.accountType || (r.maTKGD?.includes('-A') ? 'ACM' : 'FUTURES');
        if (!existing.accountTypes.includes(rType)) {
          existing.accountTypes.push(rType);
        }
        if (r.noiDungMail?.hasACMRequest && !existing.accountTypes.includes('ACM')) {
          existing.accountTypes.push('ACM');
        }

        if (r.maTKGD?.includes('-')) {
          if (!existing.subAccounts.some((s: any) => s.code === r.maTKGD)) {
            existing.subAccounts.push({
              code: r.maTKGD,
              type: rType,
              status: r.ketLuan?.trangThai || 'CHUA_XU_LY',
            });
          }
        }

        if (!existing.hopDong?.soCanCuoc && r.hopDong?.soCanCuoc) {
          existing.hopDong = r.hopDong;
        }
        if (!existing.phuLuc?.soCanCuoc && r.phuLuc?.soCanCuoc) {
          existing.phuLuc = r.phuLuc;
        }
        if (!existing.canCuoc?.soCanCuoc && r.canCuoc?.soCanCuoc) {
          existing.canCuoc = r.canCuoc;
        }
        if ((!existing.ms?.hoVaTen || existing.ms?.maTKGD?.includes('001C')) && r.ms?.hoVaTen && !r.ms?.maTKGD?.includes('001C')) {
          existing.ms = r.ms;
        }

        if (r.ketLuan?.trangThai === 'LECH') {
          existing.ketLuan = r.ketLuan;
        } else if (r.ketLuan?.trangThai === 'CAN_KIEM_TRA' && existing.ketLuan?.trangThai !== 'LECH') {
          existing.ketLuan = r.ketLuan;
        } else if (r.ketLuan?.trangThai === 'KHOP' && existing.ketLuan?.trangThai !== 'LECH' && existing.ketLuan?.trangThai !== 'CAN_KIEM_TRA') {
          existing.ketLuan = r.ketLuan;
        } else if (r.ketLuan?.trangThai === 'KHOP_TEXT' && (!existing.ketLuan?.trangThai || existing.ketLuan?.trangThai === 'CHUA_XU_LY')) {
          existing.ketLuan = r.ketLuan;
        }
      }
    }

    for (const doc of groupedMap.values()) {
      const hdErrors: string[] = doc.hopDong?.dinhDangLoi || [];
      if (hdErrors.length > 0 && doc.ketLuan?.trangThai === 'KHOP') {
        const combinedErrors = Array.from(
          new Set([...(doc.ketLuan?.danhSachLoi || []), ...hdErrors])
        );
        doc.ketLuan = {
          trangThai: 'LECH',
          danhSachLoi: combinedErrors,
          reconciledAt: doc.ketLuan?.reconciledAt || new Date(),
        };
        if (doc._id) {
          this.cleanRecordModel
            .updateMany(
              { $or: [{ _id: doc._id }, { maTKGD: doc.maTKGD }, { maTKGDBase: doc.maTKGDBase }] },
              { $set: { 'ketLuan.trangThai': 'LECH', 'ketLuan.danhSachLoi': combinedErrors } },
            )
            .exec()
            .catch(() => {});
        }
      }
    }

    const allGroupedList = Array.from(groupedMap.values());

    const globalStats = {
      totalCount: allGroupedList.length,
      matchedCount: allGroupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP').length,
      matchedTextCount: allGroupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP_TEXT').length,
      canKiemTraCount: allGroupedList.filter((g) => g.ketLuan?.trangThai === 'CAN_KIEM_TRA').length,
      mismatchedCount: allGroupedList.filter(
        (g) =>
          g.ketLuan?.trangThai &&
          g.ketLuan?.trangThai !== 'KHOP' &&
          g.ketLuan?.trangThai !== 'KHOP_TEXT' &&
          g.ketLuan?.trangThai !== 'CAN_KIEM_TRA' &&
          g.ketLuan?.trangThai !== 'CHUA_XU_LY',
      ).length,
      pendingMsCount: allGroupedList.filter((g) => !g.ms?.isFoundOnMS).length,
      futuresCount: allGroupedList.filter((g) => g.accountTypes?.includes('FUTURES')).length,
      acmCount: allGroupedList.filter((g) => g.accountTypes?.includes('ACM')).length,
      lmeCount: allGroupedList.filter((g) => g.accountTypes?.includes('LME')).length,
      spreadCount: allGroupedList.filter((g) => g.accountTypes?.includes('SPREAD')).length,
    };

    let groupedList = allGroupedList;

    if (filter === 'KHOP') {
      groupedList = groupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP');
    } else if (filter === 'KHOP_TEXT') {
      groupedList = groupedList.filter((g) => g.ketLuan?.trangThai === 'KHOP_TEXT');
    } else if (filter === 'CAN_KIEM_TRA') {
      groupedList = groupedList.filter((g) => g.ketLuan?.trangThai === 'CAN_KIEM_TRA');
    } else if (filter === 'LECH') {
      groupedList = groupedList.filter(
        (g) => g.ketLuan?.trangThai && g.ketLuan?.trangThai !== 'KHOP' && g.ketLuan?.trangThai !== 'KHOP_TEXT' && g.ketLuan?.trangThai !== 'CAN_KIEM_TRA' && g.ketLuan?.trangThai !== 'CHUA_XU_LY',
      );
    } else if (['FUTURES', 'ACM', 'LME', 'SPREAD'].includes(filter || '')) {
      groupedList = groupedList.filter((g) => g.accountTypes?.includes(filter));
    }

    const total = groupedList.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const items = groupedList.slice(skip, skip + limit);

    for (const rec of items as any[]) {
      if (rec.hopDong && !rec.canCuoc && (rec.hopDong.soCanCuoc || rec.hopDong.hoVaTen)) {
        rec.canCuoc = {
          soCanCuoc: rec.hopDong.soCanCuoc,
          hoVaTen: rec.hopDong.hoVaTen,
          noiCap: rec.hopDong.noiCap || 'BỘ CÔNG AN',
          ngayCap: rec.hopDong.ngayCap,
          rawNgayCap: rec.hopDong.rawNgayCap,
          gioiTinh: rec.hopDong.gioiTinh,
          rawGioiTinh: rec.hopDong.rawGioiTinh,
          ngaySinh: rec.hopDong.ngaySinh,
          rawNgaySinh: rec.hopDong.rawNgaySinh,
          source: 'HOP_DONG_SCAN',
        };
      }
      if (rec.canCuoc && !rec.hopDong && (rec.canCuoc.soCanCuoc || rec.canCuoc.hoVaTen)) {
        rec.hopDong = {
          soCanCuoc: rec.canCuoc.soCanCuoc,
          hoVaTen: rec.canCuoc.hoVaTen,
          noiCap: rec.canCuoc.noiCap || 'BỘ CÔNG AN',
          ngayCap: rec.canCuoc.ngayCap,
          rawNgayCap: rec.canCuoc.rawNgayCap,
          gioiTinh: rec.canCuoc.gioiTinh,
          rawGioiTinh: rec.canCuoc.rawGioiTinh,
          ngaySinh: rec.canCuoc.ngaySinh,
          rawNgaySinh: rec.canCuoc.rawNgaySinh,
        };
      }
      const cccd = rec.hopDong?.soCanCuoc || rec.canCuoc?.soCanCuoc;
      if (cccd) {
        const inf = inferFromCCCD(cccd);
        if (inf.gioiTinh) {
          if (rec.hopDong && !rec.hopDong.gioiTinh) rec.hopDong.gioiTinh = inf.gioiTinh;
          if (rec.canCuoc && !rec.canCuoc.gioiTinh) rec.canCuoc.gioiTinh = inf.gioiTinh;
        }
        if (inf.namSinh) {
          if (rec.hopDong && !rec.hopDong.rawNgaySinh && !rec.hopDong.ngaySinh) rec.hopDong.rawNgaySinh = `${inf.namSinh}`;
          if (rec.canCuoc && !rec.canCuoc.rawNgaySinh && !rec.canCuoc.ngaySinh) rec.canCuoc.rawNgaySinh = `${inf.namSinh}`;
        }
      }
    }

    return { items, total, page, pageSize: limit, totalPages, stats: globalStats };
  }

  /**
   * Thống kê nhanh số lượng phục vụ Dynamic Badges
   */
  async getTkgdStats(userEmail: string, batchDate?: string) {
    const res = await this.getRecords({
      page: 1,
      limit: 1,
      batchDate,
    });
    return res.stats;
  }

  /**
   * Tự động làm giàu các trường còn thiếu từ file đính kèm
   */
  async enrichMissingCccdData(record: any): Promise<void> {
    if (!record) return;
    const baseCode = (record.maTKGDBase || record.maTKGD?.split('-')[0] || '').trim();
    if (!baseCode) return;

    if (
      record.canCuoc?.ngaySinh &&
      record.canCuoc?.gioiTinh &&
      (record.hopDong?.noiCap || record.canCuoc?.noiCap) &&
      record.canCuoc?.theGeneration
    ) {
      return;
    }

    try {
      const candidates = [
        path.resolve(process.cwd(), 'data/temp_tkgd_attachments', baseCode),
        path.resolve(__dirname, '../../../data/temp_tkgd_attachments', baseCode),
        path.resolve('/opt/mxv-checklist/backend/data/temp_tkgd_attachments', baseCode),
        path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem', record.batchDate || '', baseCode),
      ];
      const dir = candidates.find((p) => fs.existsSync(p));
      if (!dir) return;

      const files = fs.readdirSync(dir);
      const isMsEvidence = (fn: string) =>
        fn.toLowerCase().includes('_ms_') ||
        fn.toLowerCase().includes('chuky') ||
        fn.toLowerCase().includes('signature') ||
        fn.toLowerCase().includes('sign') ||
        fn.toLowerCase().startsWith(`${baseCode.toLowerCase()}_ms`);

      const customerFiles = files.filter((f) => !isMsEvidence(f));
      const pool = customerFiles.length > 0 ? customerFiles : files;

      const hopDong = pool.find((f) => f.toLowerCase().endsWith('.pdf') && (f.toLowerCase().includes('mxv') || f.toLowerCase().includes('hopdong') || !f.toLowerCase().includes('pl01')));
      let front = pool.find((f) => (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png')) && !f.toLowerCase().includes('chuky') && !f.toLowerCase().includes('sign') && (f.toLowerCase().includes('truoc') || f.toLowerCase().includes('front')));
      let back = pool.find((f) => (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png')) && !f.toLowerCase().includes('chuky') && !f.toLowerCase().includes('sign') && (f.toLowerCase().includes('sau') || f.toLowerCase().includes('back')));
      if (!front) front = pool.find((f) => (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png')) && !f.toLowerCase().includes('chuky') && !f.toLowerCase().includes('sign'));
      if (front && !back) back = pool.filter((f) => (f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png')) && !f.toLowerCase().includes('chuky') && !f.toLowerCase().includes('sign')).find((f) => f !== front);

      if (front || back || hopDong) {
        const pyRes = await runPythonExtractor({
          accountCode: baseCode,
          accountName: record.noiDungMail?.tenTaiKhoan || record.hopDong?.hoVaTen || record.ms?.hoVaTen,
          hopDongPath: hopDong ? path.join(dir, hopDong) : undefined,
          cccdFrontPath: front ? path.join(dir, front) : undefined,
          cccdBackPath: back ? path.join(dir, back) : undefined,
          geminiKey: process.env.GEMINI_API_KEY,
        });

        if (pyRes) {
          const updatePayload: any = {};
          if (pyRes.hopDong) {
            record.hopDong = {
              ...(record.hopDong || {}),
              noiCap: pyRes.hopDong.noiCap || record.hopDong?.noiCap || 'BỘ CÔNG AN',
              ngayCap: record.hopDong?.ngayCap || parseDate(pyRes.hopDong.ngayCap),
              rawNgayCap: record.hopDong?.rawNgayCap || pyRes.hopDong.rawNgayCap || pyRes.hopDong.ngayCap,
              soCanCuoc: record.hopDong?.soCanCuoc || pyRes.hopDong.soCCCD,
              hoVaTen: record.hopDong?.hoVaTen || pyRes.hopDong.hoTen,
              ngaySinh: record.hopDong?.ngaySinh || parseDate(pyRes.hopDong.ngaySinh),
              rawNgaySinh: record.hopDong?.rawNgaySinh || pyRes.hopDong.rawNgaySinh,
              gioiTinh: record.hopDong?.gioiTinh || pyRes.hopDong.gioiTinh,
              rawGioiTinh: record.hopDong?.rawGioiTinh || pyRes.hopDong.rawGioiTinh,
              dinhDangLoi: pyRes.hopDong.dinhDangLoi || record.hopDong?.dinhDangLoi || [],
            };
            updatePayload.hopDong = record.hopDong;
          }

          if (pyRes.canCuoc) {
            const rawDob = pyRes.canCuoc.rawNgaySinh || pyRes.canCuoc.ngaySinh;
            const rawCap = pyRes.canCuoc.rawNgayCap || pyRes.canCuoc.ngayCap;
            const noiCapFinal = pyRes.canCuoc.noiCap || pyRes.hopDong?.noiCap || record.hopDong?.noiCap || 'BỘ CÔNG AN';
            record.canCuoc = {
              ...(record.canCuoc || {}),
              soCanCuoc: record.canCuoc?.soCanCuoc || pyRes.canCuoc.soCCCD || record.hopDong?.soCanCuoc,
              hoVaTen: record.canCuoc?.hoVaTen || pyRes.canCuoc.hoTen || record.hopDong?.hoVaTen,
              ngaySinh: record.canCuoc?.ngaySinh || parseDate(pyRes.canCuoc.ngaySinh) || record.hopDong?.ngaySinh,
              rawNgaySinh: record.canCuoc?.rawNgaySinh || rawDob || record.hopDong?.rawNgaySinh,
              ngayCap: record.canCuoc?.ngayCap || parseDate(pyRes.canCuoc.ngayCap) || record.hopDong?.ngayCap,
              rawNgayCap: record.canCuoc?.rawNgayCap || rawCap || record.hopDong?.rawNgayCap,
              gioiTinh: record.canCuoc?.gioiTinh || pyRes.canCuoc.gioiTinh || record.hopDong?.gioiTinh,
              noiCap: record.canCuoc?.noiCap || noiCapFinal,
              source: record.canCuoc?.source || pyRes.canCuoc.source || 'OCR',
              canhBaoChatLuong: pyRes.canCuoc.canhBaoChatLuong || record.canCuoc?.canhBaoChatLuong || [],
              theGeneration: pyRes.canCuoc.theGeneration || record.canCuoc?.theGeneration,
              confidenceScore: pyRes.canCuoc.confidenceScore !== undefined ? pyRes.canCuoc.confidenceScore : record.canCuoc?.confidenceScore,
              boundingBoxes: pyRes.canCuoc.boundingBoxes || record.canCuoc?.boundingBoxes,
            };
            updatePayload.canCuoc = record.canCuoc;
          }

          if (record.hopDong) updatePayload.hopDong = record.hopDong;
          if (record.canCuoc) updatePayload.canCuoc = record.canCuoc;

          const hdErrors: string[] = pyRes.hopDong?.dinhDangLoi || record.hopDong?.dinhDangLoi || [];
          if (hdErrors.length > 0 && (!record.ketLuan?.trangThai || record.ketLuan?.trangThai === 'KHOP')) {
            const combinedErrors = Array.from(
              new Set([...(record.ketLuan?.danhSachLoi || []), ...hdErrors])
            );
            record.ketLuan = {
              trangThai: 'LECH',
              danhSachLoi: combinedErrors,
              reconciledAt: new Date(),
            };
            updatePayload.ketLuan = record.ketLuan;
          }

          if (Object.keys(updatePayload).length > 0 && record._id) {
            await this.cleanRecordModel.updateOne({ _id: record._id }, { $set: updatePayload });
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`[ENRICH-CCCD] Không thể tự động làm giàu CCCD cho ${baseCode}: ${err.message}`);
    }
  }

  /**
   * Kích hoạt chạy đối soát chéo 3 bên và xuất file Excel
   */
  async runReconciliation(userEmail: string, batchDate?: string) {
    const config = await this.configService.getUserConfig(userEmail);
    const query: any = {};
    if (batchDate) query.batchDate = batchDate;
    const records = await this.cleanRecordModel.find(query).sort({ createdAt: -1 }).limit(100);

    this.progressService.updateProgress(userEmail, {
      isProcessing: true,
      taskType: 'RECONCILE',
      current: 0,
      total: records.length || 1,
      percent: 20,
      stage: `Đang làm giàu dữ liệu & đối soát chéo cho ${records.length} hồ sơ...`,
    });

    for (let rIdx = 0; rIdx < records.length; rIdx++) {
      const record = records[rIdx];
      const baseCode = record.maTKGDBase || record.maTKGD || '';
      this.progressService.updateProgress(userEmail, {
        current: rIdx + 1,
        total: records.length,
        percent: 20 + Math.round(((rIdx + 1) / records.length) * 60),
        currentCode: baseCode,
        stage: `Đang đối soát hồ sơ ${baseCode} (${rIdx + 1}/${records.length})...`,
      });
      await this.enrichMissingCccdData(record);
    }

    const outDir = resolveTkgdOutputDir(config?.storage?.windowsPath);
    const dateStr = (batchDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const targetFile = path.join(outDir, `Auto_Data_mail_${dateStr}.xlsx`);

    this.progressService.updateProgress(userEmail, {
      current: records.length,
      total: records.length,
      percent: 85,
      stage: 'Đang tổng hợp báo cáo và xuất file Excel đối soát...',
    });

    const summary = await this.excelExportService.exportReconciliationExcel(records, targetFile);

    const now = new Date();
    for (const record of records) {
      if (record.manualReview?.isOverridden) {
        this.logger.log(`[RECON] Hồ sơ ${record.maTKGD || record.maTKGDBase} đã được phê duyệt tay. Giữ nguyên.`);
        continue;
      }

      const ms: any = record.ms || {};
      const mail: any = record.noiDungMail || {};
      const targetAccountCode = (record.maTKGD || ms.maTKGD || mail.maTKGD_Futures || mail.maTKGD_ACM || '').trim();
      const baseCode = (record.maTKGDBase || mail.maTKGD_Futures || targetAccountCode.split('-')[0] || '').trim();
      
      const cleanPersonName = (n: string) => {
        if (!n) return '';
        let s = n.split(/[\r\n]/)[0].trim();
        s = s.replace(/\s+(TVKD|Tài khoản|Mã TKGD|đã đính kèm|đề nghị|cam kết|kính gửi|HĐ|CCCD)[\s\S]*$/i, '').trim();
        s = s.replace(/[;,.\-:]+$/, '').trim();
        return s.toLowerCase().replace(/\s+/g, ' ');
      };
      const targetName = cleanPersonName(record.hopDong?.hoVaTen || record.canCuoc?.hoVaTen || mail.tenTaiKhoan);
      const msName = cleanPersonName(ms.hoVaTen || ms.tenTKGD);

      const targetCccd = (record.hopDong?.soCanCuoc || record.canCuoc?.soCanCuoc || record.phuLuc?.soCanCuoc || '').replace(/\D/g, '');
      const msCccd = (ms.soCMND_HoChieu || ms.cccdOcr_soCanCuoc || '').replace(/\D/g, '');

      let isCriticalMismatch = false;
      const criticalErrors: string[] = [];

      if (!ms.isFoundOnMS) {
        isCriticalMismatch = true;
        criticalErrors.push('Tài khoản chưa được tạo trên M-System');
      } else {
        const msCode = (ms.maTKGD || '').trim();
        const isSubAccount = targetAccountCode.includes('-A') || targetAccountCode.includes('-L') || targetAccountCode.includes('-S');
        if (isSubAccount) {
          const msBaseCode = msCode.split('-')[0].toUpperCase();
          if (baseCode && msBaseCode && baseCode.toUpperCase() !== msBaseCode) {
            isCriticalMismatch = true;
            criticalErrors.push(`Lệch mã cơ sở (Yêu cầu: ${baseCode} != MS: ${msCode})`);
          }
        } else {
          if (baseCode && msCode && !msCode.startsWith(baseCode)) {
            isCriticalMismatch = true;
            criticalErrors.push(`Lệch mã TKGD (Yêu cầu: ${baseCode} != MS: ${msCode})`);
          }
        }

        const normName = (s: string) =>
          s
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');

        if (targetName && msName && normName(targetName) !== normName(msName)) {
          isCriticalMismatch = true;
          criticalErrors.push(`Lệch họ tên (Yêu cầu: ${targetName.toUpperCase()} != MS: ${ms.hoVaTen || ms.tenTKGD})`);
        }

        if (targetCccd && msCccd && targetCccd !== msCccd) {
          isCriticalMismatch = true;
          criticalErrors.push(`Lệch số CCCD (Yêu cầu: ${targetCccd} != MS: ${msCccd})`);
        }

        // 4. Đối chiếu Ngày sinh (HĐ/CCCD vs MS)
        const cccdDob = record.canCuoc?.rawNgaySinh || (record.canCuoc?.ngaySinh ? formatDateStr(record.canCuoc.ngaySinh) : '');
        const contractDob = record.hopDong?.rawNgaySinh || (record.hopDong?.ngaySinh ? formatDateStr(record.hopDong.ngaySinh) : '');
        const msDob = record.ms?.rawNgaySinh || (record.ms?.ngaySinh ? formatDateStr(record.ms.ngaySinh) : '');
        let hdDob = contractDob || cccdDob;
        if (cccdDob && msDob && normalizeDateStr(cccdDob) === normalizeDateStr(msDob)) {
          hdDob = cccdDob;
        } else if (!contractDob || targetAccountCode.includes('-A') || targetAccountCode.includes('-L') || targetAccountCode.includes('-S')) {
          hdDob = cccdDob || contractDob;
        }
        if (hdDob && msDob) {
          const normHd = normalizeDateStr(hdDob);
          const normMs = normalizeDateStr(msDob);
          if (normHd.length === 10 && normMs.length === 10) {
            if (normHd !== normMs) {
              isCriticalMismatch = true;
              criticalErrors.push(`Lệch ngày sinh (HĐ/CCCD: ${hdDob} != MS: ${msDob})`);
            }
          }
        }

        const hdErrors: string[] = [
          ...(record.hopDong?.dinhDangLoi || []),
        ];
        const cccdWarnings: string[] = [
          ...(record.canCuoc?.canhBaoChatLuong || []),
        ];

        for (const err of hdErrors) {
          isCriticalMismatch = true;
          criticalErrors.push(err);
        }
        for (const warn of cccdWarnings) {
          isCriticalMismatch = true;
          criticalErrors.push(warn);
        }
      }

      let finalStatus = isCriticalMismatch ? 'LECH' : 'KHOP';
      let finalErrors = isCriticalMismatch ? criticalErrors : [];

      await this.cleanRecordModel.updateOne(
        { _id: record._id },
        {
          $set: {
            'ketLuan.trangThai': finalStatus,
            'ketLuan.danhSachLoi': finalErrors,
            'ketLuan.reconciledAt': now,
          },
        }
      );
    }

    this.progressService.updateProgress(userEmail, {
      isProcessing: false,
      taskType: 'IDLE',
      percent: 100,
      stage: 'Đối soát chéo dữ liệu hoàn tất!',
    });

    return {
      success: true,
      summary,
    };
  }

  /**
   * Cán bộ chủ động phê duyệt hồ sơ bằng tay
   */
  async manualApproveRecord(recordId: string, userEmail: string, reason?: string) {
    const record = await this.cleanRecordModel.findById(recordId);
    if (!record) {
      throw new NotFoundException(`Không tìm thấy hồ sơ ID ${recordId}`);
    }

    const previousData = {
      ketLuan: record.ketLuan,
      manualReview: record.manualReview,
    };

    const now = new Date();
    record.manualReview = {
      isOverridden: true,
      status: 'DA_DUYET',
      approvedBy: userEmail,
      approvedAt: now,
      reason: (reason || 'Cán bộ TTBT phê duyệt hồ sơ bằng tay').trim(),
    };

    record.ketLuan = {
      trangThai: 'KHOP',
      danhSachLoi: [],
      reconciledAt: now,
    };

    if (!record.snapshots) record.snapshots = [];
    record.snapshots.push({
      snapshotAt: now,
      action: 'MANUAL_APPROVE',
      previousData,
    } as any);

    await record.save();
    this.logger.log(`[MANUAL-APPROVE] ${userEmail} đã duyệt tay hồ sơ ${record.maTKGD || record.maTKGDBase}`);
    return {
      success: true,
      record,
      message: `Đã phê duyệt hồ sơ ${record.maTKGD || record.maTKGDBase} thành công!`,
    };
  }

  /**
   * Hủy phê duyệt bằng tay
   */
  async revertManualApprove(recordId: string, userEmail: string) {
    const record = await this.cleanRecordModel.findById(recordId);
    if (!record) {
      throw new NotFoundException(`Không tìm thấy hồ sơ ID ${recordId}`);
    }

    const previousData = {
      ketLuan: record.ketLuan,
      manualReview: record.manualReview,
    };

    const now = new Date();
    record.manualReview = {
      isOverridden: false,
      status: 'CHUA_XU_LY',
      approvedBy: undefined,
      approvedAt: undefined,
      reason: undefined,
    };

    record.ketLuan = {
      trangThai: 'CHUA_XU_LY',
      danhSachLoi: ['Đã hủy phê duyệt tay, chờ đối soát lại'],
      reconciledAt: now,
    };

    if (!record.snapshots) record.snapshots = [];
    record.snapshots.push({
      snapshotAt: now,
      action: 'REVERT_MANUAL_APPROVE',
      previousData,
    } as any);

    await record.save();
    this.logger.log(`[REVERT-APPROVE] ${userEmail} đã hủy duyệt tay hồ sơ ${record.maTKGD || record.maTKGDBase}`);
    return {
      success: true,
      record,
      message: `Đã hủy phê duyệt tay cho hồ sơ ${record.maTKGD || record.maTKGDBase}!`,
    };
  }

  getModel(): Model<CleanAccountRecordDocument> {
    return this.cleanRecordModel;
  }
}
