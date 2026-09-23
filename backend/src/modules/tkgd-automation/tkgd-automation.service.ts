import { Injectable, Logger, Optional, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../schemas/tkgd-user-config.schema';
import { RawAccountMail, RawAccountMailDocument } from '../../schemas/raw-account-mail.schema';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../schemas/clean-account-record.schema';
import { TkgdActivityLog, TkgdActivityLogDocument } from '../../schemas/tkgd-activity-log.schema';
import { encrypt, decrypt } from '../bot-engine/utils/crypto';
import { chromium, Page } from 'playwright-core';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { scrapeInvestorDetailFromMSystem } from '../bot-engine/helpers/msystem-scraper.helper';
import {
  reconcileAndExportToExcel,
  ReconcileSummary,
  getTkgdOutputDirectory,
  getTkgdAttachmentDirectory,
  resolveTkgdOutputDir,
} from '../bot-engine/helpers/tkgd-reconcile-exporter.helper';
import { evaluateRecordReconciliationRule } from '../bot-engine/helpers/tkgd-reconcile-rules.helper';
import {
  parseAccountOpeningEmailBody,
  parseAccountOpeningEmailMulti,
  dispatchAttachmentsForAccount,
  htmlToPlainText,
  cleanPersonName,
  isLikelyValidPersonName,
  isPersonNameMatch,
  anyPersonNameMatchesMs,
  isIgnoredEmailAttachment,
  pickCccdImagePaths,
  isNamedCccdFront,
  isNamedCccdBack,
  isNamedContractImage,
  isNamedCccdPdf,
  isDecorativeOrLogoAttachment,
  probeImageDimensions,
  isMSystemThumbnailFile,
  isCustomerCccdMsOrMt,
} from '../bot-engine/helpers/tkgd-mail-parser.helper';
import { extractHopDongPdf, extractPhuLucPdf } from '../bot-engine/helpers/tkgd-doc-extractor.helper';
import { runPythonExtractor } from '../bot-engine/helpers/tkgd-python-bridge.helper';
import { classifyAccountFiles, scoreDocumentType } from '../bot-engine/helpers/tkgd-document-classifier.helper';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export interface TkgdProgressState {
  isProcessing: boolean;
  taskType: 'SYNC_MAIL' | 'SYNC_MS' | 'RECONCILE' | 'PIPELINE_ALL' | 'IDLE';
  current: number;
  total: number;
  percent: number;
  currentCode?: string;
  currentName?: string;
  stage: string;
  detail?: string;
  updatedAt: number;
}

function findBrowserExecutable(): string | undefined {
  if (process.platform === 'linux') {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
    return undefined; // Để Playwright tự động dùng chromium mặc định trên Linux
  }

  const possiblePaths = [
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/**
 * Nhận diện và bỏ qua các tệp ảnh logo, banner, chữ ký email không phải hồ sơ pháp lý
 * → dùng isIgnoredEmailAttachment từ tkgd-mail-parser.helper (shared).
 */

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
  const s = String(d).trim();

  // ISO YYYY-MM-DD (có thể lẫn trong chuỗi OCR)
  const iso = s.match(/\b(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})\b/);
  if (iso) {
    return `${iso[3].padStart(2, '0')}/${iso[2].padStart(2, '0')}/${iso[1]}`;
  }

  // DD/MM/YYYY xuất hiện bất kỳ đâu (vd: "| 22/04/2021", "Ngày cấp: 22/04/2021")
  const dmy = s.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
  if (dmy) {
    return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
  }

  const clean = s.split('T')[0].split(' ')[0].replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
    }
    return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
  }
  return '';
}

function isCanonicalDate(d: string | undefined | null): boolean {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(String(d || ''));
}

/** Ngày ISO YYYY-MM-DD là hợp lệ về mặt lịch — không coi là lỗi LECH */
function isIsoDateOnly(d: string | undefined | null): boolean {
  return /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(String(d || '').trim());
}

function pickValidPersonName(...candidates: Array<string | undefined | null>): string {
  for (const c of candidates) {
    const cleaned = cleanPersonName(c || undefined);
    if (cleaned) return cleaned;
  }
  return '';
}

function isGenderMatch(g1?: string, g2?: string): boolean {
  if (!g1 || !g2) return true;
  const s1 = g1.trim().toLowerCase();
  const s2 = g2.trim().toLowerCase();
  const isFemale1 = ['nữ', 'nu', 'female', 'f'].includes(s1);
  const isFemale2 = ['nữ', 'nu', 'female', 'f'].includes(s2);
  const isMale1 = ['nam', 'male', 'm'].includes(s1);
  const isMale2 = ['nam', 'male', 'm'].includes(s2);
  if (isFemale1 && isFemale2) return true;
  if (isMale1 && isMale2) return true;
  return s1 === s2;
}

/**
 * Tự động suy luận Giới tính và Năm sinh từ cấu trúc 12 chữ số CCCD chuẩn của Bộ Công An
 * PPPGYYNNNNNN (G: 0/1 -> 1900s, 2/3 -> 2000s, 4/5 -> 2100s; số chẵn Nam, số lẻ Nữ)
 */
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
export class TkgdAutomationService {
  private readonly logger = new Logger(TkgdAutomationService.name);

  constructor(
    @InjectModel(TkgdUserConfig.name) private userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(RawAccountMail.name) private rawMailModel: Model<RawAccountMailDocument>,
    @InjectModel(CleanAccountRecord.name) private cleanRecordModel: Model<CleanAccountRecordDocument>,
    @InjectModel(TkgdActivityLog.name) private activityLogModel: Model<TkgdActivityLogDocument>,
    @Optional() private readonly settingsService?: SystemSettingsService,
  ) { }

  /**
   * Ghi log tác vụ độc lập cho phân hệ TKGD (Thanh Toán Bù Trừ)
   */
  async logActivity(params: {
    action: string;
    title: string;
    details?: string;
    status?: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';
    userEmail?: string;
    userName?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const log = new this.activityLogModel({
        action: params.action,
        title: params.title,
        details: params.details || '',
        status: params.status || 'SUCCESS',
        userEmail: params.userEmail || 'clearing.acc@mxv.vn',
        userName: params.userName || '',
        ipAddress: params.ipAddress || '',
        userAgent: params.userAgent || '',
        metadata: params.metadata || {},
      });
      await log.save();
    } catch (err: any) {
      this.logger.warn(`[TKGD-LOG] Không thể lưu log tác vụ TKGD: ${err.message}`);
    }
  }

  /**
   * Lấy danh sách nhật ký tác vụ độc lập của TKGD
   */
  async getActivityLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    userEmail?: string;
  }): Promise<{ data: any[]; total: number; page: number; pages: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: any = {};

    if (query.action && query.action !== 'ALL') {
      filter.action = query.action;
    }
    if (query.status && query.status !== 'ALL') {
      filter.status = query.status;
    }
    if (query.userEmail) {
      filter.userEmail = query.userEmail;
    }
    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [
        { title: regex },
        { details: regex },
        { action: regex },
        { userEmail: regex },
      ];
    }
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) {
        filter.createdAt.$gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const total = await this.activityLogModel.countDocuments(filter);
    const data = await this.activityLogModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  private progressMap = new Map<string, TkgdProgressState>();

  // Dùng Set thay vì single boolean để nhiều user có thể chạy song song
  // mà không block lẫn nhau — chỉ chặn cùng 1 userEmail chạy đè nhau.
  private autoPipelineRunningUsers = new Set<string>();

  /** @deprecated Giữ lại để tương thích — dùng autoPipelineRunningUsers thay thế */
  private get isAutoPipelineRunning(): boolean {
    return this.autoPipelineRunningUsers.size > 0;
  }

  /**
   * Quét tất cả email phù hợp từ Graph API, hỗ trợ phân trang @odata.nextLink.
   * Đảm bảo không sót mail dù hộp thư chứa > 100 email trong ngày.
   * Giới hạn tối đa MAX_PAGES trang để tránh vô hạn.
   */
  private async fetchAllMatchingMailsFromGraph(
    startUrl: string,
    accessToken: string,
    matchFn: (msg: any) => boolean,
    maxPages = 10,
    minReceivedDateTime?: Date,
  ): Promise<any[]> {
    const results: any[] = [];
    let nextUrl: string | null = startUrl;
    let page = 0;
    const GRAPH_FETCH_TIMEOUT_MS = 15_000; // 15s per page — tránh treo mạng

    while (nextUrl && page < maxPages) {
      page++;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GRAPH_FETCH_TIMEOUT_MS);
        const res = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId));

        if (!res.ok) {
          this.logger.warn(`[GRAPH-PAGE] Trang ${page} thất bại (${res.status}): ${startUrl}`);
          break;
        }
        const data = await res.json();
        const messages = data.value || [];
        const matched = messages.filter(matchFn);
        results.push(...matched);

        // Early Exit Optimization: Nếu đã có mốc thời gian tối thiểu (minReceivedDateTime)
        // và trong trang hiện tại xuất hiện email cũ hơn mốc này (do Graph API orderby desc),
        // các trang kế tiếp chắc chắn đều cũ hơn -> Dừng quét ngay lập tức!
        if (minReceivedDateTime && messages.length > 0) {
          const oldestMsg = messages[messages.length - 1];
          if (oldestMsg?.receivedDateTime) {
            const oldestDate = new Date(oldestMsg.receivedDateTime);
            if (!isNaN(oldestDate.getTime()) && oldestDate < minReceivedDateTime) {
              this.logger.log(`[GRAPH-PAGE] Đã quét tới email ngày ${oldestDate.toISOString()} < mốc lọc ${minReceivedDateTime.toISOString()}. Dừng phân trang sớm.`);
              break;
            }
          }
        }

        // Nếu trang hiện tại đã có kết quả khớp và tất cả đều khớp: dừng
        if (matched.length > 0 && messages.length === matched.length) {
          break;
        }
        nextUrl = data['@odata.nextLink'] || null;
      } catch (err: any) {
        this.logger.warn(`[GRAPH-PAGE] Lỗi lấy trang ${page}: ${err.message}`);
        break;
      }
    }
    if (page >= maxPages && nextUrl) {
      this.logger.warn(`[GRAPH-PAGE] Đã đạt giới hạn ${maxPages} trang, còn dữ liệu chưa quét hết.`);
    }
    return results;
  }

  /**
   * Cập nhật trạng thái tiến trình thời gian thực theo từng người dùng
   */
  updateProgress(userEmail: string, state: Partial<TkgdProgressState>) {
    const prev = this.progressMap.get(userEmail) || {
      isProcessing: false,
      taskType: 'IDLE' as const,
      current: 0,
      total: 0,
      percent: 0,
      stage: '',
      updatedAt: Date.now(),
    };
    this.progressMap.set(userEmail, {
      ...prev,
      ...state,
      updatedAt: Date.now(),
    });
  }

  /**
   * Lấy trạng thái tiến trình hiện tại của người dùng
   */
  getProgress(userEmail: string): TkgdProgressState {
    const state = this.progressMap.get(userEmail);
    if (!state) {
      return {
        isProcessing: false,
        taskType: 'IDLE',
        current: 0,
        total: 0,
        percent: 0,
        stage: '',
        updatedAt: Date.now(),
      };
    }
    // Safeguard: Tự động nhả cờ nếu quá 10 phút không cập nhật
    if (state.isProcessing && Date.now() - state.updatedAt > 10 * 60 * 1000) {
      state.isProcessing = false;
      state.stage = '';
    }
    return state;
  }

  /**
   * Quét các thông báo lỗi Ant Design / Bootstrap trên trang đăng nhập M-System (Áp dụng từ Checklist Bot)
   */
  private async checkForLoginErrors(page: Page): Promise<string | null> {
    try {
      // 1. Ant Design notification
      const noticeDesc = page.locator('.ant-notification-notice-description, .ant-notification-notice-message');
      const count = await noticeDesc.count().catch(() => 0);
      if (count > 0) {
        const textList: string[] = [];
        for (let i = 0; i < count; i++) {
          const text = await noticeDesc.nth(i).innerText().catch(() => '');
          if (text.trim()) textList.push(text.trim());
        }
        if (textList.length > 0) return `Thông báo hệ thống: ${textList.join(' | ')}`;
      }

      // 2. Ant Design message alert
      const msgContent = page.locator('.ant-message-custom-content, .ant-message');
      const msgCount = await msgContent.count().catch(() => 0);
      if (msgCount > 0) {
        const textList: string[] = [];
        for (let i = 0; i < msgCount; i++) {
          const text = await msgContent.nth(i).innerText().catch(() => '');
          if (text.trim()) textList.push(text.trim());
        }
        if (textList.length > 0) return `Thông báo từ web: ${textList.join(' | ')}`;
      }

      // 3. Inline form explain errors
      const formExplain = page.locator('.ant-form-item-explain-error');
      const explainCount = await formExplain.count().catch(() => 0);
      if (explainCount > 0) {
        const textList: string[] = [];
        for (let i = 0; i < explainCount; i++) {
          const text = await formExplain.nth(i).innerText().catch(() => '');
          if (text.trim()) textList.push(text.trim());
        }
        if (textList.length > 0) return `Lỗi form: ${textList.join(' | ')}`;
      }

      // 4. General alert
      const generalAlerts = page.locator('.alert-danger, .error-message, #error-msg, .ant-alert-message');
      const genAlertCount = await generalAlerts.count().catch(() => 0);
      if (genAlertCount > 0) {
        const text = await generalAlerts.first().innerText().catch(() => '');
        if (text.trim()) return `Lỗi: ${text.trim()}`;
      }

      return null;
    } catch {
      return null;
    }
  }


  /**
   * Lấy cấu hình của User (Mật khẩu và PIN được che dấu sao)
   */
  async getUserConfig(userEmail: string) {
    let config = await this.userConfigModel.findOne({ userEmail }).lean();
    if (!config) {
      // Trả về cấu hình mặc định
      return {
        userEmail,
        fullName: userEmail.split('@')[0],
        department: 'Thanh toán bù trừ',
        msystem: {
          username: '',
          hasPassword: false,
          hasPin: false,
        },
        outlook: {
          targetMailbox: 'clearing.acc@mxv.vn',
          hasRefreshToken: false,
        },
        storage: {
          windowsPath: 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD',
          linuxPath: '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
        },
        preferences: {
          autoHighlightExcel: true,
          saveToAtlas: true,
        },
        documentProcessing: {
          autoDownloadMailAttachments: true,
          autoSaveMSystemImages: true,
          attachmentSavePath: '',
          autoExtractPdf: true,
          enableOcrCccd: true,
          enableTripleCheckCccd: true,
          checkSignatureRequired: true,
        },
        autoPipeline: {
          enabled: false,
          intervalMinutes: 5,
          batchSize: 50,
          autoSyncMSystem: true,
          autoExportExcel: true,
          lastRunTime: 0,
          lastProcessedCount: 0,
        },
      };
    }

    return {
      userEmail: config.userEmail,
      fullName: config.fullName,
      department: config.department || 'Thanh toán bù trừ',
      msystem: {
        username: config.msystem?.username || '',
        hasPassword: !!config.msystem?.passwordEncrypted,
        hasPin: !!config.msystem?.pinEncrypted,
      },
      outlook: {
        targetMailbox: config.outlook?.targetMailbox || 'clearing.acc@mxv.vn',
        hasRefreshToken: !!config.outlook?.refreshToken,
        authorizedEmail: config.outlook?.authorizedEmail || '',
        tokenRenewedAt: config.outlook?.tokenRenewedAt || '',
        clientId: config.outlook?.clientId || '',
        tenantId: config.outlook?.tenantId || '',
        hasClientSecret: !!config.outlook?.clientSecret,
      },
      storage: {
        windowsPath: config.storage?.windowsPath || 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD',
        linuxPath: config.storage?.linuxPath || '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
      },
      preferences: {
        autoHighlightExcel: config.preferences?.autoHighlightExcel ?? true,
        saveToAtlas: config.preferences?.saveToAtlas ?? true,
      },
      documentProcessing: {
        autoDownloadMailAttachments: config.documentProcessing?.autoDownloadMailAttachments ?? true,
        autoSaveMSystemImages: config.documentProcessing?.autoSaveMSystemImages ?? true,
        attachmentSavePath: config.documentProcessing?.attachmentSavePath || '',
        autoExtractPdf: config.documentProcessing?.autoExtractPdf ?? true,
        enableOcrCccd: config.documentProcessing?.enableOcrCccd ?? true,
        enableTripleCheckCccd: config.documentProcessing?.enableTripleCheckCccd ?? true,
        checkSignatureRequired: config.documentProcessing?.checkSignatureRequired ?? true,
      },
      autoPipeline: {
        enabled: config.autoPipeline?.enabled ?? false,
        executionMode: config.autoPipeline?.executionMode ?? 'BATCH',
        intervalMinutes: config.autoPipeline?.intervalMinutes ?? 5,
        batchSize: config.autoPipeline?.batchSize ?? 50,
        autoSyncMSystem: config.autoPipeline?.autoSyncMSystem ?? true,
        autoExportExcel: config.autoPipeline?.autoExportExcel ?? true,
        lastRunTime: config.autoPipeline?.lastRunTime ?? 0,
        lastProcessedCount: config.autoPipeline?.lastProcessedCount ?? 0,
      },
    };
  }

  /**
   * Lưu hoặc cập nhật cấu hình cho User (mã hóa mật khẩu và PIN bằng AES)
   */
  async saveUserConfig(userEmail: string, dto: any) {
    let config = await this.userConfigModel.findOne({ userEmail });
    if (!config) {
      config = new this.userConfigModel({
        userEmail,
        fullName: dto.fullName || userEmail.split('@')[0],
        department: dto.department || 'Thanh toán bù trừ',
      });
    }

    if (dto.fullName) config.fullName = dto.fullName;
    if (dto.department) config.department = dto.department;

    // Cập nhật M-System
    if (!config.msystem) (config as any).msystem = {};
    if (dto.msystem?.username !== undefined) config.msystem.username = dto.msystem.username;
    if (dto.msystem?.password) {
      config.msystem.passwordEncrypted = encrypt(dto.msystem.password);
    }
    if (dto.msystem?.pin) {
      config.msystem.pinEncrypted = encrypt(dto.msystem.pin);
    }

    // Cập nhật Outlook
    if (!config.outlook) (config as any).outlook = {};
    if (dto.outlook?.targetMailbox !== undefined) {
      config.outlook.targetMailbox = dto.outlook.targetMailbox;
    }
    if (dto.outlook?.refreshToken !== undefined) {
      config.outlook.refreshToken = dto.outlook.refreshToken;
    }
    if (dto.outlook?.clientId !== undefined) {
      config.outlook.clientId = dto.outlook.clientId;
    }
    if (dto.outlook?.tenantId !== undefined) {
      config.outlook.tenantId = dto.outlook.tenantId;
    }
    if (dto.outlook?.clientSecret) {
      config.outlook.clientSecret = dto.outlook.clientSecret;
    }

    // Cập nhật Storage
    if (!config.storage) (config as any).storage = {};
    if (dto.storage?.windowsPath) config.storage.windowsPath = dto.storage.windowsPath;
    if (dto.storage?.linuxPath) config.storage.linuxPath = dto.storage.linuxPath;

    // Cập nhật Preferences
    if (!config.preferences) (config as any).preferences = {};
    if (dto.preferences?.autoHighlightExcel !== undefined) {
      config.preferences.autoHighlightExcel = dto.preferences.autoHighlightExcel;
    }

    // Cập nhật Document Processing
    if (!config.documentProcessing) (config as any).documentProcessing = {};
    if (dto.documentProcessing) {
      if (dto.documentProcessing.autoDownloadMailAttachments !== undefined) {
        config.documentProcessing.autoDownloadMailAttachments = dto.documentProcessing.autoDownloadMailAttachments;
      }
      if (dto.documentProcessing.autoSaveMSystemImages !== undefined) {
        config.documentProcessing.autoSaveMSystemImages = dto.documentProcessing.autoSaveMSystemImages;
      }
      if (dto.documentProcessing.attachmentSavePath !== undefined) {
        config.documentProcessing.attachmentSavePath = dto.documentProcessing.attachmentSavePath.trim();
      }
      if (dto.documentProcessing.autoExtractPdf !== undefined) {
        config.documentProcessing.autoExtractPdf = dto.documentProcessing.autoExtractPdf;
      }
      if (dto.documentProcessing.enableOcrCccd !== undefined) {
        config.documentProcessing.enableOcrCccd = dto.documentProcessing.enableOcrCccd;
      }
      if (dto.documentProcessing.enableTripleCheckCccd !== undefined) {
        config.documentProcessing.enableTripleCheckCccd = dto.documentProcessing.enableTripleCheckCccd;
      }
      if (dto.documentProcessing.checkSignatureRequired !== undefined) {
        config.documentProcessing.checkSignatureRequired = dto.documentProcessing.checkSignatureRequired;
      }
    }

    // Cập nhật Auto Pipeline (Chế độ tự động 24/7 vs thủ công)
    if (!config.autoPipeline) (config as any).autoPipeline = {};
    if (dto.autoPipeline) {
      if (dto.autoPipeline.enabled !== undefined) config.autoPipeline.enabled = dto.autoPipeline.enabled;
      if (dto.autoPipeline.executionMode !== undefined) config.autoPipeline.executionMode = dto.autoPipeline.executionMode;
      if (dto.autoPipeline.intervalMinutes !== undefined) {
        config.autoPipeline.intervalMinutes = Math.max(1, Number(dto.autoPipeline.intervalMinutes) || 5);
      }
      if (dto.autoPipeline.batchSize !== undefined) {
        config.autoPipeline.batchSize = Math.max(1, Number(dto.autoPipeline.batchSize) || 50);
      }
      if (dto.autoPipeline.autoSyncMSystem !== undefined) config.autoPipeline.autoSyncMSystem = dto.autoPipeline.autoSyncMSystem;
      if (dto.autoPipeline.autoExportExcel !== undefined) config.autoPipeline.autoExportExcel = dto.autoPipeline.autoExportExcel;
    }

    // Đánh dấu Mongoose nhận diện thay đổi trên các subdocument lồng nhau
    config.markModified('msystem');
    config.markModified('outlook');
    config.markModified('storage');
    config.markModified('preferences');
    config.markModified('documentProcessing');
    config.markModified('autoPipeline');

    await config.save();
    this.logger.log(`Đã lưu cấu hình TKGD cho user: ${userEmail}`);

    await this.logActivity({
      action: 'CONFIG_UPDATE',
      title: 'Cập nhật cấu hình bot TKGD',
      details: `Đã lưu cấu hình bot và thông số tác vụ đối soát cho tài khoản ${userEmail}`,
      userEmail,
    });

    return await this.getUserConfig(userEmail);
  }

  /**
   * Lưu Token Outlook độc lập sau khi Microsoft OAuth callback thành công
   */
  async saveOutlookAuthorizedToken(
    userEmail: string,
    tokenData: { refreshToken: string; authorizedEmail?: string },
  ) {
    let config = await this.userConfigModel.findOne({ userEmail });
    if (!config) {
      config = new this.userConfigModel({
        userEmail,
        fullName: userEmail.split('@')[0],
        department: 'Thanh toán bù trừ',
      });
    }
    if (!config.outlook) (config as any).outlook = {};
    config.outlook.refreshToken = tokenData.refreshToken;
    if (tokenData.authorizedEmail) {
      config.outlook.authorizedEmail = tokenData.authorizedEmail;
    }
    config.outlook.tokenRenewedAt = new Date().toISOString();
    await config.save();
    this.logger.log(`[TKGD-OUTLOOK] Đã lưu Refresh Token Outlook độc lập cho ${userEmail}`);
    return config;
  }

  /**
   * Lấy clientSecret của user
   */
  async getRawClientSecret(userEmail: string): Promise<string> {
    const config = await this.userConfigModel.findOne({ userEmail });
    return config?.outlook?.clientSecret || '';
  }

  /**
   * Hủy kết nối / Đăng xuất tài khoản Outlook độc lập của TKGD
   */
  async disconnectOutlook(userEmail: string) {
    const config = await this.userConfigModel.findOne({ userEmail });
    if (config && config.outlook) {
      config.outlook.refreshToken = '';
      config.outlook.authorizedEmail = '';
      config.outlook.tokenRenewedAt = '';
      await config.save();
    }
    return { success: true, message: 'Đã hủy kết nối tài khoản Outlook độc lập thành công' };
  }

  /**
   * Kiểm tra đăng nhập M-System trực tiếp với credentials được cung cấp
   */
  async testMSystemConnection(userEmail: string, testCreds?: { username?: string; password?: string; pin?: string }) {
    let username = testCreds?.username;
    let password = testCreds?.password;
    let pin = testCreds?.pin;

    // Nếu không truyền trực tiếp, lấy từ config DB
    if (!username || !password) {
      const config = await this.userConfigModel.findOne({ userEmail });
      if (config && config.msystem?.username && config.msystem?.passwordEncrypted) {
        username = config.msystem.username;
        password = decrypt(config.msystem.passwordEncrypted);
        pin = config.msystem.pinEncrypted ? decrypt(config.msystem.pinEncrypted) : '';
      }
    }

    if (!username || !password) {
      return {
        success: false,
        message: 'Thiếu thông tin tài khoản hoặc mật khẩu M-System!',
      };
    }

    this.logger.log(`Kiểm tra đăng nhập M-System cho tài khoản: ${username}`);
    const executablePath = findBrowserExecutable();
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    });

    try {
      const page = await browser.newPage();
      // Áp dụng kỹ thuật Anti-bot chuẩn từ Checklist Bot (rpa-downloader.service.ts)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      page.setDefaultTimeout(25000);
      await page.goto('https://msadmin.mxv.com.vn/#/login', { waitUntil: 'load' });
      await page.waitForTimeout(1500);

      await page.fill('input[type="text"], input[name="username"]', username);
      await page.fill('input[type="password"], input[name="password"]', password);
      await page.click('button[type="submit"], button.btn-primary');
      await page.waitForTimeout(2000);

      // Kiểm tra xem có popup PIN không (áp dụng cơ chế retry 3 lần như Checklist Bot)
      let isPinVisible = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        isPinVisible = await page.locator('div.pincode').isVisible({ timeout: 4000 }).catch(() => false);
        if (isPinVisible) break;
        this.logger.warn(`[TKGD-MS] Chưa thấy bảng PIN (thử lần ${attempt}), click lại Đăng nhập...`);
        await page.click('button[type="submit"], button.btn-primary').catch(() => { });
        await page.waitForTimeout(2000);
      }

      if (isPinVisible && pin) {
        this.logger.log(`Nhập mã PIN ảo M-System (${String(pin).length} số)...`);
        for (const digit of String(pin)) {
          const btn = page.locator('.pincode .keyboard .button').filter({ hasText: new RegExp(`^\\s*${digit}\\s*$`) }).first();
          if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await btn.click();
            await page.waitForTimeout(300);
          } else {
            const fallbackEl = page.locator(`div.pincode >> xpath=.//div[text()='${digit}']`).first();
            if (await fallbackEl.isVisible({ timeout: 1000 }).catch(() => false)) {
              await fallbackEl.click();
              await page.waitForTimeout(300);
            }
          }
        }
        // Sau khi nhập đủ mã PIN, M-System tự động xác thực và chuyển trang (không có nút Xác nhận)
        await page.waitForTimeout(3000);
      }

      const currentUrl = page.url();
      if (currentUrl.includes('dashboard') || currentUrl.includes('clientManagement')) {
        await browser.close();
        return {
          success: true,
          message: `Đăng nhập M-System thành công với tài khoản "${username}"!`,
        };
      } else {
        // Kiểm tra thông báo lỗi trên trang nếu có
        const errorText = await page.locator('.ant-alert-error, .invalid-feedback, .ant-message-error').innerText().catch(() => '');
        await browser.close();
        return {
          success: false,
          message: `Đăng nhập không thành công. ${errorText || 'Vui lòng kiểm tra lại mật khẩu hoặc mã PIN.'}`,
        };
      }
    } catch (err: any) {
      await browser.close();
      return {
        success: false,
        message: `Lỗi kết nối M-System: ${err.message}`,
      };
    }
  }

  /**
   * Lấy danh sách hồ sơ đối soát từ clean_account_records (có hỗ trợ phân trang, lọc ngày, tìm kiếm)
   */
  /**
   * Lấy danh sách hồ sơ đối soát từ clean_account_records
   * NGHIỆP VỤ MXV CHUẨN: Gom nhóm 1 Khách hàng = 1 Dòng duy nhất theo Mã gốc (Base Code không đuôi).
   * Các tiểu khoản (-A cho ACM, -L cho LME, -S cho Spread) được gộp vào hồ sơ nhà đầu tư.
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

    // Helper trích xuất mã gốc chuẩn (Base Code)
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

    // Gom nhóm theo nhà đầu tư (1 Khách hàng = 1 Dòng duy nhất)
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

        // Hợp nhất hồ sơ: ưu tiên hồ sơ hoàn thiện nhất
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

        const rUpdated = (r as any).updatedAt;
        const existingUpdated = (existing as any).updatedAt;
        if (rUpdated && (!existingUpdated || new Date(rUpdated) > new Date(existingUpdated))) {
          (existing as any).updatedAt = rUpdated;
        }
      }
    }

    // Soft-warn định dạng HĐ / chất lượng ảnh → CAN_KIEM_TRA (không đẩy LECH oan vì ISO date / mép ảnh)
    for (const doc of groupedMap.values()) {
      const hdErrors: string[] = (doc.hopDong?.dinhDangLoi || []).filter(
        (e: string) => !/sai định dạng quy chuẩn|dùng tiếng Anh/i.test(e),
      );
      const imgWarns: string[] = doc.canCuoc?.canhBaoChatLuong || [];
      const soft = Array.from(new Set([...hdErrors, ...imgWarns]));
      if (soft.length > 0 && doc.ketLuan?.trangThai === 'KHOP') {
        const combinedErrors = Array.from(new Set([...(doc.ketLuan?.danhSachLoi || []), ...soft]));
        doc.ketLuan = {
          trangThai: 'CAN_KIEM_TRA',
          danhSachLoi: combinedErrors,
          reconciledAt: doc.ketLuan?.reconciledAt || new Date(),
        };
        if (doc._id) {
          this.cleanRecordModel
            .updateMany(
              { $or: [{ _id: doc._id }, { maTKGD: doc.maTKGD }, { maTKGDBase: doc.maTKGDBase }] },
              { $set: { 'ketLuan.trangThai': 'CAN_KIEM_TRA', 'ketLuan.danhSachLoi': combinedErrors } },
            )
            .exec()
            .catch(() => { });
        }
      }
    }

    const allGroupedList = Array.from(groupedMap.values());

    // Thống kê TOÀN BỘ đợt hồ sơ (không phụ thuộc vào trang hoặc tab filter hiện tại)
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

    // Áp dụng bộ lọc
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

    // Bù trừ 2 chiều in-memory nhanh (0ms, không I/O) cho dữ liệu trả về client
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
   * Cơ chế Bảo chứng Chéo qua Mã Băm Ảnh (Cross-Verified Fallback via MD5 Image Hash Matching)
   * Nếu ảnh đính kèm từ Mail và ảnh tải từ M-System trùng khớp 100% mã băm MD5
   * VÀ số CCCD trên Hợp đồng và M-System trùng khớp 100%
   * VÀ Họ tên trên Hợp đồng và M-System trùng khớp 100%
   * -> Tự động xác thực và làm giàu cho khối CCCD với source = 'VERIFIED_MS_HASH'
   */
  async verifyAndHealWithImageHash(record: any): Promise<boolean> {
    if (!record) return false;
    const baseCode = (record.maTKGDBase || record.maTKGD?.split('-')[0] || '').trim();
    if (!baseCode) return false;

    // Kiểm tra tính nhất quán giữa Hợp đồng và M-System
    const msCccd = (record.ms?.soCMND_HoChieu || record.ms?.cccdOcr_soCanCuoc || '').replace(/\D/g, '');
    const hdCccd = (record.hopDong?.soCanCuoc || '').replace(/\D/g, '');
    if (!msCccd || !hdCccd || msCccd !== hdCccd || msCccd.length !== 12) {
      return false;
    }

    const normName = (s: string) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    const msName = normName(record.ms?.hoVaTen || record.ms?.tenTKGD || '');
    const hdName = normName(record.hopDong?.hoVaTen || record.noiDungMail?.tenTaiKhoan || '');
    if (!msName || !hdName || msName !== hdName) {
      return false;
    }

    // Tìm thư mục chứa ảnh
    const candidates = [
      path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem', record.batchDate || '', baseCode),
      path.resolve(process.cwd(), 'data/temp_tkgd_attachments', baseCode),
      path.resolve(__dirname, '../../../data/temp_tkgd_attachments', baseCode),
      path.resolve('/opt/mxv-checklist/backend/data/temp_tkgd_attachments', baseCode),
      path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-08', baseCode),
      path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07', baseCode),
    ];
    const dir = candidates.find((p) => fs.existsSync(p));
    if (!dir) return false;

    try {
      const files = fs.readdirSync(dir);
      const isImg = (f: string) => ['.jpg', '.jpeg', '.png', '.webp', '.paint', '.heic', '.heif'].some((ext) => f.toLowerCase().endsWith(ext));
      const isMs = (f: string) => f.toLowerCase().includes('_ms_') || f.toLowerCase().startsWith(`${baseCode.toLowerCase()}_ms`);

      const mailImages = files.filter((f) => isImg(f) && !isMs(f));
      const msImages = files.filter((f) => isImg(f) && isMs(f));

      if (mailImages.length === 0 || msImages.length === 0) {
        return false;
      }

      const getMd5 = (fn: string) => {
        try {
          return crypto.createHash('md5').update(fs.readFileSync(path.join(dir, fn))).digest('hex');
        } catch {
          return null;
        }
      };

      let hasMatch = false;
      for (const mImg of mailImages) {
        const mMd5 = getMd5(mImg);
        if (!mMd5) continue;
        for (const sImg of msImages) {
          const sMd5 = getMd5(sImg);
          if (sMd5 && sMd5 === mMd5) {
            hasMatch = true;
            break;
          }
        }
        if (hasMatch) break;
      }

      if (!hasMatch) return false;

      // Bảo chứng chéo thành công!
      this.logger.log(`[MD5-VERIFIED] Tài khoản ${baseCode}: Ảnh Mail và MS trùng khớp MD5 100%! HĐ và MS trùng số CCCD (${msCccd}). Kích hoạt bảo chứng chéo.`);

      const updatedCanCuoc = {
        ...(record.canCuoc || {}),
        soCanCuoc: msCccd,
        hoVaTen: record.ms?.hoVaTen || record.hopDong?.hoVaTen,
        ngaySinh: record.canCuoc?.ngaySinh || record.ms?.ngaySinh || record.hopDong?.ngaySinh,
        rawNgaySinh: record.canCuoc?.rawNgaySinh || record.ms?.rawNgaySinh || record.hopDong?.rawNgaySinh,
        ngayCap: record.canCuoc?.ngayCap || record.ms?.ngayCap || record.hopDong?.ngayCap,
        rawNgayCap: record.canCuoc?.rawNgayCap || record.ms?.rawNgayCap || record.hopDong?.rawNgayCap,
        noiCap: record.canCuoc?.noiCap || record.ms?.noiCap || record.hopDong?.noiCap || 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
        gioiTinh: record.canCuoc?.gioiTinh || record.ms?.gioiTinh || record.hopDong?.gioiTinh,
        theGeneration: record.canCuoc?.theGeneration || 'CCCD_CHIP_2021',
        confidenceScore: 0.98,
        source: 'VERIFIED_MS_HASH',
        canhBaoChatLuong: [],
      };

      record.canCuoc = updatedCanCuoc;

      if (record._id) {
        await this.cleanRecordModel.updateMany(
          { $or: [{ _id: record._id }, { maTKGD: record.maTKGD }, { maTKGDBase: baseCode }] },
          { $set: { canCuoc: updatedCanCuoc } },
        );
      }

      return true;
    } catch (err: any) {
      this.logger.warn(`[MD5-VERIFIED] Lỗi khi kiểm tra MD5 cho ${baseCode}: ${err.message}`);
      return false;
    }
  }

  /**
   * Tự động làm giàu các trường còn thiếu (Ngày sinh, Giới tính, Nơi cấp) từ file đính kèm nếu có
   */
  private async enrichMissingCccdData(record: any): Promise<void> {
    if (!record) return;
    const baseCode = (record.maTKGDBase || record.maTKGD?.split('-')[0] || '').trim();
    if (!baseCode) return;

    // Thử kích hoạt bảo chứng chéo nếu ảnh Mail & MS trùng khớp MD5
    await this.verifyAndHealWithImageHash(record);

    // Chỉ bỏ qua nếu đã có đủ ngày sinh, giới tính, nơi cấp VÀ đã có phân loại thế hệ thẻ AI mới (và không dính số rác)
    if (
      record.canCuoc?.ngaySinh &&
      record.canCuoc?.gioiTinh &&
      (record.hopDong?.noiCap || record.canCuoc?.noiCap) &&
      record.canCuoc?.theGeneration &&
      record.canCuoc?.soCanCuoc &&
      !record.canCuoc?.soCanCuoc.startsWith('990') &&
      record.canCuoc?.hoVaTen !== 'UNN'
    ) {
      return;
    }

    try {
      const candidates = [
        path.resolve(process.cwd(), 'data/temp_tkgd_attachments', baseCode),
        path.resolve(__dirname, '../../../data/temp_tkgd_attachments', baseCode),
        path.resolve('/opt/mxv-checklist/backend/data/temp_tkgd_attachments', baseCode),
        path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem', record.batchDate || '', baseCode),
        path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-04', baseCode),
        path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-07', baseCode),
      ];
      const dir = candidates.find((p) => fs.existsSync(p));
      if (!dir) return;

      const files = fs.readdirSync(dir);
      const classified = classifyAccountFiles(files);
      const hopDong = classified.hopDongFile;
      let front = classified.cccdFrontImage;
      let back = classified.cccdBackImage;
      if (classified.cccdPdfFile) {
        // Ưu tiên tệp CCCD PDF chuyên dụng nếu các ảnh không có gợi ý mặt trước rõ ràng
        if (!front || !scoreDocumentType(front).isFrontHint) {
          front = classified.cccdPdfFile;
          back = undefined;
        }
      }

      if (front || back || hopDong) {
        const pyRes = await runPythonExtractor({
          accountCode: baseCode,
          hopDongPath: hopDong ? path.join(dir, hopDong) : undefined,
          cccdFrontPath: front ? path.join(dir, front) : undefined,
          cccdBackPath: back ? path.join(dir, back) : undefined,
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

          // Bù trừ 2 chiều: nếu HĐ có mà CCCD chưa có thì tạo CCCD từ HĐ
          if (record.hopDong && !record.canCuoc && (record.hopDong.soCanCuoc || record.hopDong.hoVaTen)) {
            record.canCuoc = {
              soCanCuoc: record.hopDong.soCanCuoc,
              hoVaTen: record.hopDong.hoVaTen,
              noiCap: record.hopDong.noiCap || 'BỘ CÔNG AN',
              ngayCap: record.hopDong.ngayCap,
              rawNgayCap: record.hopDong.rawNgayCap,
              gioiTinh: record.hopDong.gioiTinh,
              rawGioiTinh: record.hopDong.rawGioiTinh,
              ngaySinh: record.hopDong.ngaySinh,
              rawNgaySinh: record.hopDong.rawNgaySinh,
              source: 'HOP_DONG_SCAN',
            };
          }

          if (record.hopDong && record.canCuoc) {
            if (!record.hopDong.soCanCuoc && record.canCuoc.soCanCuoc) {
              record.hopDong.soCanCuoc = record.canCuoc.soCanCuoc;
            }
            if (!record.hopDong.ngaySinh && record.canCuoc.ngaySinh) {
              record.hopDong.ngaySinh = record.canCuoc.ngaySinh;
              record.hopDong.rawNgaySinh = record.canCuoc.rawNgaySinh;
            }
            if (!record.hopDong.gioiTinh && record.canCuoc.gioiTinh) {
              record.hopDong.gioiTinh = record.canCuoc.gioiTinh;
              record.hopDong.rawGioiTinh = record.canCuoc.gioiTinh;
            }
            if (!record.hopDong.noiCap && record.canCuoc.noiCap) {
              record.hopDong.noiCap = record.canCuoc.noiCap;
            }
            if (!record.canCuoc.soCanCuoc && record.hopDong.soCanCuoc) {
              record.canCuoc.soCanCuoc = record.hopDong.soCanCuoc;
            }
            if (!record.canCuoc.ngaySinh && record.hopDong.ngaySinh) {
              record.canCuoc.ngaySinh = record.hopDong.ngaySinh;
              record.canCuoc.rawNgaySinh = record.hopDong.rawNgaySinh;
            }
            if (!record.canCuoc.gioiTinh && record.hopDong.gioiTinh) {
              record.canCuoc.gioiTinh = record.hopDong.gioiTinh;
            }
            if (!record.canCuoc.noiCap && record.hopDong.noiCap) {
              record.canCuoc.noiCap = record.hopDong.noiCap;
            }
          }

          // Tự suy luận Giới tính & Năm sinh từ số CCCD 12 số nếu chưa có
          const cccdNum = record.hopDong?.soCanCuoc || record.canCuoc?.soCanCuoc;
          if (cccdNum) {
            const inferred = inferFromCCCD(cccdNum);
            if (inferred.gioiTinh) {
              if (record.hopDong && !record.hopDong.gioiTinh) {
                record.hopDong.gioiTinh = inferred.gioiTinh;
                record.hopDong.rawGioiTinh = inferred.gioiTinh;
              }
              if (record.canCuoc && !record.canCuoc.gioiTinh) {
                record.canCuoc.gioiTinh = inferred.gioiTinh;
              }
            }
            if (inferred.namSinh) {
              if (record.hopDong && !record.hopDong.rawNgaySinh && !record.hopDong.ngaySinh) {
                record.hopDong.rawNgaySinh = `${inferred.namSinh}`;
              }
              if (record.canCuoc && !record.canCuoc.rawNgaySinh && !record.canCuoc.ngaySinh) {
                record.canCuoc.rawNgaySinh = `${inferred.namSinh}`;
              }
            }
          }

          if (record.hopDong) updatePayload.hopDong = record.hopDong;
          if (record.canCuoc) updatePayload.canCuoc = record.canCuoc;

          // Làm giàu CCCD xong thì đánh giá lại toàn bộ — tránh giữ lỗi stale "chưa có MS"
          // và không đẩy LECH chỉ vì format ISO / cảnh báo ảnh.
          if (record.ms?.isFoundOnMS || record.ms?.soCMND_HoChieu || record.ms?.hoVaTen) {
            const { finalStatus, finalErrors } = this.evaluateRecordReconciliation(record);
            record.ketLuan = {
              trangThai: finalStatus,
              danhSachLoi: finalErrors,
              reconciledAt: new Date(),
            };
            updatePayload.ketLuan = record.ketLuan;
            updatePayload['ms.isFoundOnMS'] = true;
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
   * Đánh giá quy tắc đối soát chéo độc lập cho 1 hồ sơ CleanAccountRecord
   * Kế thừa 100% từ tkgd-reconcile-rules.helper (Single Source of Truth, hỗ trợ 2/3 consensus & CCCD chunk-swap)
   */
  public evaluateRecordReconciliation(record: any): { finalStatus: string; finalErrors: string[] } {
    const res = evaluateRecordReconciliationRule(record);
    return {
      finalStatus: res.finalStatus,
      finalErrors: res.finalErrors,
    };
  }

  /**
   * Kích hoạt chạy đối soát chéo, cập nhật trạng thái vào MongoDB và xuất file Excel
   */
  async runReconciliation(userEmail: string, batchDate?: string) {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    const query: any = {};
    if (batchDate) query.batchDate = batchDate;
    // Không limit chặt — tránh bỏ sót hồ sơ đã có MS khiến kết luận "chưa có MS" bị stale
    const records = await this.cleanRecordModel.find(query).sort({ createdAt: -1 }).limit(5000);

    this.updateProgress(userEmail, {
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
      this.updateProgress(userEmail, {
        current: rIdx + 1,
        total: records.length,
        percent: 20 + Math.round(((rIdx + 1) / records.length) * 60),
        currentCode: baseCode,
        stage: `Đang đối soát hồ sơ ${baseCode} (${rIdx + 1}/${records.length})...`,
      });
      await this.verifyAndHealWithImageHash(record);
      await this.enrichMissingCccdData(record);
    }

    const outDir = resolveTkgdOutputDir(config?.storage?.windowsPath);
    const dateStr = (batchDate || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
    const targetFile = path.join(outDir, `Auto_Data_mail_${dateStr}.xlsx`);

    // 1. ĐỐI SOÁT & CẬP NHẬT KẾT LUẬN VÀO RECORD & MONGODB TRƯỚC:
    // Đảm bảo dữ liệu in-memory và MongoDB có kết luận chuẩn xác nhất trước khi nạp vào template Excel
    const now = new Date();
    for (const record of records) {
      // CỔNG CHẶN BẢO VỆ DUYỆT TAY: Nếu hồ sơ đã được Cán bộ duyệt bằng tay thì tuyệt đối KHÔNG ghi đè kết luận máy!
      if (record.manualReview?.isOverridden) {
        this.logger.log(`[RECON] Hồ sơ ${record.maTKGD || record.maTKGDBase} đã được ${record.manualReview.approvedBy || 'Cán bộ'} phê duyệt tay. Giữ nguyên trạng thái.`);
        record.ketLuan = {
          trangThai: (record.manualReview.status || 'KHOP') as any,
          danhSachLoi: [],
          reconciledAt: now,
        };
        continue;
      }

      const { finalStatus, finalErrors } = this.evaluateRecordReconciliation(record);

      record.ketLuan = {
        trangThai: finalStatus as any,
        danhSachLoi: finalErrors,
        reconciledAt: now,
      };

      const setPayload: Record<string, any> = {
        'ketLuan.trangThai': finalStatus,
        'ketLuan.danhSachLoi': finalErrors,
        'ketLuan.reconciledAt': now,
        'hopDong.dinhDangLoi': record.hopDong?.dinhDangLoi || [],
        'canCuoc.canhBaoChatLuong': record.canCuoc?.canhBaoChatLuong || [],
      };
      // Heal flag stale: nếu evaluate đã xác nhận có MS thì ghi lại isFoundOnMS=true
      if (record.ms?.isFoundOnMS) {
        setPayload['ms.isFoundOnMS'] = true;
      }

      await this.cleanRecordModel.updateOne({ _id: record._id }, { $set: setPayload });
    }

    // 2. XUẤT FILE EXCEL: Kế thừa 100% kết quả chuẩn vừa đối soát (Khớp giao diện FE 100%)
    const summary: ReconcileSummary = await reconcileAndExportToExcel(records, {
      outputPath: targetFile,
    });

    this.updateProgress(userEmail, {
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
   * Nạp và bóc tách email yêu cầu mở TKGD từ Outlook vào MongoDB
   */
  async syncMailOpeningAccounts(
    userEmail: string,
    batchDateOrOptions?:
      | string
      | {
        batchDate?: string;
        fromDateTime?: string;
        toDateTime?: string;
        forceReparse?: boolean;
      },
  ) {
    this.updateProgress(userEmail, {
      isProcessing: true,
      taskType: 'SYNC_MAIL',
      current: 0,
      total: 1,
      percent: 10,
      stage: 'Đang kết nối Outlook và quét email mở TKGD...',
    });

    const options =
      typeof batchDateOrOptions === 'object'
        ? batchDateOrOptions
        : { batchDate: batchDateOrOptions };
    const todayStr = options?.batchDate || new Date().toISOString().slice(0, 10);
    const fromDateTime = options?.fromDateTime;
    const toDateTime = options?.toDateTime;
    const forceReparse = options?.forceReparse === true;

    const fromDateObj = fromDateTime ? new Date(fromDateTime) : undefined;
    const toDateObj = toDateTime ? new Date(toDateTime) : undefined;

    if (fromDateObj && !isNaN(fromDateObj.getTime())) {
      this.logger.log(`[TKGD-MAIL] Bộ lọc thời gian: từ ${fromDateObj.toLocaleString('vi-VN')} đến ${toDateObj ? toDateObj.toLocaleString('vi-VN') : 'hiện tại'}`);
    }

    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    let emailList: Array<{
      messageId: string;
      subject: string;
      senderEmail: string;
      senderName: string;
      receivedDateTime: Date;
      bodyRawText: string;
      attachments: any[];
    }> = [];

    // 1. Thử gọi Microsoft Graph API nếu đã kết nối Outlook
    this.logger.log(`[TKGD-MAIL] userEmail: ${userEmail}, hasRefreshToken: ${!!config?.outlook?.refreshToken}`);
    if (config?.outlook?.refreshToken) {
      try {
        const tenantId = config.outlook.tenantId || process.env.MICROSOFT_TENANT_ID || 'common';
        const clientId = config.outlook.clientId || process.env.MICROSOFT_CLIENT_ID || '';
        const clientSecret = config.outlook.clientSecret || (await this.getRawClientSecret(userEmail)) || process.env.MICROSOFT_CLIENT_SECRET || '';
        this.logger.log(`[TKGD-MAIL] tenantId: ${tenantId}, clientId: ${clientId}, hasClientSecret: ${!!clientSecret}`);

        const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: config.outlook.refreshToken,
          }),
        });

        this.logger.log(`[TKGD-MAIL] tokenRes status: ${tokenRes.status}`);
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;
          if (tokenData.refresh_token && tokenData.refresh_token !== config.outlook.refreshToken) {
            await this.userConfigModel.updateOne({ userEmail }, { 'outlook.refreshToken': tokenData.refresh_token });
          }

          const targetMailbox = config.outlook?.targetMailbox?.trim();
          const mailMatchFn = (m: any) => {
            const s = (m.subject || '').toLowerCase();
            const isMatch = s.includes('yêu cầu mở tkgd') || s.includes('mở tkgd') || s.includes('tài khoản giao dịch') || s.includes('mo tkgd');
            if (!isMatch) return false;
            if (m.receivedDateTime) {
              const d = new Date(m.receivedDateTime);
              if (fromDateObj && !isNaN(fromDateObj.getTime()) && d < fromDateObj) return false;
              if (toDateObj && !isNaN(toDateObj.getTime()) && d > toDateObj) return false;
            }
            return true;
          };

          const endpointsToTry: Array<{ url: string; paginated: boolean }> = [];
          if (targetMailbox && targetMailbox !== userEmail) {
            // Ưu tiên $search (nhanh, chính xác), fallback sang $top=50 có phân trang
            endpointsToTry.push(
              { url: `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages?$search="Yêu cầu mở TKGD"&$top=50`, paginated: true },
              { url: `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages?$top=50&$orderby=receivedDateTime desc`, paginated: true },
            );
          }
          endpointsToTry.push(
            { url: `https://graph.microsoft.com/v1.0/me/messages?$search="Yêu cầu mở TKGD"&$top=50`, paginated: true },
            { url: `https://graph.microsoft.com/v1.0/me/messages?$top=50&$orderby=receivedDateTime desc`, paginated: true },
          );

          let fetchedMessages: any[] = [];
          for (const endpoint of endpointsToTry) {
            this.logger.log(`[TKGD-MAIL] Quét Graph (paginated): ${endpoint.url}`);
            const matched = await this.fetchAllMatchingMailsFromGraph(
              endpoint.url,
              accessToken,
              mailMatchFn,
              10, // tối đa 10 trang × 50 = 500 email
              fromDateObj,
            );
            if (matched.length > 0) {
              fetchedMessages = matched;
              this.logger.log(`[TKGD-MAIL] Tìm thấy ${matched.length} email phù hợp (có phân trang).`);
              break;
            }
          }

          for (const msg of fetchedMessages) {
            const bodyRawText = htmlToPlainText(msg.body?.content || '') || msg.bodyPreview || '';

            // SMART SKIP TRƯỚC KHI TẢI ATTACHMENT NẶNG:
            // Phân tích sơ bộ mã tài khoản trong email; nếu đã có đủ trong DB ngày hôm nay -> SKIP ngay
            if (!forceReparse) {
              const previewGroups = parseAccountOpeningEmailMulti(bodyRawText);
              if (previewGroups && previewGroups.length > 0) {
                let allAccountsExist = true;
                for (const g of previewGroups) {
                  const baseCode = g.maTKGDBase;
                  if (!baseCode) continue;
                  const targetCode = g.maTKGDFutures || g.maTKGDACM || baseCode;
                  const existing = await this.cleanRecordModel.findOne({
                    batchDate: todayStr,
                    $or: [
                      { maTKGDBase: baseCode },
                      { maTKGD: targetCode },
                      { 'noiDungMail.maTKGD_Futures': baseCode },
                    ],
                  }).select('_id hopDong canCuoc').lean();

                  if (!existing || !existing.hopDong || !existing.canCuoc) {
                    allAccountsExist = false;
                    break;
                  }
                }
                if (allAccountsExist) {
                  // Đã đủ hồ sơ trong DB hôm nay -> BỎ QUA, không tải đính kèm nặng về RAM!
                  continue;
                }
              }
            }

            const msgAttachments: any[] = [];
            if (msg.hasAttachments) {
              try {
                const attachUrl = targetMailbox && targetMailbox !== userEmail
                  ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetMailbox)}/messages/${msg.id}/attachments`
                  : `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments`;
                const attachRes = await fetch(attachUrl, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (attachRes.ok) {
                  const aData = await attachRes.json();
                  for (const a of aData.value || []) {
                    const isSubstantialImage = a.contentType?.startsWith('image/') && (a.size || 0) >= 45000;
                    let dims: { width: number; height: number } | null = null;
                    if (a.contentBytes && a.contentType?.startsWith('image/')) {
                      try {
                        dims = probeImageDimensions(Buffer.from(a.contentBytes, 'base64'));
                      } catch { /* ignore */ }
                    }
                    if (
                      a.contentBytes &&
                      (!a.isInline || isSubstantialImage || isNamedCccdFront(a.name) || isNamedCccdBack(a.name)) &&
                      !isIgnoredEmailAttachment(a.name, a.size, dims)
                    ) {
                      msgAttachments.push({
                        name: a.name,
                        contentType: a.contentType,
                        contentBytes: a.contentBytes,
                        size: a.size,
                      });
                    }
                  }
                }
              } catch (err: any) {
                this.logger.warn(`[TKGD-MAIL] Không tải được attachments cho msg ${msg.id}: ${err.message}`);
              }
            }

            emailList.push({
              messageId: msg.id,
              subject: msg.subject || '',
              senderEmail: msg.sender?.emailAddress?.address || '',
              senderName: msg.sender?.emailAddress?.name || '',
              receivedDateTime: new Date(msg.receivedDateTime || Date.now()),
              bodyRawText,
              attachments: msgAttachments,
            });
          }
        } else {
          const errText = await tokenRes.text();
          this.logger.warn(`[TKGD-MAIL] Refresh token failed: ${errText}`);
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi gọi Microsoft Graph API (User Delegated): ${err.message}`);
      }
    }

    // 1b. Fallback: Nếu chưa có mail và hệ thống đã cấu hình M365 (kế thừa cấu hình từ Checklist Bot)
    if (emailList.length === 0 && this.settingsService) {
      try {
        const clientId = (await this.settingsService.getSetting('m365_client_id', '')) || process.env.MICROSOFT_CLIENT_ID || '';
        const clientSecret = (await this.settingsService.getSetting('m365_client_secret', '')) || process.env.MICROSOFT_CLIENT_SECRET || '';
        const tenantId = (await this.settingsService.getSetting('m365_tenant_id', '')) || process.env.MICROSOFT_TENANT_ID || '';
        const targetMailbox = config?.outlook?.targetMailbox?.trim() || (await this.settingsService.getSetting('m365_watcher_email', '')) || process.env.MICROSOFT_WATCHER_EMAIL || '';

        if (clientId && clientSecret && tenantId && targetMailbox) {
          this.logger.log(`[TKGD-MAIL] Thử quét mail qua M365 Client Credentials (kế thừa Checklist Bot) cho mailbox: ${targetMailbox}`);
          const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              scope: 'https://graph.microsoft.com/.default',
              client_secret: clientSecret,
              grant_type: 'client_credentials',
            }),
          });
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;
            // Dùng fetchAllMatchingMailsFromGraph (có phân trang) cho cả Client Credentials flow
            const ccMatchFn = (m: any) => {
              const s = (m.subject || '').toLowerCase();
              const isMatch = s.includes('yêu cầu mở tkgd') || s.includes('mở tkgd') || s.includes('tài khoản giao dịch') || s.includes('mo tkgd');
              if (!isMatch) return false;
              if (m.receivedDateTime) {
                const d = new Date(m.receivedDateTime);
                if (fromDateObj && !isNaN(fromDateObj.getTime()) && d < fromDateObj) return false;
                if (toDateObj && !isNaN(toDateObj.getTime()) && d > toDateObj) return false;
              }
              return true;
            };
            const ccEndpoints = [
              `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages?$search="Yêu cầu mở TKGD"&$top=50`,
              `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages?$top=50&$orderby=receivedDateTime desc`,
            ];
            for (const graphUrl of ccEndpoints) {
              const matched = await this.fetchAllMatchingMailsFromGraph(graphUrl, accessToken, ccMatchFn, 10, fromDateObj);
              if (matched.length > 0) {
                for (const msg of matched) {
                  const bodyRawText = htmlToPlainText(msg.body?.content || '') || msg.bodyPreview || '';

                  // SMART SKIP: Nếu tài khoản trong mail đã có đủ trong DB hôm nay -> bỏ qua tải tệp
                  if (!forceReparse) {
                    const previewGroups = parseAccountOpeningEmailMulti(bodyRawText);
                    if (previewGroups && previewGroups.length > 0) {
                      let allAccountsExist = true;
                      for (const g of previewGroups) {
                        const baseCode = g.maTKGDBase;
                        if (!baseCode) continue;
                        const targetCode = g.maTKGDFutures || g.maTKGDACM || baseCode;
                        const existing = await this.cleanRecordModel.findOne({
                          batchDate: todayStr,
                          $or: [
                            { maTKGDBase: baseCode },
                            { maTKGD: targetCode },
                            { 'noiDungMail.maTKGD_Futures': baseCode },
                          ],
                        }).select('_id hopDong canCuoc').lean();

                        if (!existing || !existing.hopDong || !existing.canCuoc) {
                          allAccountsExist = false;
                          break;
                        }
                      }
                      if (allAccountsExist) continue;
                    }
                  }

                  const msgAttachments: any[] = [];
                  if (msg.hasAttachments) {
                    try {
                      const attachUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetMailbox)}/messages/${msg.id}/attachments`;
                      const attachRes = await fetch(attachUrl, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                      });
                      if (attachRes.ok) {
                        const aData = await attachRes.json();
                        for (const a of aData.value || []) {
                          const isSubstantialImage = a.contentType?.startsWith('image/') && (a.size || 0) >= 45000;
                          let dims: { width: number; height: number } | null = null;
                          if (a.contentBytes && a.contentType?.startsWith('image/')) {
                            try {
                              dims = probeImageDimensions(Buffer.from(a.contentBytes, 'base64'));
                            } catch { /* ignore */ }
                          }
                          if (
                            a.contentBytes &&
                            (!a.isInline || isSubstantialImage || isNamedCccdFront(a.name) || isNamedCccdBack(a.name)) &&
                            !isIgnoredEmailAttachment(a.name, a.size, dims)
                          ) {
                            msgAttachments.push({
                              name: a.name,
                              contentType: a.contentType,
                              contentBytes: a.contentBytes,
                              size: a.size,
                            });
                          }
                        }
                      }
                    } catch (err: any) {
                      this.logger.warn(`[TKGD-MAIL] Không tải được attachments cho msg ${msg.id}: ${err.message}`);
                    }
                  }
                  emailList.push({
                    messageId: msg.id,
                    subject: msg.subject || '',
                    senderEmail: msg.sender?.emailAddress?.address || '',
                    senderName: msg.sender?.emailAddress?.name || '',
                    receivedDateTime: new Date(msg.receivedDateTime || Date.now()),
                    bodyRawText,
                    attachments: msgAttachments,
                  });
                }
                this.logger.log(`[TKGD-MAIL] Đã quét ${emailList.length} mail từ M365 Client Credentials (có phân trang)!`);
                break;
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`[TKGD-MAIL] Quét mail qua Client Credentials gặp lỗi: ${err.message}`);
      }
    }

    // 2. Fallback: Nếu không có mail từ Graph API, nạp từ thư mục mẫu POC thực tế
    if (emailList.length === 0) {
      const candidates = [
        path.resolve(process.cwd(), '../POC/TKGD-Automation/inputs/mail-outlook'),
        path.resolve(__dirname, '../../../../POC/TKGD-Automation/inputs/mail-outlook'),
        path.resolve(__dirname, '../../../../../POC/TKGD-Automation/inputs/mail-outlook'),
        path.resolve(process.cwd(), 'POC/TKGD-Automation/inputs/mail-outlook'),
      ];
      const mailSamplesDir = candidates.find((p) => fs.existsSync(p));
      if (mailSamplesDir) {
        const sampleDirs = fs
          .readdirSync(mailSamplesDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => path.join(mailSamplesDir, d.name));

        for (const dir of sampleDirs) {
          const dirName = path.basename(dir);
          const contentFile = path.join(dir, 'content.md');
          if (!fs.existsSync(contentFile)) continue;
          const bodyText = fs.readFileSync(contentFile, 'utf8');

          let senderEmail = 'dautuhanghoa@giacatloi.vn';
          const senderFile = path.join(dir, 'sender.md');
          if (fs.existsSync(senderFile)) senderEmail = fs.readFileSync(senderFile, 'utf8').trim();

          let subject = 'Yêu cầu mở TKGD';
          const subjectFile = path.join(dir, 'subject.md');
          if (fs.existsSync(subjectFile)) subject = fs.readFileSync(subjectFile, 'utf8').trim();

          const filesInDir = fs.readdirSync(dir);
          const sampleAttachments: any[] = [];
          for (const f of filesInDir) {
            const lower = f.toLowerCase();
            if (['content.md', 'sender.md', 'subject.md'].includes(lower) || isIgnoredEmailAttachment(f)) continue;
            sampleAttachments.push({
              name: f,
              filePath: path.join(dir, f),
              contentType: lower.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
            });
          }

          emailList.push({
            messageId: `sample_${dirName}_${todayStr.replace(/-/g, '')}`,
            subject,
            senderEmail,
            senderName: 'TVKD Gia Cát Lợi',
            receivedDateTime: new Date(),
            bodyRawText: bodyText,
            attachments: sampleAttachments,
          });
        }
      }
    }

    // 3. Bóc tách nội dung email và hồ sơ đính kèm rồi lưu vào MongoDB
    let processedCount = 0;
    for (const mail of emailList) {
      // 1. Lưu hoặc cập nhật Raw Mail (lưu 1 lần duy nhất cho messageId)
      await this.rawMailModel.findOneAndUpdate(
        { messageId: mail.messageId },
        {
          $set: {
            messageId: mail.messageId,
            subject: mail.subject,
            senderEmail: mail.senderEmail,
            senderName: mail.senderName,
            receivedDateTime: mail.receivedDateTime,
            bodyRawText: mail.bodyRawText,
            attachments: (mail.attachments || []).map((a: any) => ({
              name: a.name,
              contentType: a.contentType,
              size: a.size,
              filePath: a.filePath,
            })),
            status: 'PARSED',
          },
        },
        { upsert: true }
      );

      // 2. Bóc tách nội dung email (Hỗ trợ cả Email Đơn lẻ và Email Gom nhiều khách)
      const accountGroups = parseAccountOpeningEmailMulti(mail.bodyRawText);
      if (!accountGroups || accountGroups.length === 0) continue;

      for (let gIdx = 0; gIdx < accountGroups.length; gIdx++) {
        const group = accountGroups[gIdx];
        const baseCode = group.maTKGDBase;
        if (!baseCode) continue;

        this.updateProgress(userEmail, {
          isProcessing: true,
          taskType: 'SYNC_MAIL',
          current: processedCount + 1,
          total: Math.max(accountGroups.length, processedCount + 1),
          percent: Math.min(95, Math.round(((gIdx + 1) / accountGroups.length) * 100)),
          currentCode: baseCode,
          currentName: group.tenTaiKhoan || undefined,
          stage: `Đang bóc tách hợp đồng & OCR CCCD: ${baseCode} (${group.tenTaiKhoan || ''})`,
        });

        const targetAccountCode = group.maTKGDFutures || group.maTKGDACM || baseCode;

        // SMART SKIP: Nếu không yêu cầu bóc tách lại (forceReparse !== true)
        // và tài khoản này trong ngày đã được bóc tách có đủ HĐ & CCCD trong DB -> BỎ QUA NGAY!
        if (!forceReparse) {
          const existingRecord = await this.cleanRecordModel.findOne({
            batchDate: todayStr,
            $or: [
              { maTKGDBase: baseCode },
              { maTKGD: targetAccountCode },
              { 'noiDungMail.maTKGD_Futures': baseCode },
            ],
          }).lean();

          const isAlreadyFullyParsed = Boolean(
            existingRecord &&
            (existingRecord.hopDong?.hoVaTen || existingRecord.hopDong?.soCanCuoc) &&
            (existingRecord.canCuoc?.soCanCuoc || existingRecord.canCuoc?.theGeneration)
          );

          if (isAlreadyFullyParsed) {
            this.logger.log(`[TKGD-PARSE-SKIP] Hồ sơ ${baseCode} đã có đầy đủ HĐ & CCCD trong MongoDB. Bỏ qua chạy lại Python OCR.`);
            if (mail.receivedDateTime && existingRecord && !existingRecord.noiDungMail?.receivedDateTime) {
              await this.cleanRecordModel.updateOne(
                { _id: existingRecord._id },
                { $set: { 'noiDungMail.receivedDateTime': mail.receivedDateTime } }
              );
            }
            processedCount++;
            continue;
          }
        }

        // 3. Phân phối tệp đính kèm thông minh cho riêng khách hàng này
        const targetAttachments = dispatchAttachmentsForAccount(group, mail.attachments || []);

        let hopDongData: any = undefined;
        let phuLucData: any = undefined;
        let cccdData: any = undefined;

        if (targetAttachments && targetAttachments.length > 0) {
          const tempAccDir = path.join(process.cwd(), 'data', 'temp_tkgd_attachments', baseCode);
          if (!fs.existsSync(tempAccDir)) fs.mkdirSync(tempAccDir, { recursive: true });

          // Xác định thư mục lưu trữ hồ sơ đính kèm chính thức trên ổ mạng (HoSo_DinhKem/YYYY-MM-DD/MãTKGD)
          const officialAccDir = getTkgdAttachmentDirectory(
            config?.documentProcessing?.attachmentSavePath || config?.storage?.windowsPath,
            todayStr,
            baseCode,
          );

          let hopDongPath: string | undefined = undefined;
          let phuLucPath: string | undefined = undefined;
          const imageCandidates: Array<{ name: string; filePath: string; size?: number }> = [];
          let cccdPdfPath: string | undefined;

          for (const att of targetAttachments) {
            const attSize = att.size || (att.contentBytes ? Math.round(att.contentBytes.length * 0.75) : undefined);
            const nameLower = (att.name || '').toLowerCase();

            // Nếu có contentBytes, decode và probe kích thước ảnh thật trước khi lọc
            let fileBuf: Buffer | undefined;
            let dims: { width: number; height: number } | null = null;
            if (att.contentBytes) {
              fileBuf = Buffer.from(att.contentBytes, 'base64');
              if (/\.(png|jpe?g|webp|gif|paint|heic|heif)$/i.test(nameLower)) {
                dims = probeImageDimensions(fileBuf);
              }
            }

            if (isIgnoredEmailAttachment(att.name, attSize, dims)) {
              this.logger.log(`[TKGD-MAIL] Bỏ qua tệp không phải hồ sơ: ${att.name} (${attSize || '?'}B, ${dims ? `${dims.width}x${dims.height}` : 'no-dim'})`);
              continue;
            }

            let targetFilePath = att.filePath;

            if (fileBuf) {
              targetFilePath = path.join(tempAccDir, att.name);
              fs.writeFileSync(targetFilePath, fileBuf);

              // Lưu trực tiếp file đính kèm vào thư mục HoSo_DinhKem
              if (officialAccDir) {
                try {
                  const officialFilePath = path.join(officialAccDir, att.name);
                  fs.writeFileSync(officialFilePath, fileBuf);
                } catch (saveErr: any) {
                  this.logger.warn(`[TKGD-MAIL] Không thể lưu file đính kèm vào HoSo_DinhKem: ${saveErr.message}`);
                }
              }
            } else if (targetFilePath && fs.existsSync(targetFilePath) && officialAccDir) {
              try {
                const officialFilePath = path.join(officialAccDir, path.basename(targetFilePath));
                fs.copyFileSync(targetFilePath, officialFilePath);
              } catch { }
            }

            if (targetFilePath && fs.existsSync(targetFilePath)) {
              if (nameLower.endsWith('.pdf')) {
                if (isNamedCccdPdf(att.name)) {
                  if (!cccdPdfPath) cccdPdfPath = targetFilePath;
                } else if (nameLower.includes('pl01') || nameLower.includes('phuluc') || nameLower.includes('-pl')) {
                  phuLucPath = targetFilePath;
                } else if (nameLower.includes('mxv') || nameLower.includes('hopdong') || nameLower.includes('hd') || !hopDongPath) {
                  hopDongPath = targetFilePath;
                }
              } else if (['.jpg', '.jpeg', '.png', '.webp', '.paint', '.heic', '.heif'].some((ext) => nameLower.endsWith(ext))) {
                if (isNamedContractImage(att.name)) {
                  if (!hopDongPath) hopDongPath = targetFilePath;
                } else {
                  imageCandidates.push({ name: att.name || path.basename(targetFilePath), filePath: targetFilePath, size: attSize });
                }
              }
            }
          }

          const picked = pickCccdImagePaths(imageCandidates);
          const cccdFrontPath = picked.frontPath || cccdPdfPath;
          const cccdBackPath = picked.backPath;

          // Gọi Python Worker trích xuất chính xác 100%
          try {
            const pythonRes = await runPythonExtractor({
              accountCode: baseCode,
              accountName: group.tenTaiKhoan,
              hopDongPath,
              phuLucPath,
              cccdFrontPath,
              cccdBackPath,
            });

            if (pythonRes) {
              if (pythonRes.hopDong && (pythonRes.hopDong.hoTen || pythonRes.hopDong.soCCCD || pythonRes.hopDong.soHopDong || hopDongPath)) {
                hopDongData = {
                  maTKGD: pythonRes.hopDong.maTKGD || baseCode,
                  hoVaTen: pythonRes.hopDong.hoTen || (isLikelyValidPersonName(group.tenTaiKhoan) ? group.tenTaiKhoan : undefined),
                  soCanCuoc: pythonRes.hopDong.soCCCD,
                  ngaySinh: parseDate(pythonRes.hopDong.ngaySinh),
                  rawNgaySinh: pythonRes.hopDong.rawNgaySinh,
                  ngayCap: parseDate(pythonRes.hopDong.ngayCap),
                  rawNgayCap: pythonRes.hopDong.rawNgayCap,
                  noiCap: pythonRes.hopDong.noiCap || undefined,
                  ngayKyHD: parseDate(pythonRes.hopDong.ngayKyHD),
                  rawNgayKyHD: pythonRes.hopDong.rawNgayKyHD,
                  gioiTinh: pythonRes.hopDong.gioiTinh,
                  rawGioiTinh: pythonRes.hopDong.rawGioiTinh,
                  dinhDangLoi: pythonRes.hopDong.dinhDangLoi || [],
                  loaiHinhTaiKhoan: 'Cá nhân',
                  chuKy: pythonRes.hopDong.hasSignature ? 'Đã ký' : 'Chưa ký',
                };
              }

              if (pythonRes.phuLuc && (pythonRes.phuLuc.isPl01 || phuLucPath)) {
                phuLucData = {
                  maTKGD: pythonRes.phuLuc.maTKGD || `${baseCode}-A`,
                  hoVaTen: pythonRes.phuLuc.tenKH || (isLikelyValidPersonName(group.tenTaiKhoan) ? group.tenTaiKhoan : undefined),
                  ngayKyHD: parseDate(pythonRes.phuLuc.ngayKyHD),
                  rawNgayKyHD: pythonRes.phuLuc.rawNgayKyHD,
                  chuKy: pythonRes.phuLuc.hasSignature ? 'Đã ký' : 'Chưa ký',
                };
              }

              if (pythonRes.canCuoc && (pythonRes.canCuoc.soCCCD || pythonRes.canCuoc.hoTen || pythonRes.canCuoc.ngaySinh || (pythonRes.canCuoc.canhBaoChatLuong && pythonRes.canCuoc.canhBaoChatLuong.length > 0))) {
                const rawDob = pythonRes.canCuoc.rawNgaySinh || pythonRes.canCuoc.ngaySinh;
                const rawCap = pythonRes.canCuoc.rawNgayCap || pythonRes.canCuoc.ngayCap;
                const noiCapFinal = pythonRes.canCuoc.noiCap || pythonRes.hopDong?.noiCap || hopDongData?.noiCap || undefined;
                cccdData = {
                  hoVaTen: pythonRes.canCuoc.hoTen || hopDongData?.hoVaTen || (isLikelyValidPersonName(group.tenTaiKhoan) ? group.tenTaiKhoan : undefined),
                  soCanCuoc: pythonRes.canCuoc.soCCCD || hopDongData?.soCanCuoc,
                  ngaySinh: parseDate(pythonRes.canCuoc.ngaySinh) || hopDongData?.ngaySinh,
                  rawNgaySinh: rawDob || hopDongData?.rawNgaySinh,
                  ngayCap: parseDate(pythonRes.canCuoc.ngayCap) || hopDongData?.ngayCap,
                  rawNgayCap: rawCap || hopDongData?.rawNgayCap,
                  gioiTinh: pythonRes.canCuoc.gioiTinh || hopDongData?.gioiTinh,
                  noiCap: noiCapFinal,
                  diaChiThuongTru: pythonRes.canCuoc.diaChi,
                  canhBaoChatLuong: pythonRes.canCuoc.canhBaoChatLuong || [],
                  ocrConfidence: pythonRes.canCuoc.source || 'OCR',
                  theGeneration: pythonRes.canCuoc.theGeneration,
                  confidenceScore: pythonRes.canCuoc.confidenceScore,
                  boundingBoxes: pythonRes.canCuoc.boundingBoxes,
                  cccdMatTruocLocalPath: (pythonRes.canCuoc as any)?.cccdMatTruocLocalPath || pythonRes.canCuocPreviewFront || (cccdFrontPath?.endsWith('.pdf') ? undefined : cccdFrontPath),
                  cccdMatSauLocalPath: (pythonRes.canCuoc as any)?.cccdMatSauLocalPath || pythonRes.canCuocPreviewBack || (cccdBackPath?.endsWith('.pdf') ? undefined : cccdBackPath),
                };
              }

              // Tự động kế thừa tên chuẩn sang group.tenTaiKhoan nếu tên trên mail bị rác hoặc thiếu
              const docNameCandidate = hopDongData?.hoVaTen || phuLucData?.hoVaTen || cccdData?.hoVaTen;
              if (!isLikelyValidPersonName(group.tenTaiKhoan) && docNameCandidate) {
                group.tenTaiKhoan = docNameCandidate;
                group.tenTK = docNameCandidate;
              }
            }
          } catch (pyErr: any) {
            this.logger.warn(`[PYTHON-EXTRACT] Fallback sang TS cho ${baseCode}: ${pyErr.message}`);
          }

          // Fallback TypeScript nếu Python chưa trả về hopDongData
          if (!hopDongData && !phuLucData) {
            for (const att of targetAttachments) {
              const nameLower = (att.name || '').toLowerCase();
              let fileBuffer: Buffer | null = null;
              if (att.contentBytes) {
                fileBuffer = Buffer.from(att.contentBytes, 'base64');
              } else if (att.filePath && fs.existsSync(att.filePath)) {
                fileBuffer = fs.readFileSync(att.filePath);
              }

              if (fileBuffer && nameLower.endsWith('.pdf')) {
                if (nameLower.includes('pl01') || nameLower.includes('phuluc') || nameLower.includes('-pl')) {
                  phuLucData = await extractPhuLucPdf(fileBuffer, att.name);
                  if (phuLucData) {
                    phuLucData.maTKGD = group.maTKGDACM || `${baseCode}-A`;
                    phuLucData.hoVaTen = group.tenTaiKhoan || phuLucData.hoVaTen;
                  }
                } else if (nameLower.includes('mxv') || nameLower.includes('hopdong') || nameLower.includes('hd') || !hopDongData) {
                  hopDongData = await extractHopDongPdf(fileBuffer, att.name);
                  if (hopDongData) {
                    hopDongData.maTKGD = group.maTKGDFutures || baseCode;
                    hopDongData.hoVaTen = group.tenTaiKhoan || hopDongData.hoVaTen;
                  }
                }
              }
            }
          }
        }

        // Bù trừ chéo giữa Hợp đồng và Phụ lục nếu một bên bị thiếu
        if (phuLucData) {
          if (hopDongData) {
            hopDongData.soCanCuoc = hopDongData.soCanCuoc || phuLucData.soCanCuoc;
            hopDongData.ngayCap = hopDongData.ngayCap || phuLucData.ngayCap;
            hopDongData.noiCap = hopDongData.noiCap || phuLucData.noiCap;
          } else if (phuLucData.soCanCuoc) {
            hopDongData = {
              maTKGD: group.maTKGDFutures || baseCode,
              hoVaTen: group.tenTaiKhoan || phuLucData.hoVaTen,
              soCanCuoc: phuLucData.soCanCuoc,
              ngayCap: phuLucData.ngayCap,
              noiCap: phuLucData.noiCap,
              ngayKyHD: phuLucData.ngayKyHD,
              loaiHinhTaiKhoan: 'Cá nhân',
              chuKy: 'Đã ký',
            };
          }
        }

        // Bù trừ chéo 2 chiều giữa Hợp đồng và Căn cước công dân:
        if (hopDongData && cccdData) {
          // Bù trừ từ CCCD sang Hợp đồng (rất quan trọng với Form TVKD 003 không in Ngày sinh/Giới tính trên HĐ giấy)
          if (!hopDongData.ngaySinh && cccdData.ngaySinh) {
            hopDongData.ngaySinh = cccdData.ngaySinh;
            hopDongData.rawNgaySinh = cccdData.rawNgaySinh;
          }
          if (!hopDongData.gioiTinh && cccdData.gioiTinh) {
            hopDongData.gioiTinh = cccdData.gioiTinh;
            hopDongData.rawGioiTinh = cccdData.gioiTinh;
          }
          if (!hopDongData.noiCap && cccdData.noiCap) {
            hopDongData.noiCap = cccdData.noiCap;
          }
          if (!hopDongData.soCanCuoc && cccdData.soCanCuoc) {
            hopDongData.soCanCuoc = cccdData.soCanCuoc;
          }

          // Bù trừ từ Hợp đồng sang CCCD
          if (!cccdData.ngaySinh && hopDongData.ngaySinh) {
            cccdData.ngaySinh = hopDongData.ngaySinh;
            cccdData.rawNgaySinh = hopDongData.rawNgaySinh;
          }
          if (!cccdData.gioiTinh && hopDongData.gioiTinh) {
            cccdData.gioiTinh = hopDongData.gioiTinh;
          }
          if (!cccdData.noiCap && hopDongData.noiCap) {
            cccdData.noiCap = hopDongData.noiCap;
          }
          if (!cccdData.ngayCap && hopDongData.ngayCap) {
            cccdData.ngayCap = hopDongData.ngayCap;
            cccdData.rawNgayCap = hopDongData.rawNgayCap;
          }
        } else if (hopDongData && !cccdData && (hopDongData.soCanCuoc || hopDongData.ngaySinh || hopDongData.ngayCap)) {
          cccdData = {
            hoVaTen: hopDongData.hoVaTen || group.tenTaiKhoan,
            soCanCuoc: hopDongData.soCanCuoc,
            ngaySinh: hopDongData.ngaySinh,
            rawNgaySinh: hopDongData.rawNgaySinh,
            ngayCap: hopDongData.ngayCap,
            rawNgayCap: hopDongData.rawNgayCap,
            noiCap: hopDongData.noiCap,
            gioiTinh: hopDongData.gioiTinh,
            rawGioiTinh: hopDongData.rawGioiTinh,
          };
        } else if (!hopDongData && cccdData) {
          hopDongData = {
            maTKGD: group.maTKGDFutures || baseCode,
            hoVaTen: cccdData.hoVaTen || group.tenTaiKhoan,
            soCanCuoc: cccdData.soCanCuoc,
            ngaySinh: cccdData.ngaySinh,
            rawNgaySinh: cccdData.rawNgaySinh,
            ngayCap: cccdData.ngayCap,
            rawNgayCap: cccdData.rawNgayCap,
            gioiTinh: cccdData.gioiTinh,
            rawGioiTinh: cccdData.gioiTinh,
            noiCap: cccdData.noiCap,
            loaiHinhTaiKhoan: 'Cá nhân',
            chuKy: 'Đã ký',
          };
        }

        // Tự động suy luận từ số CCCD 12 số nếu vẫn còn thiếu Giới tính hoặc Năm sinh
        const cccdNumber = hopDongData?.soCanCuoc || cccdData?.soCanCuoc;
        if (cccdNumber) {
          const inferred = inferFromCCCD(cccdNumber);
          if (inferred.gioiTinh) {
            if (hopDongData && !hopDongData.gioiTinh) {
              hopDongData.gioiTinh = inferred.gioiTinh;
              hopDongData.rawGioiTinh = inferred.gioiTinh;
            }
            if (cccdData && !cccdData.gioiTinh) {
              cccdData.gioiTinh = inferred.gioiTinh;
            }
          }
          if (inferred.namSinh) {
            if (hopDongData && !hopDongData.rawNgaySinh && !hopDongData.ngaySinh) {
              hopDongData.rawNgaySinh = `${inferred.namSinh}`;
            }
            if (cccdData && !cccdData.rawNgaySinh && !cccdData.ngaySinh) {
              cccdData.rawNgaySinh = `${inferred.namSinh}`;
            }
          }
        }

        // ĐẶC BIỆT: Bịt kẽ hở 1 - Ràng buộc theo batchDate khi tìm kiếm bản ghi cũ
        const existingRecord = await this.cleanRecordModel.findOne({
          batchDate: todayStr,
          $or: [
            { maTKGDBase: baseCode },
            { maTKGD: targetAccountCode },
            { 'noiDungMail.maTKGD_Futures': baseCode },
          ],
        });

        const finalDocName = hopDongData?.hoVaTen || phuLucData?.hoVaTen || cccdData?.hoVaTen || '';
        const validMailName = isLikelyValidPersonName(group.tenTaiKhoan) ? group.tenTaiKhoan : '';
        const existingMailName = isLikelyValidPersonName((existingRecord?.noiDungMail as any)?.tenTaiKhoan)
          ? (existingRecord?.noiDungMail as any)?.tenTaiKhoan
          : '';
        const currentMailName = validMailName || finalDocName || existingMailName || '';

        const noiDungMailData = {
          maTKGD_Futures: group.maTKGDFutures || baseCode,
          maTKGD_ACM: group.maTKGDACM || (group.hasACMRequest ? `${baseCode}-A` : undefined),
          maTKGD_LME: group.hasLMERequest ? `${baseCode}-L` : undefined,
          maTKGD_Spread: group.hasSpreadRequest ? `${baseCode}-S` : undefined,
          tenTaiKhoan: currentMailName,
          hasACMRequest: group.hasACMRequest,
          hasLMERequest: group.hasLMERequest,
          hasSpreadRequest: group.hasSpreadRequest,
          receivedDateTime: mail.receivedDateTime || new Date(),
        };

        if (existingRecord) {
          const currentNoiDung = (existingRecord.noiDungMail as any)?.toObject
            ? (existingRecord.noiDungMail as any).toObject()
            : existingRecord.noiDungMail || {};
          existingRecord.noiDungMail = {
            ...currentNoiDung,
            ...noiDungMailData,
          } as any;
          if (!existingRecord.maTKGDBase) existingRecord.maTKGDBase = baseCode;
          if (!existingRecord.batchDate) existingRecord.batchDate = todayStr;
          if (hopDongData) existingRecord.hopDong = hopDongData;
          if (phuLucData) existingRecord.phuLuc = phuLucData;
          if (cccdData) existingRecord.canCuoc = cccdData;

          // Nếu đã có thông tin MS, tự động đối soát lại ngay lập tức
          if (existingRecord.ms && existingRecord.ms.isFoundOnMS) {
            const { finalStatus, finalErrors } = this.evaluateRecordReconciliation(existingRecord);
            existingRecord.ketLuan = {
              trangThai: finalStatus,
              danhSachLoi: finalErrors,
              reconciledAt: new Date(),
            } as any;
          }

          await existingRecord.save();
        } else {
          await this.cleanRecordModel.create({
            batchDate: todayStr,
            maTVKD: group.maTVKD || baseCode.substring(0, 3),
            maTKGD: targetAccountCode,
            maTKGDBase: baseCode,
            noiDungMail: noiDungMailData as any,
            hopDong: hopDongData,
            phuLuc: phuLucData,
            canCuoc: cccdData,
            ms: {
              maTKGD: baseCode,
              isFoundOnMS: false,
            } as any,
            ketLuan: {
              trangThai: 'CHUA_XU_LY',
              danhSachLoi: ['Chưa cào dữ liệu từ M-System'],
            } as any,
          });
        }
        processedCount++;
      }
      // GIẢI PHÓNG BỘ NHỚ RAM: giải phóng mảng attachments của email vừa xử lý
      mail.attachments = [];
      delete (mail as any).attachments;
    }

    this.updateProgress(userEmail, {
      isProcessing: false,
      taskType: 'IDLE',
      percent: 100,
      stage: `Hoàn tất bóc tách ${processedCount} hồ sơ từ email Outlook!`,
    });

    await this.logActivity({
      action: 'SYNC_MAIL',
      title: 'Nạp & bóc tách email Outlook',
      details: `Đã nạp và bóc tách thành công ${processedCount} hồ sơ từ email Outlook`,
      userEmail,
      metadata: { processedCount },
    });

    return {
      success: true,
      count: processedCount,
      message: `Đã nạp và bóc tách thành công ${processedCount} hồ sơ từ email Outlook!`,
    };
  }

  /**
   * Đồng bộ dữ liệu chi tiết nhà đầu tư từ M-System (RPA)
   * TỰ ĐỘNG ĐỐI SOÁT NGAY LẬP TỨC SAU KHI CÀO XONG!
   */
  async syncMSystemAccounts(
    userEmail: string,
    options?: { investorCode?: string; downloadImages?: boolean; batchDate?: string }
  ) {
    this.updateProgress(userEmail, {
      isProcessing: true,
      taskType: 'SYNC_MS',
      current: 0,
      total: 1,
      percent: 5,
      stage: 'Đang khởi động trình duyệt và đăng nhập M-System...',
    });

    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    let username = config?.msystem?.username;
    let password = config?.msystem?.passwordEncrypted ? decrypt(config.msystem.passwordEncrypted) : '';
    let pin = config?.msystem?.pinEncrypted ? decrypt(config.msystem.pinEncrypted) : '';

    // NẾU CHƯA CÓ TRONG CẤU HÌNH CÁ NHÂN, TỰ ĐỘNG KẾ THỪA TỪ CẤU HÌNH HỆ THỐNG (GIỐNG CHECKLIST BOT)
    if ((!username || !password) && this.settingsService) {
      try {
        const credentialsRaw = await this.settingsService.getSetting('bot_credentials_msystem', '');
        if (credentialsRaw) {
          const creds = JSON.parse(decrypt(credentialsRaw));
          username = username || creds.username;
          password = password || creds.password;
          pin = pin || creds.pin;
          this.logger.log(`[TKGD-MS] Đã tự động kế thừa tài khoản M-System từ cấu hình Checklist Bot (${username})!`);
        }
      } catch (err: any) {
        this.logger.warn(`[TKGD-MS] Không thể giải mã credentials từ SystemSettings: ${err.message}`);
      }
    }

    if (!username || !password) {
      throw new Error('Chưa cấu hình thông tin tài khoản M-System hoặc mật khẩu trong Tab Cài Đặt (hoặc trong Bot Credentials của hệ thống)!');
    }

    // 1. Xác định danh sách tài khoản cần cào
    let codesToScrape: string[] = [];
    const todayStr = options?.batchDate || new Date().toISOString().slice(0, 10);
    if (options?.investorCode && options.investorCode.trim()) {
      codesToScrape = [options.investorCode.trim().split('-')[0]];
    } else {
      const batchLimit = Math.max(1, Math.min(config?.autoPipeline?.batchSize || 10, 20));

      // Ưu tiên 1: Hồ sơ chờ của ngày chỉ định (hoặc hôm nay), mới nhất lên đầu
      let pendingRecords = await this.cleanRecordModel
        .find({
          batchDate: todayStr,
          $or: [
            { 'ms.isFoundOnMS': { $ne: true } },
            { ms: null },
          ],
        })
        .sort({ createdAt: -1 })
        .limit(batchLimit);

      // Ưu tiên 2 (Fallback): Nếu ngày chỉ định không còn hồ sơ nào chờ, tự động quét hồ sơ chờ gần nhất chưa có MS
      if (pendingRecords.length === 0) {
        pendingRecords = await this.cleanRecordModel
          .find({
            $or: [
              { 'ms.isFoundOnMS': { $ne: true } },
              { ms: null },
              { 'ketLuan.trangThai': 'CHUA_XU_LY' },
            ],
          })
          .sort({ createdAt: -1 })
          .limit(batchLimit);
      }

      codesToScrape = Array.from(new Set(
        pendingRecords.map((r) => r.maTKGDBase || r.noiDungMail?.maTKGD_Futures || r.maTKGD?.split('-')[0] || '').filter(Boolean)
      ));
    }

    if (codesToScrape.length === 0) {
      return {
        success: true,
        scrapedCount: 0,
        message: 'Tất cả hồ sơ đã có thông tin M-System đầy đủ!',
      };
    }

    const shouldDownloadImages = options?.downloadImages !== undefined
      ? options.downloadImages
      : (config?.documentProcessing?.autoSaveMSystemImages ?? true);
    const executablePath = findBrowserExecutable();
    const browser = await chromium.launch({
      ...(executablePath ? { executablePath } : {}),
      headless: process.env.HEADLESS_BOT !== 'false' && process.env.PLAYWRIGHT_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-extensions',
        '--window-size=1280,800',
      ],
    });

    let scrapedCount = 0;

    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });
      const page = await context.newPage();
      // Áp dụng kỹ thuật Anti-bot chuẩn từ Checklist Bot (rpa-downloader.service.ts)
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      page.setDefaultTimeout(35000);

      page.on('console', (msg) => this.logger.debug(`[TKGD MS Console] [${msg.type()}] ${msg.text()}`));
      page.on('pageerror', (err) => this.logger.error(`[TKGD MS PageError] ${err.message}`, err.stack));

      // 2. Đăng nhập M-System (áp dụng logic Checklist Bot)
      this.logger.log(`[TKGD-MS] Điều hướng tới trang đăng nhập M-System...`);
      await page.goto('https://msadmin.mxv.com.vn/#/login', { waitUntil: 'load' });
      await page.waitForTimeout(1500);

      await page.waitForSelector('input[name="username"], input[type="text"]', { state: 'visible', timeout: 15000 });
      await page.fill('input[name="username"], input[type="text"]', username);
      await page.fill('input[name="password"], input[type="password"]', password);
      await page.waitForTimeout(500);
      await page.click('button.btn-primary, button[type="submit"]');

      // 3. Bấm mã PIN ảo (áp dụng cơ chế retry 3 lần và quét lỗi giao diện như Checklist Bot)
      this.logger.log(`[TKGD-MS] Chờ hiển thị bảng mã PIN ảo...`);
      let pinModalVisible = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        pinModalVisible = await page.locator('div.pincode').isVisible({ timeout: 5000 }).catch(() => false);
        if (pinModalVisible) break;

        const loginError = await this.checkForLoginErrors(page);
        if (loginError) {
          throw new Error(`Đăng nhập M-System thất bại: ${loginError}`);
        }

        this.logger.warn(`[TKGD-MS] Chưa hiển thị bảng PIN (thử lần ${attempt}), thử click lại nút Đăng nhập...`);
        await page.click('button.btn-primary, button[type="submit"]').catch(() => { });
        await page.waitForTimeout(2000);
      }

      if (!pinModalVisible) {
        const loginError = await this.checkForLoginErrors(page);
        if (loginError) {
          throw new Error(`Đăng nhập M-System thất bại: ${loginError}`);
        }
        throw new Error('Đăng nhập M-System thất bại: Không thấy bảng mã PIN ảo (div.pincode) xuất hiện sau 3 lần thử.');
      }

      if (pin) {
        for (const digit of String(pin)) {
          const checklistDigitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
          const genericBtn = page.locator('.pincode .keyboard .button').filter({ hasText: new RegExp(`^\\s*${digit}\\s*$`) }).first();

          const hasChecklistBtn = await page.locator(checklistDigitSelector).isVisible({ timeout: 1000 }).catch(() => false);
          if (hasChecklistBtn) {
            await page.click(checklistDigitSelector);
          } else if (await genericBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await genericBtn.click();
          }
          await page.waitForTimeout(400);
        }
        await page.waitForTimeout(2500);
      }

      // 4. Xác minh đăng nhập thành công (giống Checklist Bot)
      await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => { });

      // 5. Cào chi tiết từng tài khoản (Bọc try-catch riêng để lỗi 1 hồ sơ không làm hỏng cả mẻ)
      for (let cIdx = 0; cIdx < codesToScrape.length; cIdx++) {
        const code = codesToScrape[cIdx];
        this.updateProgress(userEmail, {
          isProcessing: true,
          taskType: 'SYNC_MS',
          current: cIdx + 1,
          total: codesToScrape.length,
          percent: Math.min(95, Math.round(((cIdx + 1) / codesToScrape.length) * 100)),
          currentCode: code,
          stage: `Đang cào dữ liệu M-System: ${code} (${cIdx + 1}/${codesToScrape.length})...`,
        });
        try {
          let saveImagesDir: string | undefined = undefined;
          if (shouldDownloadImages) {
            saveImagesDir = getTkgdAttachmentDirectory(config?.documentProcessing?.attachmentSavePath, todayStr, code);
          }

          const scraped = await scrapeInvestorDetailFromMSystem(page, code, 'https://msadmin.mxv.com.vn', saveImagesDir);

          await this.cleanRecordModel.updateMany(
            {
              $or: [
                { maTKGDBase: code },
                { maTKGD: new RegExp(`^${code}`, 'i') },
                { 'noiDungMail.maTKGD_Futures': code },
              ],
            },
            {
              $set: {
                ms: {
                  maTKGD: scraped.maTKGD || code,
                  tenTKGD: scraped.tenTKGD,
                  hoVaTen: scraped.hoVaTen,
                  soCMND_HoChieu: scraped.soCMND_HoChieu,
                  ngaySinh: scraped.ngaySinh,
                  rawNgaySinh: scraped.rawNgaySinh,
                  ngayCap: scraped.ngayCap,
                  rawNgayCap: scraped.rawNgayCap,
                  noiCap: scraped.noiCap,
                  gioiTinh: scraped.gioiTinh,
                  ngayThamGia: scraped.ngayThamGia,
                  loaiHinhTaiKhoan: scraped.loaiHinhTaiKhoan,
                  diaChi: scraped.diaChi,
                  trangThai: scraped.trangThai,
                  chuKy: scraped.chuKy,
                  cccdMatTruocLocalPath: scraped.cccdMatTruocLocalPath,
                  cccdMatSauLocalPath: scraped.cccdMatSauLocalPath,
                  chuKyLocalPath: scraped.chuKyLocalPath,
                  isFoundOnMS: scraped.isFoundOnMS,
                },
              },
            }
          );
          scrapedCount++;

          // ĐỐI SOÁT TỨC THÌ (Instant Single Record Reconciliation):
          // Ngay khi có dữ liệu MS, đánh giá quy tắc đối soát chéo 3 bên và CẬP NHẬT ĐỒNG BỘ ketLuan ngay lập tức
          const updatedRecords = await this.cleanRecordModel.find({
            $or: [
              { maTKGDBase: code },
              { maTKGD: new RegExp(`^${code}`, 'i') },
              { 'noiDungMail.maTKGD_Futures': code },
            ],
          });
          const nowRecon = new Date();
          for (const rec of updatedRecords) {
            // Không ghi đè nếu hồ sơ đã được duyệt tay
            if (rec.manualReview?.isOverridden) continue;

            const evalResult = this.evaluateRecordReconciliation(rec);
            await this.cleanRecordModel.updateOne(
              { _id: rec._id },
              {
                $set: {
                  'ketLuan.trangThai': evalResult.finalStatus,
                  'ketLuan.danhSachLoi': evalResult.finalErrors,
                  'ketLuan.reconciledAt': nowRecon,
                  trangThaiDoiSoat: evalResult.finalStatus,
                  lyDoLoi: evalResult.finalErrors,
                  daDoiSoat: true,
                  thoiGianDoiSoat: nowRecon,
                },
              }
            );
          }
        } catch (err: any) {
          this.logger.error(`[TKGD-MS] Lỗi khi cào tài khoản ${code}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`[TKGD-MS] Lỗi đăng nhập hoặc cào dữ liệu M-System: ${err.message}`);
      // Ghi nhận file log và ảnh chụp lỗi để debug trên Linux giống Checklist Bot
      try {
        const debugDir = path.join(process.cwd(), 'temp', 'debug');
        if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const txtPath = path.join(debugDir, `error-tkgd-ms-${ts}.txt`);
        const pngPath = path.join(debugDir, `error-tkgd-ms-${ts}.png`);
        const htmlPath = path.join(debugDir, `error-tkgd-ms-${ts}.html`);

        fs.writeFileSync(txtPath, `Time: ${new Date().toISOString()}\nUser: ${username}\nError: ${err.message}\nStack: ${err.stack}\n`, 'utf8');
        if (browser) {
          const pages = browser.contexts().flatMap((c) => c.pages());
          if (pages.length > 0 && !pages[0].isClosed()) {
            await pages[0].screenshot({ path: pngPath, fullPage: true, timeout: 5000 }).catch(() => { });
            const html = await pages[0].content().catch(() => '');
            if (html) fs.writeFileSync(htmlPath, html, 'utf8');
          }
        }
        this.logger.warn(`[TKGD-MS] Đã lưu log và ảnh chụp lỗi debug tại: ${debugDir}`);
      } catch { }
      throw err;
    } finally {
      await browser.close().catch(() => { });
    }

    // TỰ ĐỘNG ĐỐI SOÁT NGAY LẬP TỨC (cho ngày chỉ định/hôm nay)
    const reconResult = await this.runReconciliation(userEmail, todayStr);

    this.updateProgress(userEmail, {
      isProcessing: false,
      taskType: 'IDLE',
      percent: 100,
      stage: `Đã cào M-System thành công cho ${scrapedCount} hồ sơ!`,
    });

    await this.logActivity({
      action: 'SYNC_MSYSTEM',
      title: 'Cào dữ liệu M-System',
      details: options?.investorCode
        ? `Đã cào M-System thành công cho tài khoản ${options.investorCode}`
        : `Đã cào M-System thành công cho ${scrapedCount} hồ sơ`,
      userEmail,
      metadata: { scrapedCount, summary: reconResult.summary },
    });

    return {
      success: true,
      scrapedCount,
      summary: reconResult.summary,
      message: `Đã cào M-System thành công cho ${scrapedCount} hồ sơ và tự động đối soát!`,
    };
  }

  /**
   * Quét lại Email & Bóc tách lại File đính kèm cho 1 hồ sơ tài khoản cụ thể
   * Cho phép Cán bộ trực ca làm mới nhanh 1 hồ sơ sau khi TVKD bổ sung file hoặc sửa quy tắc
   */
  async reparseAccount(
    userEmail: string,
    payload: { recordId?: string; accountCode?: string; batchDate?: string }
  ) {
    const { recordId, accountCode, batchDate } = payload;
    let query: any = {};
    if (recordId) {
      query._id = recordId;
    } else if (accountCode) {
      const code = accountCode.trim();
      const base = code.split('-')[0];
      query.$or = [{ maTKGD: code }, { maTKGDBase: base }];
      if (batchDate) query.batchDate = batchDate;
    } else {
      throw new Error('Vui lòng cung cấp recordId hoặc accountCode để quét lại');
    }

    const record = await this.cleanRecordModel.findOne(query);
    if (!record) {
      throw new NotFoundException('Không tìm thấy bản ghi hồ sơ cần quét lại');
    }

    const baseCode = record.maTKGDBase || record.maTKGD?.split('-')[0] || '';
    const bDate = record.batchDate || new Date().toISOString().slice(0, 10);

    this.logger.log(`[TKGD-REPARSE] Bắt đầu quét & bóc tách lại hồ sơ: ${record.maTKGD || baseCode} (Ngày: ${bDate})`);

    // Lưu snapshot vết trước khi bóc tách lại
    if (!record.snapshots) record.snapshots = [];
    record.snapshots.push({
      snapshotAt: new Date(),
      action: 'REPARSE_ACCOUNT',
      previousData: {
        noiDungMail: record.noiDungMail,
        hopDong: record.hopDong,
        phuLuc: record.phuLuc,
        canCuoc: record.canCuoc,
        ketLuan: record.ketLuan,
      },
    } as any);

    // 1. Tìm lại email gốc từ RawAccountMail
    let rawMail = record.rawMailId ? await this.rawMailModel.findById(record.rawMailId) : null;
    if (!rawMail) {
      rawMail = await this.rawMailModel
        .findOne({
          bodyRawText: { $regex: baseCode, $options: 'i' },
        })
        .sort({ receivedDateTime: -1 });
    }

    const config = await this.userConfigModel.findOne({ userEmail }).lean();

    // 2. Tìm các tệp đính kèm đã lưu trữ chính thức hoặc tạm
    const officialAccDir = getTkgdAttachmentDirectory(
      config?.documentProcessing?.attachmentSavePath || config?.storage?.windowsPath,
      bDate,
      baseCode,
    );
    const tempAccDir = path.join(process.cwd(), 'data', 'temp_tkgd_attachments', baseCode);

    let hopDongPath: string | undefined = undefined;
    let phuLucPath: string | undefined = undefined;
    const imageCandidates: Array<{ name: string; filePath: string; size?: number }> = [];
    let cccdPdfPath: string | undefined;

    const scanDirForFiles = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          const lower = f.toLowerCase();
          const full = path.join(dir, f);
          const fileSize = fs.statSync(full).size;
          const dims = /\.(jpe?g|png|webp|gif|bmp)$/i.test(lower)
            ? probeImageDimensions(full)
            : null;
          if (isIgnoredEmailAttachment(f, fileSize, dims)) continue;
          if (lower.endsWith('.pdf')) {
            if (isNamedCccdPdf(f)) {
              if (!cccdPdfPath) cccdPdfPath = full;
            } else {
              const isCombined =
                (lower.includes('hd') || lower.includes('hđ') || lower.includes('hop')) &&
                (lower.includes('pl01') || lower.includes('phuluc') || lower.includes('pl-01') || lower.includes('pl'));
              if (isCombined) {
                if (!hopDongPath) hopDongPath = full;
                if (!phuLucPath) phuLucPath = full;
              } else if (lower.includes('pl01') || lower.includes('phuluc') || lower.includes('pl-01')) {
                if (!phuLucPath) phuLucPath = full;
              } else if (!isNamedContractImage(f) && !hopDongPath) {
                hopDongPath = full;
              } else if (isNamedContractImage(f) || !hopDongPath) {
                if (!hopDongPath) hopDongPath = full;
              }
            }
          } else if (/\.(jpe?g|png|bmp|webp|paint|heic|heif)$/i.test(lower)) {
            if (isNamedContractImage(f)) {
              if (!hopDongPath) hopDongPath = full;
            } else {
              imageCandidates.push({ name: f, filePath: full, size: fileSize });
            }
          }
        }
      } catch { }
    };

    scanDirForFiles(officialAccDir);
    scanDirForFiles(tempAccDir);

    // Quét bổ sung các thư mục ngày khác thuộc HoSo_DinhKem (phòng khi đính kèm lưu ở ngày khác)
    const scanNetBases = [
      '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem',
    ];
    for (const nb of scanNetBases) {
      if (fs.existsSync(nb)) {
        try {
          const dateFolders = fs.readdirSync(nb, { withFileTypes: true });
          for (const df of dateFolders) {
            if (df.isDirectory() && df.name !== bDate) {
              const accPath = path.join(nb, df.name, baseCode);
              if (fs.existsSync(accPath)) {
                scanDirForFiles(accPath);
              }
            }
          }
        } catch {}
      }
    }
    const pickedReparse = pickCccdImagePaths(imageCandidates);
    let cccdFrontPath = pickedReparse.frontPath;
    let cccdBackPath = pickedReparse.backPath;
    // CCCD gửi dạng PDF (076C3131313, 046C0002960, 046C0002949) — ưu tiên CCCD PDF hơn các ảnh không tên / generic
    if (cccdPdfPath) {
      const hasExplicitFrontImage = cccdFrontPath && isNamedCccdFront(path.basename(cccdFrontPath));
      if (!hasExplicitFrontImage) {
        cccdFrontPath = cccdPdfPath;
        cccdBackPath = undefined;
      }
    } else if (!cccdFrontPath && cccdPdfPath) {
      cccdFrontPath = cccdPdfPath;
    }

    // 3. Nếu tìm được rawMail, cập nhật lại nội dung email qua parser mới
    let candidateName = '';
    if (rawMail && rawMail.bodyRawText) {
      const groups = parseAccountOpeningEmailMulti(rawMail.bodyRawText);
      const matchGroup = groups.find((g) => g.maTKGDBase === baseCode);
      if (matchGroup) {
        candidateName = matchGroup.tenTaiKhoan;
        if (record.noiDungMail) {
          record.noiDungMail.maTKGD_Futures = matchGroup.maTKGDFutures || baseCode;
          if (matchGroup.maTKGDACM) record.noiDungMail.maTKGD_ACM = matchGroup.maTKGDACM;
          if (matchGroup.maTKGDLME) record.noiDungMail.maTKGD_LME = matchGroup.maTKGDLME;
          if (matchGroup.maTKGDSpread) record.noiDungMail.maTKGD_Spread = matchGroup.maTKGDSpread;
          record.noiDungMail.hasACMRequest = matchGroup.hasACMRequest;
          record.noiDungMail.hasLMERequest = matchGroup.hasLMERequest;
          record.noiDungMail.hasSpreadRequest = matchGroup.hasSpreadRequest;
        }
      }
    }

    // 4. Chạy lại Python Extractor nếu có file đính kèm
    if (hopDongPath || phuLucPath || cccdFrontPath || cccdBackPath) {
      try {
        const pyRes = await runPythonExtractor({
          accountCode: record.maTKGD || baseCode,
          accountName: candidateName || record.hopDong?.hoVaTen || record.ms?.hoVaTen,
          hopDongPath,
          phuLucPath,
          cccdFrontPath,
          cccdBackPath,
        });

        if (pyRes) {
          if (hopDongPath && pyRes.hopDong && (pyRes.hopDong.hoTen || pyRes.hopDong.soCCCD || hopDongPath)) {
            record.hopDong = {
              maTKGD: pyRes.hopDong.maTKGD || baseCode,
              hoVaTen: pyRes.hopDong.hoTen || (isLikelyValidPersonName(candidateName) ? candidateName : record.hopDong?.hoVaTen),
              soCanCuoc: pyRes.hopDong.soCCCD || (record.hopDong?.soCanCuoc?.endsWith('000123') ? undefined : record.hopDong?.soCanCuoc),
              ngaySinh: parseDate(pyRes.hopDong.ngaySinh) || (record.hopDong?.soCanCuoc?.endsWith('000123') ? undefined : record.hopDong?.ngaySinh),
              rawNgaySinh: pyRes.hopDong.rawNgaySinh || (record.hopDong?.soCanCuoc?.endsWith('000123') ? undefined : record.hopDong?.rawNgaySinh),
              ngayCap: parseDate(pyRes.hopDong.ngayCap) || (record.hopDong?.soCanCuoc?.endsWith('000123') ? undefined : record.hopDong?.ngayCap),
              rawNgayCap: pyRes.hopDong.rawNgayCap || (record.hopDong?.soCanCuoc?.endsWith('000123') ? undefined : record.hopDong?.rawNgayCap),
              noiCap: pyRes.hopDong.noiCap || (record.hopDong?.soCanCuoc?.endsWith('000123') ? undefined : record.hopDong?.noiCap),
              ngayKyHD: parseDate(pyRes.hopDong.ngayKyHD) || (record.hopDong?.soCanCuoc?.endsWith('000123') ? undefined : record.hopDong?.ngayKyHD),
              rawNgayKyHD: pyRes.hopDong.rawNgayKyHD || undefined,
              gioiTinh: pyRes.hopDong.gioiTinh || (record.hopDong?.soCanCuoc?.endsWith('000123') ? undefined : record.hopDong?.gioiTinh),
              rawGioiTinh: pyRes.hopDong.rawGioiTinh || (record.hopDong?.soCanCuoc?.endsWith('000123') ? undefined : record.hopDong?.rawGioiTinh),
              dinhDangLoi: pyRes.hopDong.dinhDangLoi || [],
              loaiHinhTaiKhoan: 'Cá nhân',
              chuKy: pyRes.hopDong.hasSignature ? 'Đã ký' : 'Chưa ký',
            } as any;
          } else if (!hopDongPath && record.hopDong && (record.hopDong.soCanCuoc?.endsWith('000123') || /03109\d{7}/.test(record.hopDong.soCanCuoc || ''))) {
            record.hopDong = undefined;
          }

          if (pyRes.phuLuc && (pyRes.phuLuc.isPl01 || phuLucPath)) {
            record.phuLuc = {
              maTKGD: pyRes.phuLuc.maTKGD || `${baseCode}-A`,
              hoVaTen: pyRes.phuLuc.tenKH || (isLikelyValidPersonName(candidateName) ? candidateName : record.phuLuc?.hoVaTen),
              soCanCuoc: (pyRes.phuLuc as any).soCCCD || record.phuLuc?.soCanCuoc,
              ngayCap: parseDate((pyRes.phuLuc as any).ngayCap) || record.phuLuc?.ngayCap,
              noiCap: (pyRes.phuLuc as any).noiCap || record.phuLuc?.noiCap,
              ngayKyHD: parseDate(pyRes.phuLuc.ngayKyHD) || record.phuLuc?.ngayKyHD,
              chuKy: pyRes.phuLuc.hasSignature ? 'Đã ký' : 'Chưa ký',
            } as any;
          }

          if (pyRes.canCuoc && (pyRes.canCuoc.soCCCD || pyRes.canCuoc.hoTen || cccdFrontPath)) {
            const rawDob = pyRes.canCuoc.rawNgaySinh || pyRes.canCuoc.ngaySinh;
            const rawCap = pyRes.canCuoc.rawNgayCap || pyRes.canCuoc.ngayCap;
            const isStalePhantom =
              record.canCuoc?.soCanCuoc?.endsWith('000123') ||
              /03109\d{7}/.test(record.canCuoc?.soCanCuoc || '');
            const cleanExistingCccd = isStalePhantom ? undefined : record.canCuoc?.soCanCuoc;
            record.canCuoc = {
              hoVaTen:
                pyRes.canCuoc.hoTen ||
                record.hopDong?.hoVaTen ||
                (isLikelyValidPersonName(candidateName) ? candidateName : record.canCuoc?.hoVaTen),
              soCanCuoc:
                pyRes.canCuoc.soCCCD ||
                cleanExistingCccd ||
                record.hopDong?.soCanCuoc ||
                record.ms?.soCMND_HoChieu,
              ngaySinh:
                parseDate(pyRes.canCuoc.ngaySinh) ||
                (isStalePhantom ? record.hopDong?.ngaySinh || record.ms?.ngaySinh : record.canCuoc?.ngaySinh),
              rawNgaySinh:
                rawDob ||
                (isStalePhantom
                  ? record.hopDong?.rawNgaySinh || record.ms?.rawNgaySinh
                  : record.canCuoc?.rawNgaySinh),
              ngayCap:
                parseDate(pyRes.canCuoc.ngayCap) ||
                (isStalePhantom ? record.hopDong?.ngayCap || record.ms?.ngayCap : record.canCuoc?.ngayCap),
              rawNgayCap:
                rawCap ||
                (isStalePhantom
                  ? record.hopDong?.rawNgayCap || record.ms?.rawNgayCap
                  : record.canCuoc?.rawNgayCap),
              gioiTinh:
                pyRes.canCuoc.gioiTinh ||
                (isStalePhantom ? record.hopDong?.gioiTinh || record.ms?.gioiTinh : record.canCuoc?.gioiTinh),
              noiCap: pyRes.canCuoc.noiCap || record.hopDong?.noiCap || record.ms?.noiCap || record.canCuoc?.noiCap,
              diaChiThuongTru: pyRes.canCuoc.diaChi || record.canCuoc?.diaChiThuongTru,
              canhBaoChatLuong: pyRes.canCuoc.canhBaoChatLuong || [],
              ocrConfidence: pyRes.canCuoc.source || (isStalePhantom ? 'CONSENSUS_HEALED' : 'OCR'),
              theGeneration: pyRes.canCuoc.theGeneration || record.canCuoc?.theGeneration,
              confidenceScore: pyRes.canCuoc.confidenceScore || (isStalePhantom ? 1.0 : record.canCuoc?.confidenceScore),
              boundingBoxes: pyRes.canCuoc.boundingBoxes || record.canCuoc?.boundingBoxes,
              cccdMatTruocLocalPath: (pyRes.canCuoc as any).cccdMatTruocLocalPath || pyRes.canCuocPreviewFront || (cccdFrontPath?.endsWith('.pdf') ? undefined : cccdFrontPath) || record.canCuoc?.cccdMatTruocLocalPath,
              cccdMatSauLocalPath: (pyRes.canCuoc as any).cccdMatSauLocalPath || pyRes.canCuocPreviewBack || (cccdBackPath?.endsWith('.pdf') ? undefined : cccdBackPath) || record.canCuoc?.cccdMatSauLocalPath,
            } as any;
          }
        }
      } catch (err: any) {
        this.logger.warn(`[TKGD-REPARSE] Lỗi chạy Python Extractor cho ${baseCode}: ${err.message}`);
      }
    }

    // 5. Chuẩn hóa tên trên Mail: Kế thừa từ HĐ / PL / CCCD nếu tên mail bị rác hoặc thiếu
    const finalDocName = record.hopDong?.hoVaTen || record.phuLuc?.hoVaTen || record.canCuoc?.hoVaTen || '';
    if (record.noiDungMail) {
      if (isLikelyValidPersonName(candidateName)) {
        record.noiDungMail.tenTaiKhoan = candidateName;
      } else if (!isLikelyValidPersonName(record.noiDungMail.tenTaiKhoan) && finalDocName) {
        record.noiDungMail.tenTaiKhoan = finalDocName;
      }
    }

    // 6. Thực hiện so sánh đối soát lại ngay cho hồ sơ này
    const { finalStatus, finalErrors } = this.evaluateRecordReconciliation(record);
    record.ketLuan = {
      trangThai: finalStatus,
      danhSachLoi: finalErrors,
      reconciledAt: new Date(),
    } as any;

    await record.save();

    await this.logActivity({
      action: 'REPARSE_ACCOUNT',
      title: 'Bóc tách lại tài khoản',
      details: `Đã quét lại email và bóc tách lại hồ sơ ${record.maTKGD || baseCode} thành công!`,
      userEmail,
      metadata: { recordId, accountCode, baseCode, batchDate: bDate },
    });

    return {
      success: true,
      message: `Đã quét lại email và bóc tách lại hồ sơ ${record.maTKGD || baseCode} thành công!`,
      record,
    };
  }

  /**
   * Chạy quy trình tổng hợp toàn bộ (All-in-One Pipeline)
   */
  async runPipelineAll(
    userEmail: string,
    options?: {
      downloadImages?: boolean;
      batchDate?: string;
      fromDateTime?: string;
      toDateTime?: string;
      forceReparse?: boolean;
    },
  ) {
    this.updateProgress(userEmail, {
      isProcessing: true,
      taskType: 'PIPELINE_ALL',
      current: 1,
      total: 3,
      percent: 15,
      stage: 'Bước 1/3: Đang quét email mở TKGD và hồ sơ đính kèm...',
    });

    // 1. Quét Mail & Bóc tách (hỗ trợ bộ lọc ngày giờ & smart skip)
    const mailResult = await this.syncMailOpeningAccounts(userEmail, {
      batchDate: options?.batchDate,
      fromDateTime: options?.fromDateTime,
      toDateTime: options?.toDateTime,
      forceReparse: options?.forceReparse,
    });

    this.updateProgress(userEmail, {
      isProcessing: true,
      taskType: 'PIPELINE_ALL',
      current: 2,
      total: 3,
      percent: 50,
      stage: 'Bước 2/3: Đang cào dữ liệu đối ứng từ M-System...',
    });

    // 2. Cào M-System & Tự động đối soát (mặc định tải ảnh và bóc tách đầy đủ)
    const msResult = await this.syncMSystemAccounts(userEmail, {
      downloadImages: options?.downloadImages !== undefined ? options.downloadImages : true,
      batchDate: options?.batchDate,
    });

    this.updateProgress(userEmail, {
      isProcessing: false,
      taskType: 'IDLE',
      current: 3,
      total: 3,
      percent: 100,
      stage: 'Hoàn tất toàn bộ chu trình tự động A-Z!',
    });

    await this.logActivity({
      action: 'RUN_PIPELINE',
      title: 'Hoàn tất chu trình tổng hợp TKGD',
      details: `Đã nạp ${mailResult.count} mail, cào ${msResult.scrapedCount} hồ sơ MS và xuất file Excel đối soát`,
      userEmail,
      metadata: {
        mailCount: mailResult.count,
        scrapedCount: msResult.scrapedCount,
        summary: msResult.summary,
      },
    });

    return {
      success: true,
      mailCount: mailResult.count,
      scrapedCount: msResult.scrapedCount,
      summary: msResult.summary,
      message: `Hoàn tất toàn bộ chu trình! Đã nạp ${mailResult.count} mail, cào ${msResult.scrapedCount} hồ sơ MS và xuất file Excel đối soát.`,
    };
  }

  /**
   * Thống kê nhanh số lượng hồ sơ phục vụ Dynamic Badge
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
   * Lấy đường dẫn file Excel xuất mới nhất
   */
  async getLatestExcelFilePath(userEmail: string): Promise<string | null> {
    const config = await this.userConfigModel.findOne({ userEmail }).lean();
    const primaryDir = resolveTkgdOutputDir(config?.storage?.windowsPath);

    const candidateDirs = [
      primaryDir,
      getTkgdOutputDirectory(),
      '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
      path.resolve(process.cwd(), '../POC/TKGD-Automation/output'),
      process.cwd(),
    ].filter((d) => d && fs.existsSync(d));

    const foundFiles: { name: string; fullPath: string; mtime: number }[] = [];
    const seen = new Set<string>();

    for (const d of candidateDirs) {
      try {
        const list = fs.readdirSync(d);
        for (const f of list) {
          if (f.startsWith('Auto_Data_mail_') && (f.endsWith('.xlsx') || f.endsWith('.xlsm'))) {
            const fullPath = path.join(d, f);
            if (!seen.has(fullPath)) {
              seen.add(fullPath);
              foundFiles.push({
                name: f,
                fullPath,
                mtime: fs.statSync(fullPath).mtimeMs,
              });
            }
          }
        }
      } catch { }
    }

    foundFiles.sort((a, b) => b.mtime - a.mtime);
    return foundFiles.length > 0 ? foundFiles[0].fullPath : null;
  }

  /**
   * Quét và phân loại toàn bộ tệp hồ sơ đính kèm (Mail & M-System) phục vụ giao diện đối soát trực quan
   */
  async getAccountFilesManifest(
    userEmail: string,
    accountCode: string,
    batchDate?: string,
  ) {
    const code = (accountCode || '').trim();
    if (!code) {
      return { success: false, message: 'Thiếu mã tài khoản' };
    }

    const config = await this.userConfigModel.findOne({ userEmail }).lean();

    const queryFilter: any = {
      $or: [
        { maTKGDBase: code },
        { maTKGD: code },
        { 'noiDungMail.maTKGD_Futures': code },
      ],
    };
    if (batchDate && batchDate.trim()) {
      queryFilter.batchDate = batchDate.trim();
    }

    const record = await this.cleanRecordModel
      .findOne(queryFilter)
      .sort({ batchDate: -1, createdAt: -1 })
      .lean();

    if (record && !record.canCuoc?.theGeneration) {
      // Kích hoạt làm giàu AI bất đồng bộ (Non-blocking), không chặn luồng trả về manifest tệp hồ sơ
      this.enrichMissingCccdData(record).catch((err) => {
        console.warn(`[MANIFEST] Không thể tự động làm giàu CCCD cho ${code}:`, err);
      });
    }

    const effectiveBatchDate =
      batchDate?.trim() || record?.batchDate || new Date().toISOString().slice(0, 10);

    // Xác định các thư mục tiềm năng chứa hồ sơ tài khoản này
    const candidateDirs: string[] = [];

    // 1. Thư mục chuẩn theo config hoặc mặc định
    const standardDir = getTkgdAttachmentDirectory(
      config?.documentProcessing?.attachmentSavePath || config?.storage?.windowsPath,
      effectiveBatchDate,
      code,
    );
    candidateDirs.push(standardDir);

    // 2. Thử các đường dẫn mạng cố định trên Linux & Windows
    const netBases = [
      '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem',
      path.resolve(process.cwd(), 'data/temp_tkgd_attachments'),
    ];

    for (const nb of netBases) {
      if (fs.existsSync(nb)) {
        try {
          const dateFolders = fs.readdirSync(nb, { withFileTypes: true });
          for (const df of dateFolders) {
            if (df.isDirectory()) {
              const dateFolder = path.join(nb, df.name);
              try {
                const children = fs.readdirSync(dateFolder, { withFileTypes: true });
                for (const c of children) {
                  if (c.isDirectory() && (c.name === code || c.name.startsWith(`${code}_`))) {
                    candidateDirs.push(path.join(dateFolder, c.name));
                  }
                }
              } catch { }
              candidateDirs.push(path.join(dateFolder, code));
            }
          }
        } catch { }
        candidateDirs.push(path.join(nb, code));
      }
    }

    // Tập hợp toàn bộ tệp từ tất cả các thư mục tiềm năng (không break sớm, gom đa ngày)
    interface ManifestDiskFile {
      fileName: string;
      dir: string;
      fullPath: string;
      size: number;
    }
    const allFilesMap = new Map<string, ManifestDiskFile>();

    for (const d of candidateDirs) {
      if (fs.existsSync(d)) {
        try {
          const list = fs.readdirSync(d);
          for (const f of list) {
            if (allFilesMap.has(f)) continue;
            const full = path.join(d, f);
            try {
              const stat = fs.statSync(full);
              if (stat.isFile()) {
                allFilesMap.set(f, { fileName: f, dir: d, fullPath: full, size: stat.size });
              }
            } catch { }
          }
        } catch { }
      }
    }

    const filesInDir = Array.from(allFilesMap.values());

    // Phân loại tệp
    let mailCccdFront: any = null;
    let mailCccdBack: any = null;
    let mailContractPdf: any = null;
    let mailPl01Pdf: any = null;

    let msCccdFront: any = null;
    let msCccdBack: any = null;
    let msSignature: any = null;

    const otherFiles: any[] = [];
    const mailImageCandidates: Array<{ name: string; filePath: string; size?: number }> = [];

    const buildFileObj = (fName: string, subType: string) => {
      const item = allFilesMap.get(fName);
      return {
        fileName: fName,
        size: item?.size || 0,
        subType,
        url: `/api/v1/tkgd/files/stream?accountCode=${encodeURIComponent(code)}&batchDate=${encodeURIComponent(effectiveBatchDate)}&fileName=${encodeURIComponent(fName)}`,
      };
    };

    for (const item of filesInDir) {
      const f = item.fileName;
      const fullPath = item.fullPath;
      const fileSize = item.size;
      const dims =
        /\.(jpe?g|png|webp|gif|bmp|paint|heic|heif)$/i.test(f)
          ? probeImageDimensions(fullPath)
          : null;
      // Logo FireAnt / banner / HĐ image… — không đưa vào slot CCCD
      if (isIgnoredEmailAttachment(f, fileSize, dims) || isDecorativeOrLogoAttachment(f)) continue;

      const lower = f.toLowerCase();
      const isMS = isMSystemThumbnailFile(f, code);

      if (lower.endsWith('.pdf')) {
        if (isNamedCccdPdf(f)) {
          otherFiles.push(buildFileObj(f, 'MAIL_CCCD_PDF'));
        } else if (lower.includes('pl01') || lower.includes('phuluc') || lower.includes('-pl')) {
          if (!mailPl01Pdf) mailPl01Pdf = buildFileObj(f, 'MAIL_PL01');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        } else if (lower.includes('mxv') || lower.includes('hopdong') || lower.includes('hd') || isNamedContractImage(f)) {
          if (!mailContractPdf) mailContractPdf = buildFileObj(f, 'MAIL_CONTRACT');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        } else {
          if (!mailContractPdf) mailContractPdf = buildFileObj(f, 'MAIL_CONTRACT');
          else otherFiles.push(buildFileObj(f, 'PDF'));
        }
      } else if (['.jpg', '.jpeg', '.png', '.webp', '.paint', '.heic', '.heif'].some((ext) => lower.endsWith(ext))) {
        if (isMS) {
          if (lower.includes('truoc') || lower.includes('front') || lower.includes('mat1')) {
            msCccdFront = buildFileObj(f, 'MS_CCCD_FRONT');
          } else if (lower.includes('sau') || lower.includes('back') || lower.includes('mat2')) {
            msCccdBack = buildFileObj(f, 'MS_CCCD_BACK');
          } else if (lower.includes('chuky') || lower.includes('ky') || lower.includes('signature')) {
            msSignature = buildFileObj(f, 'MS_SIGNATURE');
          } else {
            otherFiles.push(buildFileObj(f, 'IMAGE'));
          }
        } else if (isNamedContractImage(f)) {
          if (!mailContractPdf) {
            mailContractPdf = buildFileObj(f, 'MAIL_CONTRACT');
          } else {
            otherFiles.push(buildFileObj(f, 'MAIL_CONTRACT_IMAGE'));
          }
        } else if (lower.includes('chuky') || lower.includes('signature')) {
          otherFiles.push(buildFileObj(f, 'IMAGE'));
        } else if (lower.includes('_auto_temp.')) {
          // Intermediate temp composite file từ PDF rasterization, bỏ qua không đưa vào ứng viên CCCD
        } else {
          // Gom ứng viên CCCD — chọn bằng pickCccdImagePaths (tránh logo làm mặt trước)
          mailImageCandidates.push({ name: f, filePath: fullPath, size: fileSize });
        }
      } else {
        otherFiles.push(buildFileObj(f, 'OTHER'));
      }
    }

    // Chọn front/back từ ứng viên mail (cùng logic OCR/reparse)
    if (mailImageCandidates.length > 0) {
      const picked = pickCccdImagePaths(mailImageCandidates);
      if (picked.frontPath) {
        mailCccdFront = buildFileObj(path.basename(picked.frontPath), 'MAIL_CCCD_FRONT');
      }
      if (picked.backPath) {
        mailCccdBack = buildFileObj(path.basename(picked.backPath), 'MAIL_CCCD_BACK');
      }
      for (const c of mailImageCandidates) {
        const base = path.basename(c.filePath);
        if (base === mailCccdFront?.fileName || base === mailCccdBack?.fileName) continue;
        otherFiles.push(buildFileObj(base, 'IMAGE'));
      }
    }

    // Fallback 1: Tìm file ảnh preview tự động sinh từ PDF/Paint CCCD (*_AUTO_FRONT / *_AUTO_BACK)
    if (!mailCccdFront) {
      const autoFront = filesInDir.find(
        (it) => (it.fileName.includes('_AUTO_FRONT') || it.fileName.includes('_preview')) && !it.fileName.includes('_MS_'),
      );
      if (autoFront) {
        mailCccdFront = buildFileObj(autoFront.fileName, 'MAIL_CCCD_FRONT');
      }
    }
    if (!mailCccdBack) {
      const autoBack = filesInDir.find((it) => it.fileName.includes('_AUTO_BACK') && !it.fileName.includes('_MS_'));
      if (autoBack) {
        mailCccdBack = buildFileObj(autoBack.fileName, 'MAIL_CCCD_BACK');
      }
    }

    // Fallback 2: Nếu chưa có mailCccdFront/mailCccdBack nhưng có tệp CCCD dạng PDF -> tự động rasterize ngay trên đĩa
    if (!mailCccdFront) {
      const cccdPdfItem = filesInDir.find((it) => isNamedCccdPdf(it.fileName));
      if (cccdPdfItem && fs.existsSync(cccdPdfItem.fullPath)) {
        try {
          const pyScript = `import sys; sys.path.insert(0, '/opt/mxv-checklist/backend/src/scripts/python'); from tkgd_extractor_worker import rasterize_cccd_pdf; rasterize_cccd_pdf(${JSON.stringify(cccdPdfItem.fullPath)})`;
          const pythonBin = process.platform === 'win32' ? 'python' : 'python3';
          require('child_process').execFileSync(pythonBin, ['-c', pyScript], { timeout: 15000 });
          if (fs.existsSync(cccdPdfItem.dir)) {
            const dirFiles = fs.readdirSync(cccdPdfItem.dir);
            for (const newF of dirFiles) {
              const newFull = path.join(cccdPdfItem.dir, newF);
              if (!allFilesMap.has(newF) && fs.existsSync(newFull)) {
                allFilesMap.set(newF, { fileName: newF, dir: cccdPdfItem.dir, fullPath: newFull, size: fs.statSync(newFull).size });
              }
            }
            const updatedFilesInDir = Array.from(allFilesMap.values());
            const autoFront = updatedFilesInDir.find((it) => (it.fileName.includes('_AUTO_FRONT') || it.fileName.includes('_preview')) && !it.fileName.includes('_MS_'));
            if (autoFront) mailCccdFront = buildFileObj(autoFront.fileName, 'MAIL_CCCD_FRONT');
            const autoBack = updatedFilesInDir.find((it) => it.fileName.includes('_AUTO_BACK') && !it.fileName.includes('_MS_'));
            if (autoBack) mailCccdBack = buildFileObj(autoBack.fileName, 'MAIL_CCCD_BACK');
          }
        } catch (e: any) {
          this.logger.warn(`[MANIFEST] Không thể tự động rasterize CCCD PDF cho ${code}: ${e?.message}`);
        }
      }
    }

    // Fallback nếu mail CCCD chưa có trong folder nhưng đã lưu trong DB record (vd đường dẫn preview)
    if (!mailCccdFront && record?.canCuoc?.cccdMatTruocLocalPath && fs.existsSync(record.canCuoc.cccdMatTruocLocalPath)) {
      mailCccdFront = {
        fileName: path.basename(record.canCuoc.cccdMatTruocLocalPath),
        size: fs.statSync(record.canCuoc.cccdMatTruocLocalPath).size,
        subType: 'MAIL_CCCD_FRONT',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.canCuoc.cccdMatTruocLocalPath)}`,
      };
    }
    if (!mailCccdBack && record?.canCuoc?.cccdMatSauLocalPath && fs.existsSync(record.canCuoc.cccdMatSauLocalPath)) {
      mailCccdBack = {
        fileName: path.basename(record.canCuoc.cccdMatSauLocalPath),
        size: fs.statSync(record.canCuoc.cccdMatSauLocalPath).size,
        subType: 'MAIL_CCCD_BACK',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.canCuoc.cccdMatSauLocalPath)}`,
      };
    }

    // Fallback 1: nếu MS chưa có trong folder nhưng có path trong DB record
    if (!msCccdFront && record?.ms?.cccdMatTruocLocalPath && fs.existsSync(record.ms.cccdMatTruocLocalPath)) {
      msCccdFront = {
        fileName: path.basename(record.ms.cccdMatTruocLocalPath),
        size: fs.statSync(record.ms.cccdMatTruocLocalPath).size,
        subType: 'MS_CCCD_FRONT',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.ms.cccdMatTruocLocalPath)}`,
      };
    }
    if (!msCccdBack && record?.ms?.cccdMatSauLocalPath && fs.existsSync(record.ms.cccdMatSauLocalPath)) {
      msCccdBack = {
        fileName: path.basename(record.ms.cccdMatSauLocalPath),
        size: fs.statSync(record.ms.cccdMatSauLocalPath).size,
        subType: 'MS_CCCD_BACK',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.ms.cccdMatSauLocalPath)}`,
      };
    }
    if (!msSignature && record?.ms?.chuKyLocalPath && fs.existsSync(record.ms.chuKyLocalPath)) {
      msSignature = {
        fileName: path.basename(record.ms.chuKyLocalPath),
        size: fs.statSync(record.ms.chuKyLocalPath).size,
        subType: 'MS_SIGNATURE',
        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(record.ms.chuKyLocalPath)}`,
      };
    }

    // Fallback 2: Quét các thư mục ngày khác nếu thư mục ngày hiện tại chưa có file M-System
    if (!msCccdFront || !msCccdBack || !msSignature) {
      for (const nb of netBases) {
        if (fs.existsSync(nb)) {
          try {
            const dateDirs = fs.readdirSync(nb).filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f));
            dateDirs.sort().reverse(); // Ưu tiên các ngày gần nhất trước
            for (const dDir of dateDirs) {
              const accPath = path.join(nb, dDir, code);
              if (fs.existsSync(accPath)) {
                const subFiles = fs.readdirSync(accPath);
                for (const sf of subFiles) {
                  const sfLower = sf.toLowerCase();
                  const isMSFile = sfLower.includes('_ms_') || sfLower.startsWith(`${code.toLowerCase()}_ms`);
                  if (isMSFile) {
                    const fullP = path.join(accPath, sf);
                    if (!msCccdFront && (sfLower.includes('truoc') || sfLower.includes('front') || sfLower.includes('mat1'))) {
                      msCccdFront = {
                        fileName: sf,
                        size: fs.statSync(fullP).size,
                        subType: 'MS_CCCD_FRONT',
                        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(fullP)}`,
                      };
                    } else if (!msCccdBack && (sfLower.includes('sau') || sfLower.includes('back') || sfLower.includes('mat2'))) {
                      msCccdBack = {
                        fileName: sf,
                        size: fs.statSync(fullP).size,
                        subType: 'MS_CCCD_BACK',
                        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(fullP)}`,
                      };
                    } else if (!msSignature && (sfLower.includes('chuky') || sfLower.includes('ky') || sfLower.includes('signature'))) {
                      msSignature = {
                        fileName: sf,
                        size: fs.statSync(fullP).size,
                        subType: 'MS_SIGNATURE',
                        url: `/api/v1/tkgd/files/stream?filePath=${encodeURIComponent(fullP)}`,
                      };
                    }
                  }
                }
              }
            }
          } catch { }
        }
      }
    }

    // Lọc lại otherFiles để không chứa các file đã được phân loại vào các slot chính hoặc file tạm
    const assignedFileNames = new Set(
      [
        mailCccdFront?.fileName,
        mailCccdBack?.fileName,
        mailContractPdf?.fileName,
        mailPl01Pdf?.fileName,
        msCccdFront?.fileName,
        msCccdBack?.fileName,
        msSignature?.fileName,
      ].filter(Boolean),
    );
    const cleanedOtherFiles = otherFiles.filter(
      (f) => !assignedFileNames.has(f.fileName) && !f.fileName.toLowerCase().includes('_auto_temp.'),
    );

    return {
      success: true,
      accountCode: code,
      batchDate: effectiveBatchDate,
      directory: candidateDirs.find((d) => fs.existsSync(d)) || standardDir,
      totalFiles: filesInDir.length,
      files: {
        mailCccdFront,
        mailCccdBack,
        mailContractPdf,
        mailPl01Pdf,
        msCccdFront,
        msCccdBack,
        msSignature,
      },
      otherFiles: cleanedOtherFiles,
      ocrSummary: {
        soCanCuocMail: record?.hopDong?.soCanCuoc || record?.canCuoc?.soCanCuoc,
        soCanCuocMs: record?.ms?.soCMND_HoChieu || record?.ms?.cccdOcr_soCanCuoc,
        hoTenMail: record?.noiDungMail?.tenTaiKhoan || record?.hopDong?.hoVaTen,
        hoTenMs: record?.ms?.hoVaTen,
        canhBaoChatLuong: record?.canCuoc?.canhBaoChatLuong || [],
        dinhDangLoi: record?.hopDong?.dinhDangLoi || [],
        theGeneration: record?.canCuoc?.theGeneration,
        confidenceScore: record?.canCuoc?.confidenceScore,
      },
    };
  }

  /**
   * Phân giải và kiểm tra an toàn đường dẫn tệp đính kèm phục vụ Stream
   */
  async resolveAttachmentFilePath(
    userEmail: string,
    params: {
      accountCode?: string;
      batchDate?: string;
      fileName?: string;
      filePath?: string;
    },
  ): Promise<string | null> {
    // 1. Kiểm tra filePath trực tiếp nếu có
    if (params.filePath && params.filePath.trim()) {
      const cleanPath = path.normalize(params.filePath.trim());
      // Bảo vệ: Chặn path traversal với ..
      if (cleanPath.includes('..')) {
        return null;
      }
      if (fs.existsSync(cleanPath)) {
        return cleanPath;
      }
    }

    // 2. Kiểm tra theo accountCode và fileName
    if (params.fileName && params.fileName.trim()) {
      const safeFileName = path.basename(params.fileName.trim());
      const accountCode = (params.accountCode || '').trim();
      const config = await this.userConfigModel.findOne({ userEmail }).lean();

      let effectiveBatchDate = params.batchDate?.trim();
      if (!effectiveBatchDate && accountCode) {
        const rec = await this.cleanRecordModel
          .findOne({
            $or: [{ maTKGDBase: accountCode }, { maTKGD: accountCode }],
          })
          .lean();
        effectiveBatchDate = rec?.batchDate;
      }
      if (!effectiveBatchDate) {
        effectiveBatchDate = new Date().toISOString().slice(0, 10);
      }

      const searchDirs: string[] = [];

      if (accountCode) {
        searchDirs.push(
          getTkgdAttachmentDirectory(
            config?.documentProcessing?.attachmentSavePath || config?.storage?.windowsPath,
            effectiveBatchDate,
            accountCode,
          ),
        );
      }

      const netBases = [
        '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem',
        'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem',
        path.resolve(process.cwd(), 'data/temp_tkgd_attachments'),
      ];

      for (const nb of netBases) {
        if (fs.existsSync(nb) && accountCode) {
          const dateFolder = path.join(nb, effectiveBatchDate);
          if (fs.existsSync(dateFolder)) {
            try {
              const children = fs.readdirSync(dateFolder, { withFileTypes: true });
              for (const c of children) {
                if (c.isDirectory() && (c.name === accountCode || c.name.startsWith(`${accountCode}_`))) {
                  searchDirs.push(path.join(dateFolder, c.name));
                }
              }
            } catch { }
            searchDirs.push(path.join(dateFolder, accountCode));
          }
          searchDirs.push(path.join(nb, accountCode));
        }
      }

      for (const d of searchDirs) {
        if (fs.existsSync(d)) {
          const full = path.join(d, safeFileName);
          if (fs.existsSync(full)) {
            return full;
          }
        }
      }

      // Quét mở rộng các thư mục ngày khác thuộc HoSo_DinhKem nếu chưa thấy trong effectiveBatchDate
      for (const nb of netBases) {
        if (fs.existsSync(nb) && accountCode) {
          try {
            const dateEntries = fs.readdirSync(nb, { withFileTypes: true });
            for (const de of dateEntries) {
              if (de.isDirectory() && de.name !== effectiveBatchDate) {
                const dateFolder = path.join(nb, de.name);
                const accInDate = path.join(dateFolder, accountCode);
                if (fs.existsSync(accInDate)) {
                  const full = path.join(accInDate, safeFileName);
                  if (fs.existsSync(full)) {
                    return full;
                  }
                }
              }
            }
          } catch { }
        }
      }
    }

    return null;
  }

  /**
   * Cán bộ nghiệp vụ chủ động phê duyệt hồ sơ bằng tay (Manual Override)
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

    await this.logActivity({
      action: 'MANUAL_APPROVE',
      title: 'Phê duyệt hồ sơ thủ công',
      details: `Phê duyệt thủ công cho hồ sơ ${record.maTKGD || record.maTKGDBase}. Lý do: ${record.manualReview?.reason}`,
      userEmail,
      metadata: { recordId, accountCode: record.maTKGD || record.maTKGDBase, reason: record.manualReview?.reason },
    });

    return {
      success: true,
      record,
      message: `Đã phê duyệt hồ sơ ${record.maTKGD || record.maTKGDBase} thành công!`,
    };
  }

  /**
   * Hủy phê duyệt bằng tay, trả về để máy tự động đối soát lại
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

    if (!record.snapshots) record.snapshots = [];
    record.snapshots.push({
      snapshotAt: now,
      action: 'REVERT_APPROVE',
      previousData,
    } as any);

    await record.save();

    // Tự động kích hoạt đối soát lại cho mẻ của hồ sơ này
    await this.runReconciliation(userEmail, record.batchDate);

    const updated = await this.cleanRecordModel.findById(recordId);
    this.logger.log(`[REVERT-APPROVE] ${userEmail} đã hủy duyệt tay hồ sơ ${record.maTKGD || record.maTKGDBase}`);

    await this.logActivity({
      action: 'REVERT_APPROVE',
      title: 'Hủy phê duyệt hồ sơ',
      details: `Đã hủy duyệt tay hồ sơ ${record.maTKGD || record.maTKGDBase}, chuyển về đối soát máy`,
      userEmail,
      metadata: { recordId, accountCode: record.maTKGD || record.maTKGDBase },
    });

    return {
      success: true,
      record: updated,
      message: `Đã hủy duyệt tay, đối soát máy đã được cập nhật lại.`,
    };
  }

  /**
   * Cron Job tự động rà soát & so lại ngầm các hồ sơ chưa KHỚP (LECH / CAN_KIEM_TRA)
   * Tự động áp dụng thuật toán & engine mới nhất (v2.6), giải phóng ca lệch mà không cần bấm thủ công.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCronAutoReconcilePending() {
    try {
      this.logger.log(`[AUTO-RECONCILE] Bắt đầu quét ngầm tự động đối soát lại các ca chưa KHỚP...`);
      const res = await this.autoReconcilePendingMismatches(7);
      if (res.checkedCount > 0) {
        this.logger.log(`[AUTO-RECONCILE] Hoàn tất quét ngầm: Kiểm tra ${res.checkedCount} ca, tự động chữa lành sang KHỚP: ${res.healedCount} ca.`);
      }
    } catch (err: any) {
      this.logger.warn(`[AUTO-RECONCILE] Lỗi quét ngầm: ${err.message}`);
    }
  }

  /**
   * Tự động rà soát & so lại ngầm các hồ sơ chưa KHỚP (LECH hoặc CAN_KIEM_TRA)
   */
  async autoReconcilePendingMismatches(daysBack: number = 7): Promise<{ checkedCount: number; healedCount: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const pendingCases = await this.cleanRecordModel.find({
      batchDate: { $gte: cutoffStr },
      'ketLuan.trangThai': { $in: ['LECH', 'CAN_KIEM_TRA'] },
      'manualReview.isOverridden': { $ne: true },
      $or: [
        { 'ketLuan.reconciledAt': { $exists: false } },
        { 'ketLuan.reconciledAt': { $lt: new Date(Date.now() - 15 * 60 * 1000) } },
      ],
    }).limit(100);

    let healedCount = 0;
    const now = new Date();

    for (const record of pendingCases) {
      const oldStatus = record.ketLuan?.trangThai;
      const baseCode = record.maTKGDBase || record.maTKGD || '';
      const attempts = (record.ketLuan as any)?.recheckAttempts || 0;

      // 1. Nếu còn dưới 3 lần thử, thử làm giàu dữ liệu (bóc tách CCCD PDF / quét lại file)
      if (attempts < 3) {
        try {
          await this.verifyAndHealWithImageHash(record);
          await this.enrichMissingCccdData(record);
        } catch (e: any) {
          this.logger.debug(`[AUTO-RECONCILE] Lỗi enrich dữ liệu ${baseCode}: ${e.message}`);
        }
      }

      // 2. Thẩm định lại bằng bộ quy tắc mới nhất
      const { finalStatus, finalErrors } = this.evaluateRecordReconciliation(record);

      record.ketLuan = {
        trangThai: finalStatus as any,
        danhSachLoi: finalErrors,
        reconciledAt: now,
        recheckAttempts: attempts + 1,
        reconcileEngineVersion: 'v2.6',
      } as any;

      await record.save();

      if (oldStatus !== 'KHOP' && finalStatus === 'KHOP') {
        healedCount++;
        this.logger.log(`[AUTO-RECONCILE] 🎉 Hồ sơ ${baseCode} đã được tự động thẩm định lại thành công -> KHỚP!`);
      }
    }

    return { checkedCount: pendingCases.length, healedCount };
  }

  /**
   * Cron Job tự động chạy mỗi 1 phút — kiểm tra từng user có đến hạn chạy chưa.
   * Mỗi user có intervalMinutes riêng (3/5/10/15/30), bot sẽ tính toán và kích hoạt đúng thời điểm.
   * Thiết kế này tránh tình trạng hardcode 5 phút không tương thích với cấu hình của user.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronAutoPipeline() {
    try {
      const activeConfigs = await this.userConfigModel.find({
        'autoPipeline.enabled': true,
      }).lean();

      if (!activeConfigs || activeConfigs.length === 0) return;

      const now = Date.now();
      for (const cfg of activeConfigs) {
        const intervalMs = Math.max(1, cfg.autoPipeline?.intervalMinutes ?? 5) * 60 * 1000;
        const lastRun = cfg.autoPipeline?.lastRunTime ?? 0;

        // Kiểm tra xem đã đến hạn chạy chu kỳ mới chưa
        if (now - lastRun < intervalMs) continue;

        // Chặn cùng user chạy đè nhau (per-user mutex)
        if (this.autoPipelineRunningUsers.has(cfg.userEmail)) {
          this.logger.debug(`[TKGD-CRON] ${cfg.userEmail} đang chạy chu kỳ trước, bỏ qua.`);
          continue;
        }

        // Chạy không blocking: fire-and-forget cho từng user độc lập
        this.runAutoPipelineCycle(cfg.userEmail).catch((err) => {
          this.logger.error(`[TKGD-CRON] Lỗi chu kỳ tự động cho ${cfg.userEmail}: ${err.message}`);
        });
      }
    } catch (err: any) {
      this.logger.error(`[TKGD-CRON] Lỗi kiểm tra hàng loạt: ${err.message}`);
    }
  }

  /**
   * Kích hoạt 1 chu trình tự động toàn diện: Quét Mail -> Bóc tách OCR -> Đồng bộ M-System -> Đối soát -> Cập nhật Excel
   */
  async runAutoPipelineCycle(userEmail: string): Promise<{ success: boolean; processedCount: number; message: string }> {
    // Per-user mutex: chặn cùng 1 user chạy đè nhau, nhưng không chặn các user khác
    if (this.autoPipelineRunningUsers.has(userEmail)) {
      return { success: false, processedCount: 0, message: `${userEmail} đang trong chu kỳ xử lý, bỏ qua.` };
    }

    this.autoPipelineRunningUsers.add(userEmail);
    this.logger.log(`[TKGD-AUTO] Bắt đầu chu trình tự động hóa 24/7 cho ${userEmail}...`);

    // Timeout tổng cho toàn bộ chu kỳ = 8 phút (an toàn khi interval ngắn nhất là 3 phút)
    const PIPELINE_TIMEOUT_MS = 8 * 60 * 1000;

    try {
      const pipelineTask = async () => {
        const userCfg = await this.userConfigModel.findOne({ userEmail }).lean();
        const executionMode = userCfg?.autoPipeline?.executionMode || 'BATCH';
        const isStream = executionMode === 'INSTANT_STREAM';
        const shouldSyncMS = userCfg?.autoPipeline?.autoSyncMSystem !== false;
        const shouldExportExcel = userCfg?.autoPipeline?.autoExportExcel !== false;

        if (isStream) {
          this.logger.log(`[TKGD-AUTO]  Kích hoạt chu trình Liền Mạch Tức Thì (Instant Stream) cho ${userEmail}...`);
        }

        // 1. Quét mail mới
        this.updateProgress(userEmail, {
          isProcessing: true,
          taskType: 'SYNC_MAIL',
          stage: isStream
            ? ' [Liền Mạch] Đang quét email mở TKGD mới và bóc tách tức thì...'
            : 'Đang tự động quét email mở TKGD mới...',
          percent: 15,
        });
        const mailResult = await this.syncMailOpeningAccounts(userEmail);
        const newMailCount = mailResult.count || 0;

        const todayStr = new Date().toISOString().slice(0, 10);

        // 2. Cào M-System nếu bật cấu hình và có hồ sơ chưa đồng bộ
        let msResult = { scrapedCount: 0 };
        if (shouldSyncMS) {
          const pendingSyncCount = await this.cleanRecordModel.countDocuments({
            $or: [
              { 'ms.isFoundOnMS': { $ne: true } },
              { ms: null },
              { 'ketLuan.trangThai': 'CHUA_XU_LY' },
            ],
          });

          if (pendingSyncCount > 0) {
            const batchSize = Math.max(1, Math.min(userCfg?.autoPipeline?.batchSize || 10, 15));
            const processBatchCount = Math.min(pendingSyncCount, batchSize);

            this.updateProgress(userEmail, {
              isProcessing: true,
              taskType: 'SYNC_MS',
              stage: isStream
                ? ` [Liền Mạch] Đang cào M-System & đối soát khớp tức thì cho ${processBatchCount} hồ sơ...`
                : `Đang tự động đồng bộ M-System cho ${processBatchCount} hồ sơ (trong tổng ${pendingSyncCount} hồ sơ chờ hôm nay)...`,
              percent: 50,
            });
            // Wrap M-System scraper với timeout 4 phút riêng — Playwright không được treo quá lâu
            const MS_TIMEOUT_MS = 4 * 60 * 1000;
            msResult = await Promise.race([
              this.syncMSystemAccounts(userEmail, { batchDate: todayStr, downloadImages: true }),
              new Promise<{ scrapedCount: number }>((_, reject) =>
                setTimeout(() => reject(new Error('syncMSystemAccounts timeout sau 4 phút')), MS_TIMEOUT_MS)
              ),
            ]).catch((err) => {
              this.logger.warn(`[TKGD-AUTO] ${err.message} — tiếp tục bước đối soát.`);
              return { scrapedCount: 0 };
            });
          }
        }

        // 3. Tự động đối soát và xuất Excel (nếu bật cấu hình)
        if (shouldExportExcel) {
          this.updateProgress(userEmail, {
            isProcessing: true,
            taskType: 'RECONCILE',
            stage: 'Đang tự động đối soát chéo và cập nhật Excel...',
            percent: 85,
          });
          const todayStr = new Date().toISOString().slice(0, 10);
          await this.runReconciliation(userEmail, todayStr);
        }

        return newMailCount + (msResult.scrapedCount || 0);
      };

      // Race giữa pipeline thực tế và timeout tổng — tránh block cron khi có sự cố
      const totalDone = await Promise.race([
        pipelineTask(),
        new Promise<number>((_, reject) =>
          setTimeout(() => reject(new Error(`Pipeline timeout sau ${PIPELINE_TIMEOUT_MS / 60000} phút`)), PIPELINE_TIMEOUT_MS)
        ),
      ]);

      // Lưu timestamp lần chạy cuối
      await this.userConfigModel.updateOne(
        { userEmail },
        { $set: { 'autoPipeline.lastRunTime': Date.now(), 'autoPipeline.lastProcessedCount': totalDone } }
      );

      this.updateProgress(userEmail, {
        isProcessing: false,
        taskType: 'IDLE',
        percent: 100,
        stage: `Hoàn tất chu kỳ tự động: xử lý ${totalDone} mục.`,
      });
      this.logger.log(`[TKGD-AUTO] ✅ Chu kỳ hoàn tất cho ${userEmail}: ${totalDone} mục.`);
      return { success: true, processedCount: totalDone, message: `Đã xử lý xong ${totalDone} mục.` };

    } catch (err: any) {
      this.logger.error(`[TKGD-AUTO] ❌ Lỗi chu trình tự động cho ${userEmail}: ${err.message}`);
      // Vẫn lưu lastRunTime để tránh retry ngay lập tức
      await this.userConfigModel.updateOne(
        { userEmail },
        { $set: { 'autoPipeline.lastRunTime': Date.now() } }
      ).catch(() => { });
      this.updateProgress(userEmail, {
        isProcessing: false,
        taskType: 'IDLE',
        stage: `Lỗi chu kỳ tự động: ${err.message}`,
      });
      return { success: false, processedCount: 0, message: err.message };
    } finally {
      this.autoPipelineRunningUsers.delete(userEmail);
    }
  }

  /**
   * Bật/Tắt chế độ tự động 24/7 cho User
   */
  async toggleAutoPipeline(userEmail: string, enabled?: boolean) {
    let cfg = await this.userConfigModel.findOne({ userEmail });
    if (!cfg) {
      cfg = await this.userConfigModel.create({
        userEmail,
        fullName: userEmail.split('@')[0],
        autoPipeline: { enabled: true, intervalMinutes: 5, batchSize: 50 },
      });
    }

    const currentStatus = cfg.autoPipeline?.enabled ?? false;
    const newStatus = typeof enabled === 'boolean' ? enabled : !currentStatus;

    await this.userConfigModel.updateOne(
      { userEmail },
      { $set: { 'autoPipeline.enabled': newStatus } }
    );

    this.logger.log(`[TKGD-AUTO] ${userEmail} đã ${newStatus ? 'BẬT' : 'TẮT'} chế độ tự động 24/7.`);
    return {
      success: true,
      enabled: newStatus,
      message: newStatus ? 'Đã kích hoạt chế độ Tự Động 24/7 (Quét mỗi 5 phút).' : 'Đã tạm dừng chế độ Tự Động 24/7.',
    };
  }

  /**
   * Lấy trạng thái hiện tại của Bot tự động hóa
   */
  async getAutoPipelineStatus(userEmail: string) {
    const cfg = await this.userConfigModel.findOne({ userEmail });
    const isEnabled = cfg?.autoPipeline?.enabled ?? false;
    const executionMode = cfg?.autoPipeline?.executionMode ?? 'BATCH';
    const lastRunTime = cfg?.autoPipeline?.lastRunTime ?? 0;
    const lastProcessedCount = cfg?.autoPipeline?.lastProcessedCount ?? 0;
    const intervalMinutes = cfg?.autoPipeline?.intervalMinutes ?? 5;

    return {
      enabled: isEnabled,
      executionMode,
      isRunning: this.isAutoPipelineRunning,
      lastRunTime,
      lastProcessedCount,
      intervalMinutes,
      nextRunTime: lastRunTime > 0 ? lastRunTime + intervalMinutes * 60 * 1000 : 0,
    };
  }

  /**
   * Quét vét kho dữ liệu lịch sử theo khoảng ngày (Backfill)
   */
  async runHistoricalBackfill(userEmail: string, fromDate?: string, toDate?: string) {
    this.logger.log(`[TKGD-BACKFILL] ${userEmail} yêu cầu quét vét dữ liệu lịch sử từ ${fromDate || 'toàn bộ'} đến ${toDate || 'nay'}`);
    return this.runAutoPipelineCycle(userEmail);
  }

  /**
   * Tái thẩm định tức thì 1 hồ sơ tài khoản từ dữ liệu sạch trong DB (Xóa sạch stale errors)
   */
  async reEvaluateRecord(recordId: string, userEmail: string) {
    const record = await this.cleanRecordModel.findById(recordId);
    if (!record) {
      throw new NotFoundException(`Không tìm thấy hồ sơ với ID: ${recordId}`);
    }

    const { finalStatus, finalErrors } = this.evaluateRecordReconciliation(record);
    const now = new Date();

    record.ketLuan = {
      trangThai: finalStatus as any,
      danhSachLoi: finalErrors,
      reconciledAt: now,
    };

    await this.cleanRecordModel.updateOne(
      { _id: record._id },
      {
        $set: {
          'ketLuan.trangThai': finalStatus,
          'ketLuan.danhSachLoi': finalErrors,
          'ketLuan.reconciledAt': now,
        },
      },
    );

    this.logger.log(
      `[RE-EVALUATE] ${userEmail} tái thẩm định thành công hồ sơ ${record.maTKGD || record.maTKGDBase}: ${finalStatus} (${finalErrors.length} lỗi/cảnh báo)`,
    );

    return {
      success: true,
      message: `Tái thẩm định thành công: ${finalStatus}`,
      record,
    };
  }
}

