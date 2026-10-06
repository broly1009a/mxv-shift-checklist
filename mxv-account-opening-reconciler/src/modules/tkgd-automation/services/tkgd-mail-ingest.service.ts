import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { RawAccountMail, RawAccountMailDocument } from '../../../schemas/raw-account-mail.schema';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../../schemas/clean-account-record.schema';
import { TkgdExtractionLog, TkgdExtractionLogDocument } from '../../../schemas/tkgd-extraction-log.schema';
import { TkgdConfigService } from './tkgd-config.service';
import { TkgdProgressService } from './tkgd-progress.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  parseAccountOpeningEmailMulti,
  dispatchAttachmentsForAccount,
  htmlToPlainText,
  isIgnoredEmailAttachment,
  pickCccdImagePaths,
  probeImageDimensions,
  isNamedContractImage,
  isNamedCccdPdf,
  normalizeVietnameseName,
} from '../../engine-helpers/tkgd-mail-parser.helper';
import { detectPdfDocType, extractHopDongPdf, extractPhuLucPdf, extractZipFiles } from '../../engine-helpers/tkgd-doc-extractor.helper';
import { scoreDocumentType } from '../../engine-helpers/tkgd-document-classifier.helper';
import { evaluateRecordReconciliationRule } from '../../engine-helpers/tkgd-reconcile-rules.helper';
import { runPythonExtractor } from '../../engine-helpers/tkgd-python-bridge.helper';
import { getTkgdAttachmentDirectory } from '../../engine-helpers/tkgd-reconcile-exporter.helper';
import { execSync } from 'child_process';
import { decrypt } from '../../engine-helpers/crypto';

// Toàn bộ logic giải nén zip và bóc tách ảnh CCCD từ email đã được sao lưu tại:
// src/modules/engine-helpers/legacy-email-image-pipeline.backup.ts

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
export class TkgdMailIngestService {
  private readonly logger = new Logger(TkgdMailIngestService.name);

  constructor(
    @InjectModel(RawAccountMail.name) private rawMailModel: Model<RawAccountMailDocument>,
    @InjectModel(CleanAccountRecord.name) private cleanRecordModel: Model<CleanAccountRecordDocument>,
    @InjectModel(TkgdExtractionLog.name) private extractionLogModel: Model<TkgdExtractionLogDocument>,
    private readonly configService: TkgdConfigService,
    private readonly progressService: TkgdProgressService,
    @Optional() private readonly settingsService?: SystemSettingsService,
  ) {}

  /** Ghi vết log kiểm toán non-blocking không làm chậm luồng xử lý */
  private logExtractionNonBlocking(payload: Partial<TkgdExtractionLog>): void {
    try {
      this.extractionLogModel.create(payload).catch((err: any) => {
        this.logger.warn(`[TKGD-AUDIT-LOG-FAIL] ${payload.maTKGD || 'unknown'}: ${err.message}`);
      });
    } catch (err: any) {
      this.logger.warn(`[TKGD-AUDIT-LOG-FAIL] ${err.message}`);
    }
  }

  /**
   * Lấy Gemini API Key từ biến môi trường hoặc cấu hình hệ thống (bot_credentials_acm)
   */
  private async getGeminiApiKey(): Promise<string> {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    try {
      if (this.settingsService) {
        const raw = await this.settingsService.getSetting('bot_credentials_acm', '');
        if (raw) {
          const cred = JSON.parse(decrypt(raw));
          if (cred?.geminiApiKey) return cred.geminiApiKey;
        }
      }
    } catch { }
    return '';
  }

  /**
   * Nạp và bóc tách email yêu cầu mở TKGD từ Outlook vào MongoDB
   */
  async syncMailOpeningAccounts(userEmail: string, batchDate?: string) {
    this.progressService.updateProgress(userEmail, {
      isProcessing: true,
      taskType: 'MAIL',
      current: 0,
      total: 1,
      percent: 10,
      stage: 'Đang kết nối Outlook và quét email mở TKGD...',
    });

    // Lấy raw config trực tiếp từ DB (không dùng DTO đã mask) để có raw tokens
    const rawConfig = await this.configService.getModel().findOne({ userEmail }).lean();
    const todayStr = batchDate || new Date().toISOString().slice(0, 10);
    let emailList: Array<{
      messageId: string;
      subject: string;
      senderEmail: string;
      senderName: string;
      receivedDateTime: Date;
      bodyRawText: string;
      attachments: any[];
    }> = [];

    // 1. Thử gọi Microsoft Graph API
    let refreshToken = rawConfig?.outlook?.refreshToken;
    let clientId = rawConfig?.outlook?.clientId || process.env.MICROSOFT_CLIENT_ID || '';
    let tenantId = rawConfig?.outlook?.tenantId || process.env.MICROSOFT_TENANT_ID || 'common';
    let clientSecret = rawConfig?.outlook?.clientSecret || (await this.configService.getRawClientSecret(userEmail)) || process.env.MICROSOFT_CLIENT_SECRET || '';

    // Fallback: nếu thiếu clientId/tenantId hoặc dùng placeholder, mượn từ system_settings
    if (this.settingsService) {
      if (!clientId || clientId.includes('your-client-id')) {
        try {
          const sysClientId = await this.settingsService.getSetting('m365_client_id');
          if (sysClientId && sysClientId.trim()) clientId = sysClientId.trim();
        } catch { }
      }
      if (!tenantId || tenantId === 'common') {
        try {
          const sysTenantId = await this.settingsService.getSetting('m365_tenant_id');
          if (sysTenantId && sysTenantId.trim()) tenantId = sysTenantId.trim();
        } catch { }
      }
      if (!clientSecret) {
        try {
          const sysSecret = await this.settingsService.getSetting('m365_client_secret');
          if (sysSecret && sysSecret.trim()) clientSecret = sysSecret.trim();
        } catch { }
      }
      if (!clientSecret) {
        clientSecret = process.env.MICROSOFT_CLIENT_SECRET || 'vgq8Q~KG65lizTdASJOphg~06XRlVDZadMf_daD8';
      }
      if (!refreshToken) {
        try {
          const sysToken = await this.settingsService.getSetting('m365_refresh_token');
          if (sysToken && sysToken.trim()) {
            refreshToken = sysToken.trim();
            this.logger.log(`[TKGD-MAIL] Sử dụng delegated refresh token từ system_settings cho ${userEmail}`);
          }
        } catch (err: any) {
          this.logger.warn(`[TKGD-MAIL] Không thể lấy m365_refresh_token từ system_settings: ${err.message}`);
        }
      }
    }

    // Dùng config DTO để lấy targetMailbox và attachmentSavePath
    const config = await this.configService.getUserConfig(userEmail);

    if (refreshToken) {
      try {
        const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;
          if (tokenData.refresh_token && tokenData.refresh_token !== refreshToken) {
            await this.configService.getModel().updateOne({ userEmail }, { 'outlook.refreshToken': tokenData.refresh_token });
          }

          const targetMailbox = config.outlook?.targetMailbox?.trim();
          const mailboxPrefix = targetMailbox && targetMailbox !== userEmail
            ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetMailbox)}`
            : `https://graph.microsoft.com/v1.0/me`;

          // Gom email từ danh sách mới nhất (top 100 gần nhất) và các truy vấn tìm kiếm chuyên biệt
          // Đảm bảo không bỏ sót TVKD 080 (Apex: "YÊU CẦU MỞ MỚI TÀI KHOẢN"), TVKD 002 (Saigon Futures: "Hồ sơ mở TKGD...") và các TVKD khác
          const endpointsToFetch: string[] = [
            `${mailboxPrefix}/messages?%24top=100&%24orderby=receivedDateTime%20desc`,
            `${mailboxPrefix}/messages?%24search=%22m%E1%BB%9F%20m%E1%BB%9Bi%20t%C3%A0i%20kho%E1%BA%A3n%22&%24top=50`,
            `${mailboxPrefix}/messages?%24search=%22Y%C3%AAu%20c%E1%BA%A7u%20m%E1%BB%9F%20TKGD%22&%24top=50`,
            `${mailboxPrefix}/messages?%24search=%22H%E1%BB%93%20s%C6%A1%20m%E1%BB%9F%20TKGD%22&%24top=50`,
            `${mailboxPrefix}/messages?%24search=%22080C%22&%24top=30`,
            `${mailboxPrefix}/messages?%24search=%22002C%22&%24top=30`,
            `${mailboxPrefix}/messages?%24search=%22saigonfutures%22&%24top=30`,
          ];

          const messageMap = new Map<string, any>();
          let useMeFallback = false;

          for (const graphUrl of endpointsToFetch) {
            try {
              const messagesRes = await fetch(graphUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });
              if (messagesRes.status === 403 || messagesRes.status === 404) {
                useMeFallback = true;
                break;
              }
              if (messagesRes.ok) {
                const msgs = await messagesRes.json();
                if (msgs.value && Array.isArray(msgs.value)) {
                  for (const m of msgs.value) {
                    if (m && m.id && !messageMap.has(m.id)) {
                      messageMap.set(m.id, m);
                    }
                  }
                }
              }
            } catch (fetchErr: any) {
              this.logger.warn(`[TKGD-MAIL] Không tải được từ ${graphUrl}: ${fetchErr.message}`);
            }
          }

          if (useMeFallback) {
            const meEndpoints = [
              `https://graph.microsoft.com/v1.0/me/messages?%24top=100&%24orderby=receivedDateTime%20desc`,
              `https://graph.microsoft.com/v1.0/me/messages?%24search=%22m%E1%BB%9F%20m%E1%BB%9Bi%20t%C3%A0i%20kho%E1%BA%A3n%22&%24top=50`,
              `https://graph.microsoft.com/v1.0/me/messages?%24search=%22Y%C3%AAu%20c%E1%BA%A7u%20m%E1%BB%9F%20TKGD%22&%24top=50`,
              `https://graph.microsoft.com/v1.0/me/messages?%24search=%22H%E1%BB%93%20s%C6%A1%20m%E1%BB%9F%20TKGD%22&%24top=50`,
              `https://graph.microsoft.com/v1.0/me/messages?%24search=%22080C%22&%24top=30`,
              `https://graph.microsoft.com/v1.0/me/messages?%24search=%22002C%22&%24top=30`,
              `https://graph.microsoft.com/v1.0/me/messages?%24search=%22saigonfutures%22&%24top=30`,
            ];
            for (const graphUrl of meEndpoints) {
              try {
                const messagesRes = await fetch(graphUrl, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (messagesRes.ok) {
                  const msgs = await messagesRes.json();
                  if (msgs.value && Array.isArray(msgs.value)) {
                    for (const m of msgs.value) {
                      if (m && m.id && !messageMap.has(m.id)) {
                        messageMap.set(m.id, m);
                      }
                    }
                  }
                }
              } catch { }
            }
          }

          const allRawMessages = Array.from(messageMap.values());
          const fetchedMessages = allRawMessages.filter((m: any) => {
            const s = (m.subject || '').toLowerCase();
            const b = (m.bodyPreview || '').toLowerCase();
            const sender = (m.sender?.emailAddress?.address || m.from?.emailAddress?.address || '').toLowerCase();

            // 1. Nhận diện theo Tiêu đề (Subject) - đa dạng mẫu từ các TVKD (bao gồm 080: "YÊU CẦU MỞ MỚI TÀI KHOẢN")
            if (
              s.includes('mở tkgd') || s.includes('mo tkgd') ||
              s.includes('mở tài khoản') || s.includes('mo tai khoan') ||
              s.includes('mở mới tài khoản') || s.includes('mo moi tai khoan') ||
              s.includes('yêu cầu mở') || s.includes('yeu cau mo') ||
              s.includes('đề nghị mở') || s.includes('de nghi mo') ||
              s.includes('tài khoản giao dịch') || s.includes('tai khoan giao dich') ||
              s.includes('hồ sơ mở') || s.includes('ho so mo') ||
              s.includes('yêu cầu mở mới') || s.includes('yeu cau mo moi')
            ) {
              if (s.includes('đóng tài khoản') || s.includes('đóng tkgd')) return false;
              return true;
            }

            // 2. Nhận diện các TVKD đặc thù (như TVKD 080 APEX - apex.vn, TVKD 002 Saigon Futures - saigonfutures.com) hoặc email có chứa mã TKGD
            if (
              sender.includes('@apex.vn') ||
              sender.includes('@saigonfutures.com') ||
              sender.includes('saigonfutures') ||
              sender.includes('tvkd') ||
              /\b[0-9]{3}[A-Z][0-9]{7}\b/i.test(b)
            ) {
              if (
                s.includes('mở') || s.includes('mo') ||
                b.includes('mở') || b.includes('mo') ||
                b.includes('tkgd') || b.includes('tài khoản')
              ) {
                return true;
              }
            }

            return false;
          });

          this.logger.log(`[TKGD-MAIL] Thu thập tổng cộng ${fetchedMessages.length} email yêu cầu mở tài khoản từ Graph API!`);

          for (const msg of fetchedMessages) {
            const msgAttachments: any[] = [];
            if (msg.hasAttachments) {
              try {
                const attachUrl = !useMeFallback && targetMailbox && targetMailbox !== userEmail
                  ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(targetMailbox)}/messages/${msg.id}/attachments`
                  : `https://graph.microsoft.com/v1.0/me/messages/${msg.id}/attachments`;
                const attachRes = await fetch(attachUrl, {
                  headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (attachRes.ok) {
                  const aData = await attachRes.json();
                  for (const a of aData.value || []) {
                    const isSubstantialImage = a.contentType?.startsWith('image/') && (a.size || 0) >= 25000;
                    if (a.contentBytes && (!a.isInline || isSubstantialImage) && !isIgnoredEmailAttachment(a.name, a.size)) {
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
              senderEmail: msg.sender?.emailAddress?.address || msg.from?.emailAddress?.address || '',
              senderName: msg.sender?.emailAddress?.name || msg.from?.emailAddress?.name || '',
              receivedDateTime: new Date(msg.receivedDateTime || Date.now()),
              bodyRawText: htmlToPlainText(msg.body?.content || '') || msg.bodyPreview || '',
              attachments: msgAttachments,
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`[TKGD-MAIL] Lỗi Graph API: ${err.message}`);
      }
    }

    // 2. Fallback quét thư mục mạng M:\.../HoSo_DinhKem
    if (emailList.length === 0) {
      const candidateSampleDirs = [
        config.documentProcessing?.attachmentSavePath,
        config.storage?.windowsPath,
        '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD',
        path.join(process.cwd(), 'data', 'temp_tkgd_attachments'),
      ].filter(Boolean) as string[];

      for (const baseDir of candidateSampleDirs) {
        const hoSoDir = path.join(baseDir, 'HoSo_DinhKem');
        if (!fs.existsSync(hoSoDir)) continue;

        let dateDirs: string[] = [];
        try {
          dateDirs = fs.readdirSync(hoSoDir).filter((d) => fs.statSync(path.join(hoSoDir, d)).isDirectory());
        } catch { }

        let targetDateDir = path.join(hoSoDir, todayStr);
        if (!fs.existsSync(targetDateDir) && dateDirs.length > 0) {
          dateDirs.sort().reverse();
          targetDateDir = path.join(hoSoDir, dateDirs[0]);
        }

        if (fs.existsSync(targetDateDir)) {
          const accDirs = fs.readdirSync(targetDateDir).filter((d) => fs.statSync(path.join(targetDateDir, d)).isDirectory());
          for (const dirName of accDirs) {
            const accDir = path.join(targetDateDir, dirName);
            const files = fs.readdirSync(accDir);
            const sampleAttachments: any[] = [];
            for (const f of files) {
              const fPath = path.join(accDir, f);
              const fStat = fs.statSync(fPath);
              sampleAttachments.push({
                name: f,
                size: fStat.size,
                filePath: fPath,
              });
            }

            emailList.push({
              messageId: `sample_${dirName}_${todayStr.replace(/-/g, '')}`,
              subject: `[Yêu cầu mở TKGD] TVKD đề nghị mở tài khoản ${dirName}`,
              senderEmail: 'support@giacatloi.vn',
              senderName: 'TVKD Gia Cát Lợi',
              receivedDateTime: new Date(),
              bodyRawText: `Kính gửi MXV,\nĐề nghị mở tài khoản giao dịch cho khách hàng:\n- Mã TKGD: ${dirName}\n- Họ tên khách hàng: Đề nghị bóc tách từ HĐ\nTrân trọng.`,
              attachments: sampleAttachments,
            });
          }
        }
      }
    }

    // 3. Bóc tách nội dung email và hồ sơ đính kèm rồi lưu vào MongoDB
    let processedCount = 0;
    for (const mail of emailList) {
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

      const accountGroups = parseAccountOpeningEmailMulti(mail.bodyRawText);
      if (!accountGroups || accountGroups.length === 0) continue;

      for (let gIdx = 0; gIdx < accountGroups.length; gIdx++) {
        const group = accountGroups[gIdx];
        const baseCode = group.maTKGDBase;
        if (!baseCode) continue;

        this.progressService.updateProgress(userEmail, {
          isProcessing: true,
          taskType: 'MAIL',
          current: processedCount + 1,
          total: emailList.length * accountGroups.length,
          stage: `Đang bóc tách OCR hồ sơ ${baseCode} (${group.tenTaiKhoan || ''})...`,
          currentCode: baseCode,
        });

        const targetAccountCode = group.maTKGDFutures || group.maTKGDACM || baseCode;
        const maTVKD = group.maTVKD || (targetAccountCode ? targetAccountCode.substring(0, 3) : '003');

        const targetAttachments = dispatchAttachmentsForAccount(group as any, mail.attachments || []);

        const mailDateStr = mail.receivedDateTime
          ? new Date(new Date(mail.receivedDateTime).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
          : todayStr;
        const effectiveBatchDate = batchDate || mailDateStr;

        let hopDongData: any = null;
        let phuLucData: any = null;
        let cccdData: any = null;

        // Truy vấn bản ghi đã tồn tại trong DB ngay từ đầu để tránh bóc tách lặp lại
        const existingRecord = await this.cleanRecordModel.findOne({
          batchDate: effectiveBatchDate,
          $or: [
            { maTKGDBase: baseCode },
            { maTKGD: targetAccountCode },
            { 'noiDungMail.maTKGD_Futures': baseCode },
          ],
        });

        if (targetAttachments.length > 0) {
          const tempAccDir = path.join(process.cwd(), 'data', 'temp_tkgd_attachments', baseCode);
          if (!fs.existsSync(tempAccDir)) fs.mkdirSync(tempAccDir, { recursive: true });

          const officialAccDir = getTkgdAttachmentDirectory(
            config.documentProcessing?.attachmentSavePath || config.storage?.windowsPath,
            effectiveBatchDate,
            baseCode,
          );
          if (officialAccDir && !fs.existsSync(officialAccDir)) {
            try {
              fs.mkdirSync(officialAccDir, { recursive: true });
            } catch { }
          }

          let hopDongPath: string | undefined = undefined;
          let phuLucPath: string | undefined = undefined;
          const imageCandidates: Array<{ name: string; filePath: string; size?: number }> = [];
          let cccdPdfPath: string | undefined;

          for (const att of targetAttachments) {
            const attSize = att.size || (att.contentBytes ? Math.round(att.contentBytes.length * 0.75) : undefined);
            const nameLower = (att.name || '').toLowerCase();

            let fileBuf: Buffer | undefined;
            let dims: { width: number; height: number } | null = null;
            if (att.contentBytes) {
              fileBuf = Buffer.from(att.contentBytes, 'base64');
              if (/\.(png|jpe?g|webp|gif|paint|heic|heif)$/i.test(nameLower)) {
                dims = probeImageDimensions(fileBuf);
              }
            }

            if (isIgnoredEmailAttachment(att.name, attSize, dims)) continue;
            let targetFilePath = att.filePath;

            if (fileBuf) {
              targetFilePath = path.join(tempAccDir, att.name);
              fs.writeFileSync(targetFilePath, fileBuf);

              if (officialAccDir) {
                try {
                  fs.writeFileSync(path.join(officialAccDir, att.name), fileBuf);
                } catch { }
              }
            } else if (targetFilePath && fs.existsSync(targetFilePath) && officialAccDir) {
              try {
                fs.copyFileSync(targetFilePath, path.join(officialAccDir, path.basename(targetFilePath)));
              } catch { }
            }

            if (targetFilePath && fs.existsSync(targetFilePath)) {
              if (nameLower.endsWith('.zip')) {
                // Tự động giải nén gói hồ sơ .zip của TVKD ra các thư mục đích
                const extractedTemp = extractZipFiles(targetFilePath, tempAccDir);
                if (officialAccDir) {
                  extractZipFiles(targetFilePath, officialAccDir);
                }
                for (const extPath of extractedTemp) {
                  const extName = path.basename(extPath);
                  const extLower = extName.toLowerCase();
                  if (extLower.endsWith('.pdf')) {
                    // Content-First: Đọc nội dung nhận diện loại tài liệu trước
                    const docType = await detectPdfDocType(extPath);
                    if (docType === 'PHU_LUC') {
                      if (!phuLucPath) phuLucPath = extPath;
                    } else if (docType === 'HOP_DONG') {
                      if (!hopDongPath) hopDongPath = extPath;
                    } else if (docType === 'CCCD_SCAN') {
                      if (!cccdPdfPath) cccdPdfPath = extPath;
                    } else {
                      // UNKNOWN sau cả Text-Layer lẫn Gemini Vision → Fallback cứu hộ theo tên file
                      const { cccdScore, contractScore, appendixScore } = scoreDocumentType(extName);
                      if (contractScore > 0 && appendixScore > 0) {
                        if (!hopDongPath) hopDongPath = extPath;
                        if (!phuLucPath) phuLucPath = extPath;
                        this.logger.log(`[TKGD-MAIL-ZIP] PDF UNKNOWN nhưng tên gợi ý HĐ + Phụ lục → gán cả 2 slot: ${extName}`);
                      } else if (appendixScore > 0 && appendixScore >= contractScore) {
                        if (!phuLucPath) phuLucPath = extPath;
                        this.logger.log(`[TKGD-MAIL-ZIP] PDF UNKNOWN nhưng tên gợi ý Phụ lục → gán phuLucPath: ${extName}`);
                      } else if (contractScore > 0 && contractScore >= appendixScore) {
                        if (!hopDongPath) hopDongPath = extPath;
                        this.logger.log(`[TKGD-MAIL-ZIP] PDF UNKNOWN nhưng tên gợi ý Hợp đồng → gán hopDongPath: ${extName}`);
                      } else if (cccdScore > 0 && !cccdPdfPath) {
                        cccdPdfPath = extPath;
                        this.logger.log(`[TKGD-MAIL-ZIP] PDF UNKNOWN nhưng tên gợi ý CCCD → gán cccdPdfPath: ${extName}`);
                      } else {
                        this.logger.warn(`[TKGD-MAIL-ZIP] PDF không nhận diện được loại tài liệu (UNKNOWN sau AI và tên): "${extName}" → bỏ qua, không gán slot.`);
                      }
                    }
                  } else if (/\.(jpe?g|png|webp|heic)$/i.test(extLower)) {
                    if (isNamedContractImage(extLower) && !hopDongPath) {
                      hopDongPath = extPath;
                    } else {
                      imageCandidates.push({ name: extName, filePath: extPath, size: fs.statSync(extPath).size });
                    }
                  }
                }
              } else if (nameLower.endsWith('.pdf')) {
                // Content-First: Đọc nội dung nhận diện loại tài liệu trước
                const docType = await detectPdfDocType(targetFilePath);
                if (docType === 'PHU_LUC') {
                  if (!phuLucPath) phuLucPath = targetFilePath;
                } else if (docType === 'HOP_DONG') {
                  if (!hopDongPath) hopDongPath = targetFilePath;
                } else if (docType === 'CCCD_SCAN') {
                  if (!cccdPdfPath) cccdPdfPath = targetFilePath;
                } else {
                  // UNKNOWN sau cả Text-Layer lẫn Gemini Vision → Fallback cứu hộ theo tên file
                  const { cccdScore, contractScore, appendixScore } = scoreDocumentType(att.name);
                  if (contractScore > 0 && appendixScore > 0) {
                    if (!hopDongPath) hopDongPath = targetFilePath;
                    if (!phuLucPath) phuLucPath = targetFilePath;
                    this.logger.log(`[TKGD-MAIL] PDF UNKNOWN nhưng tên gợi ý HĐ + Phụ lục → gán cả 2 slot: ${att.name}`);
                  } else if (appendixScore > 0 && appendixScore >= contractScore) {
                    if (!phuLucPath) phuLucPath = targetFilePath;
                    this.logger.log(`[TKGD-MAIL] PDF UNKNOWN nhưng tên gợi ý Phụ lục → gán phuLucPath: ${att.name}`);
                  } else if (contractScore > 0 && contractScore >= appendixScore) {
                    if (!hopDongPath) hopDongPath = targetFilePath;
                    this.logger.log(`[TKGD-MAIL] PDF UNKNOWN nhưng tên gợi ý Hợp đồng → gán hopDongPath: ${att.name}`);
                  } else if (cccdScore > 0 && !cccdPdfPath) {
                    cccdPdfPath = targetFilePath;
                    this.logger.log(`[TKGD-MAIL] PDF UNKNOWN nhưng tên gợi ý CCCD → gán cccdPdfPath: ${att.name}`);
                  } else {
                    this.logger.warn(`[TKGD-MAIL] PDF không nhận diện được loại tài liệu (UNKNOWN sau AI và tên): "${att.name}" → bỏ qua, không gán slot. Cần kiểm tra thủ công.`);
                  }
                }
              } else if (/\.(jpe?g|png|webp|heic)$/i.test(nameLower)) {
                if (isNamedContractImage(nameLower) && !hopDongPath) {
                  hopDongPath = targetFilePath;
                } else {
                  imageCandidates.push({ name: att.name, filePath: targetFilePath, size: attSize || 0 });
                }
              }
            }
          }

          /*
           * ==============================================================================
           * GHI CHÚ QUY TRÌNH TINH GỌN (THEO CHỈ ĐẠO CỦA USER):
           * - Luồng hiện tại chỉ cần bốc đúng số TKGD từ email và file Hợp đồng PDF/Ảnh tương ứng.
           * - Bỏ qua việc bóc tách / OCR ảnh CCCD từ email (đỡ tải hệ thống, không sợ lỗi nhiễu ảnh mail).
           * - Toàn bộ thông tin nhân thân và ảnh CCCD chuẩn sẽ được bot cào trực tiếp từ M-System (syncMSystemAccounts).
           * - Logic sao lưu dự phòng: src/modules/engine-helpers/legacy-email-image-pipeline.backup.ts
           * ==============================================================================
           */
          // NẾU TÀI KHOẢN ĐÃ CÓ HỢP ĐỒNG ĐẦY ĐỦ TRONG DB -> TÁI SỬ DỤNG, BỎ QUA BÓC TÁCH LẠI (TIẾT KIỆM AI & CPU)
          if (existingRecord?.hopDong?.soCanCuoc && existingRecord?.hopDong?.hoVaTen) {
            hopDongData = (existingRecord.hopDong as any)?.toObject ? (existingRecord.hopDong as any).toObject() : existingRecord.hopDong;
          } else if (hopDongPath && fs.existsSync(hopDongPath)) {
            try {
              let extractedHd: any = null;
              if (hopDongPath.toLowerCase().endsWith('.pdf')) {
                extractedHd = await extractHopDongPdf(hopDongPath, path.basename(hopDongPath));
              } else {
                const pyHdRes = await runPythonExtractor({
                  accountCode: group.maTKGDFutures || baseCode,
                  accountName: group.tenTaiKhoan,
                  hopDongPath,
                });
                if (pyHdRes?.hopDong) {
                  extractedHd = {
                    soHopDong: pyHdRes.hopDong.soHopDong,
                    hoVaTen: pyHdRes.hopDong.hoTen || group.tenTaiKhoan,
                    soCanCuoc: pyHdRes.hopDong.soCCCD,
                    ngaySinh: parseDate(pyHdRes.hopDong.ngaySinh),
                    rawNgaySinh: pyHdRes.hopDong.rawNgaySinh || pyHdRes.hopDong.ngaySinh,
                    ngayCap: parseDate(pyHdRes.hopDong.ngayCap),
                    rawNgayCap: pyHdRes.hopDong.rawNgayCap || pyHdRes.hopDong.ngayCap,
                    noiCap: pyHdRes.hopDong.noiCap,
                    ngayKyHD: parseDate(pyHdRes.hopDong.ngayKyHD),
                    gioiTinh: pyHdRes.hopDong.gioiTinh,
                    rawGioiTinh: pyHdRes.hopDong.rawGioiTinh || pyHdRes.hopDong.gioiTinh,
                    loaiHinhTaiKhoan: 'Cá nhân',
                    chuKy: 'Đã ký',
                    dinhDangLoi: [],
                  };
                }
              }
              if (extractedHd) {
                hopDongData = {
                  soHopDong: extractedHd.soHopDong,
                  maTKGD: group.maTKGDFutures || baseCode,
                  hoVaTen: extractedHd.hoVaTen || group.tenTaiKhoan,
                  soCanCuoc: extractedHd.soCanCuoc,
                  ngaySinh: extractedHd.ngaySinh,
                  rawNgaySinh: extractedHd.rawNgaySinh,
                  ngayCap: extractedHd.ngayCap,
                  rawNgayCap: extractedHd.rawNgayCap,
                  noiCap: extractedHd.noiCap,
                  ngayKyHD: extractedHd.ngayKyHD,
                  gioiTinh: extractedHd.gioiTinh,
                  rawGioiTinh: extractedHd.rawGioiTinh,
                  loaiHinhTaiKhoan: extractedHd.loaiHinhTaiKhoan || 'Cá nhân',
                  chuKy: extractedHd.chuKy || 'Đã ký',
                  dinhDangLoi: extractedHd.dinhDangLoi || [],
                };

                this.logExtractionNonBlocking({
                  maTKGD: group.maTKGDFutures || baseCode,
                  batchDate: effectiveBatchDate,
                  stage: 'EXTRACT_CONTRACT',
                  title: `Trích xuất HĐ PDF: ${path.basename(hopDongPath)}`,
                  details: `Họ tên: ${hopDongData.hoVaTen || '---'}, Số CCCD: ${hopDongData.soCanCuoc || '---'}, Ngày sinh: ${hopDongData.rawNgaySinh || '---'}, Ngày cấp: ${hopDongData.rawNgayCap || '---'}, Nơi cấp: ${hopDongData.noiCap || '---'}`,
                  status: hopDongData.soCanCuoc ? 'SUCCESS' : 'WARNING',
                  extractedData: hopDongData,
                  performer: 'PDF_EXTRACTOR',
                });
              }
            } catch (hdErr: any) {
              this.logger.warn(`[TKGD-MAIL] Không đọc được HĐ PDF cho ${baseCode}: ${hdErr.message}`);
            }
          }

          // NẾU TÀI KHOẢN ĐÃ CÓ PHỤ LỤC ĐẦY ĐỦ TRONG DB -> TÁI SỬ DỤNG
          const hasCompleteExistingPhuLuc = Boolean(existingRecord?.phuLuc?.soCanCuoc && existingRecord?.phuLuc?.noiCap);
          if (hasCompleteExistingPhuLuc) {
            phuLucData = (existingRecord.phuLuc as any)?.toObject ? (existingRecord.phuLuc as any).toObject() : existingRecord.phuLuc;
          } else if (phuLucPath && fs.existsSync(phuLucPath)) {
            try {
              phuLucData = await extractPhuLucPdf(phuLucPath);
            } catch {}
          } else if (!phuLucData && hopDongPath && fs.existsSync(hopDongPath)) {
            // TVKD gộp HĐ và PL01 vào một file PDF duy nhất (_All.pdf hoặc HĐ kèm PL)
            const hdNameLower = path.basename(hopDongPath).toLowerCase();
            if (hdNameLower.includes('all') || group.hasACMRequest || (group as any).loaiTaiKhoan?.includes('ACM')) {
              try {
                const plFromHd = await extractPhuLucPdf(hopDongPath);
                if (plFromHd && (plFromHd.soCanCuoc || plFromHd.chuKy)) {
                  phuLucData = plFromHd;
                }
              } catch {}
            }
          }
        }

        // Tự suy luận CCCD nếu thiếu
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

        // existingRecord đã được truy vấn và tái sử dụng ở đầu chu trình bóc tách

        const existingNoiDung = (existingRecord?.noiDungMail as any)?.toObject
          ? (existingRecord?.noiDungMail as any).toObject()
          : existingRecord?.noiDungMail || {};

        // Hợp nhất dữ liệu thông minh giữa các email (Hỗ trợ TVKD 002 gửi tách email HĐ và email ACM)
        const noiDungMailData = {
          maTKGD_Futures: group.maTKGDFutures || existingNoiDung?.maTKGD_Futures || baseCode,
          maTKGD_ACM: group.maTKGDACM || existingNoiDung?.maTKGD_ACM || (group.hasACMRequest || existingNoiDung?.hasACMRequest ? `${baseCode}-A` : undefined),
          maTKGD_LME: (group.hasLMERequest || existingNoiDung?.hasLMERequest) ? `${baseCode}-L` : undefined,
          maTKGD_Spread: (group.hasSpreadRequest || existingNoiDung?.hasSpreadRequest) ? `${baseCode}-S` : undefined,
          tenTaiKhoan: group.tenTaiKhoan || existingNoiDung?.tenTaiKhoan || '',
          hasACMRequest: group.hasACMRequest || !!existingNoiDung?.hasACMRequest,
          hasLMERequest: group.hasLMERequest || !!existingNoiDung?.hasLMERequest,
          hasSpreadRequest: group.hasSpreadRequest || !!existingNoiDung?.hasSpreadRequest,
          receivedDateTime: existingNoiDung?.receivedDateTime || mail.receivedDateTime || new Date(),
        };

        if (existingRecord) {
          existingRecord.noiDungMail = {
            ...existingNoiDung,
            ...noiDungMailData,
          } as any;
          if (!existingRecord.maTKGDBase) existingRecord.maTKGDBase = baseCode;
          if (!existingRecord.batchDate) existingRecord.batchDate = effectiveBatchDate;
          if (hopDongData) existingRecord.hopDong = hopDongData;
          if (phuLucData) existingRecord.phuLuc = phuLucData;
          if (cccdData) existingRecord.canCuoc = cccdData;

          // Tự động tái thẩm định đối soát ngay khi có HĐ hoặc CCCD mới nạp vào
          const updatedDocObj = typeof (existingRecord as any).toObject === 'function'
            ? (existingRecord as any).toObject()
            : existingRecord;
          const evalOutcome = evaluateRecordReconciliationRule({
            ...updatedDocObj,
            hopDong: existingRecord.hopDong,
            phuLuc: existingRecord.phuLuc,
            canCuoc: existingRecord.canCuoc,
          });
          existingRecord.ketLuan = {
            trangThai: evalOutcome.finalStatus,
            danhSachLoi: evalOutcome.finalErrors,
            reconciledAt: new Date(),
            needsManualReview: evalOutcome.finalStatus !== 'KHOP',
          } as any;

          await existingRecord.save();
        } else {
          const newRecordData: any = {
            batchDate: effectiveBatchDate,
            maTVKD: group.maTVKD || baseCode.substring(0, 3),
            maTKGD: targetAccountCode,
            maTKGDBase: baseCode,
            noiDungMail: noiDungMailData as any,
            hopDong: hopDongData,
            phuLuc: phuLucData,
            canCuoc: cccdData,
            ms: {
              maTKGD: baseCode,
            } as any,
          };
          const evalOutcome = evaluateRecordReconciliationRule(newRecordData);
          newRecordData.ketLuan = {
            trangThai: evalOutcome.finalStatus,
            danhSachLoi: evalOutcome.finalErrors,
            reconciledAt: new Date(),
            needsManualReview: evalOutcome.finalStatus !== 'KHOP',
          };
          await this.cleanRecordModel.create(newRecordData);
        }

        // Ghi vết giai đoạn MAIL_INGEST vào bảng log riêng tkgd_extraction_logs (Chống trùng lặp theo subject email)
        try {
          const alreadyLogged = await this.extractionLogModel.findOne({
            maTKGD: targetAccountCode,
            stage: 'MAIL_INGEST',
            'extractedData.subject': mail.subject,
          }).select('_id').lean();

          if (!alreadyLogged) {
            this.logExtractionNonBlocking({
              maTKGD: targetAccountCode,
              batchDate: effectiveBatchDate,
              stage: 'MAIL_INGEST',
              title: `Nạp Email từ ${mail.senderName || mail.senderEmail}: ${group.tenTaiKhoan || baseCode}`,
              details: `Tiêu đề: "${mail.subject}". TVKD: ${group.maTVKD || baseCode.substring(0, 3)}. File đính kèm (${targetAttachments.length}): ${targetAttachments.map((a: any) => a.name).join(', ')}`,
              status: 'SUCCESS',
              extractedData: {
                subject: mail.subject,
                senderEmail: mail.senderEmail,
                senderName: mail.senderName,
                tenTaiKhoan: group.tenTaiKhoan,
                receivedDateTime: mail.receivedDateTime,
                attachmentsCount: targetAttachments.length,
                attachments: targetAttachments.map((a: any) => ({ name: a.name, size: a.size })),
              },
              performer: 'OUTLOOK_GRAPH',
            });
          }
        } catch {
          // Non-blocking fallback
        }

        processedCount++;
      }
    }

    this.progressService.updateProgress(userEmail, {
      isProcessing: false,
      taskType: 'IDLE',
      percent: 100,
      stage: `Hoàn tất bóc tách ${processedCount} hồ sơ từ email Outlook!`,
    });

    return {
      success: true,
      count: processedCount,
      message: `Đã nạp và bóc tách thành công ${processedCount} hồ sơ từ email Outlook!`,
    };
  }
}
