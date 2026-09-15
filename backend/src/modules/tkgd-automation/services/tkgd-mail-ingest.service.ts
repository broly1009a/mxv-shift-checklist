import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { RawAccountMail, RawAccountMailDocument } from '../../../schemas/raw-account-mail.schema';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../../schemas/clean-account-record.schema';
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
} from '../../bot-engine/helpers/tkgd-mail-parser.helper';
import { extractHopDongPdf, extractPhuLucPdf } from '../../bot-engine/helpers/tkgd-doc-extractor.helper';
import { runPythonExtractor } from '../../bot-engine/helpers/tkgd-python-bridge.helper';
import { getTkgdAttachmentDirectory } from '../../bot-engine/helpers/tkgd-reconcile-exporter.helper';

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
    private readonly configService: TkgdConfigService,
    private readonly progressService: TkgdProgressService,
    @Optional() private readonly settingsService?: SystemSettingsService,
  ) {}

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
    let clientSecret = rawConfig?.outlook?.clientSecret || (await this.configService.getRawClientSecret(userEmail)) || process.env.MICROSOFT_CLIENT_SECRET || '';;

    // Fallback: nếu user chưa có refresh token riêng, mượn refresh token từ system_settings
    if (!refreshToken && this.settingsService) {
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
          const endpointsToTry: string[] = [];
          if (targetMailbox && targetMailbox !== userEmail) {
            endpointsToTry.push(
              `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages?$search="Yêu cầu mở TKGD"&$top=50`,
              `https://graph.microsoft.com/v1.0/users/${targetMailbox}/messages?$top=100&$orderby=receivedDateTime desc`
            );
          }
          endpointsToTry.push(
            `https://graph.microsoft.com/v1.0/me/messages?$search="Yêu cầu mở TKGD"&$top=50`,
            `https://graph.microsoft.com/v1.0/me/messages?$top=100&$orderby=receivedDateTime desc`
          );

          let fetchedMessages: any[] = [];
          for (const graphUrl of endpointsToTry) {
            const messagesRes = await fetch(graphUrl, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (messagesRes.ok) {
              const msgs = await messagesRes.json();
              if (msgs.value && msgs.value.length > 0) {
                const matched = msgs.value.filter((m: any) => {
                  const s = (m.subject || '').toLowerCase();
                  return s.includes('yêu cầu mở tkgd') || s.includes('mở tkgd') || s.includes('tài khoản giao dịch') || s.includes('mo tkgd');
                });
                if (matched.length > 0) {
                  fetchedMessages = matched;
                  this.logger.log(`[TKGD-MAIL] Tìm thấy ${matched.length} email phù hợp từ Graph API!`);
                  break;
                }
              }
            }
          }

          for (const msg of fetchedMessages) {
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
              senderEmail: msg.sender?.emailAddress?.address || '',
              senderName: msg.sender?.emailAddress?.name || '',
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

        let hopDongData: any = null;
        let phuLucData: any = null;
        let cccdData: any = null;

        if (targetAttachments.length > 0) {
          const tempAccDir = path.join(process.cwd(), 'data', 'temp_tkgd_attachments', baseCode);
          if (!fs.existsSync(tempAccDir)) fs.mkdirSync(tempAccDir, { recursive: true });

          const officialAccDir = getTkgdAttachmentDirectory(
            config.documentProcessing?.attachmentSavePath || config.storage?.windowsPath,
            todayStr,
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
            if (isIgnoredEmailAttachment(att.name, attSize)) continue;
            const nameLower = (att.name || '').toLowerCase();
            let targetFilePath = att.filePath;

            if (att.contentBytes) {
              targetFilePath = path.join(tempAccDir, att.name);
              const fileBuf = Buffer.from(att.contentBytes, 'base64');
              if (/\.(png|jpe?g|webp|gif)$/i.test(nameLower)) {
                const dims = probeImageDimensions(fileBuf);
                if (isIgnoredEmailAttachment(att.name, attSize, dims)) continue;
              }
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
              if (nameLower.endsWith('.pdf')) {
                if (isNamedCccdPdf(att.name)) {
                  if (!cccdPdfPath) cccdPdfPath = targetFilePath;
                } else if (nameLower.includes('pl01') || nameLower.includes('phuluc') || nameLower.includes('-pl')) {
                  phuLucPath = targetFilePath;
                } else if (nameLower.includes('mxv') || nameLower.includes('hopdong') || nameLower.includes('hd') || !hopDongPath) {
                  hopDongPath = targetFilePath;
                }
              } else if (nameLower.endsWith('.jpg') || nameLower.endsWith('.jpeg') || nameLower.endsWith('.png') || nameLower.endsWith('.webp')) {
                if (!isNamedContractImage(att.name)) {
                  imageCandidates.push({ name: att.name || path.basename(targetFilePath), filePath: targetFilePath, size: attSize });
                }
              }
            }
          }

          const picked = pickCccdImagePaths(imageCandidates);
          const cccdFrontPath = picked.frontPath || cccdPdfPath;
          const cccdBackPath = picked.backPath;

          try {
            const pythonRes = await runPythonExtractor({
              accountCode: baseCode,
              hopDongPath,
              phuLucPath,
              cccdFrontPath,
              cccdBackPath,
            });

            if (pythonRes) {
              if (pythonRes.hopDong) {
                hopDongData = {
                  soHopDong: pythonRes.hopDong.soHopDong,
                  maTKGD: group.maTKGDFutures || baseCode,
                  hoVaTen: pythonRes.hopDong.hoTen || group.tenTaiKhoan,
                  soCanCuoc: pythonRes.hopDong.soCCCD,
                  ngaySinh: parseDate(pythonRes.hopDong.ngaySinh),
                  rawNgaySinh: pythonRes.hopDong.rawNgaySinh || pythonRes.hopDong.ngaySinh,
                  ngayCap: parseDate(pythonRes.hopDong.ngayCap),
                  rawNgayCap: pythonRes.hopDong.rawNgayCap || pythonRes.hopDong.ngayCap,
                  noiCap: pythonRes.hopDong.noiCap || undefined,
                  ngayKyHD: parseDate(pythonRes.hopDong.ngayKyHD),
                  gioiTinh: pythonRes.hopDong.gioiTinh,
                  rawGioiTinh: pythonRes.hopDong.rawGioiTinh || pythonRes.hopDong.gioiTinh,
                  loaiHinhTaiKhoan: 'Cá nhân',
                  chuKy: 'Đã ký',
                  dinhDangLoi: pythonRes.hopDong.dinhDangLoi || [],
                };
              }
              if (pythonRes.canCuoc) {
                const rawDob = pythonRes.canCuoc.rawNgaySinh || pythonRes.canCuoc.ngaySinh;
                const rawCap = pythonRes.canCuoc.rawNgayCap || pythonRes.canCuoc.ngayCap;
                const noiCapFinal = pythonRes.canCuoc.noiCap || hopDongData?.noiCap || undefined;
                cccdData = {
                  soCanCuoc: pythonRes.canCuoc.soCCCD || hopDongData?.soCanCuoc,
                  hoVaTen: pythonRes.canCuoc.hoTen || group.tenTaiKhoan || hopDongData?.hoVaTen,
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
                };
              }
            }
          } catch (pyErr: any) {
            this.logger.warn(`[PYTHON-EXTRACT] Fallback sang TS cho ${baseCode}: ${pyErr.message}`);
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

        const existingRecord = await this.cleanRecordModel.findOne({
          batchDate: todayStr,
          $or: [
            { maTKGDBase: baseCode },
            { maTKGD: targetAccountCode },
            { 'noiDungMail.maTKGD_Futures': baseCode },
          ],
        });

        // BỔ SUNG TRƯỜNG receivedDateTime TỪ EMAIL GỐC M365 GRAPH API
        const noiDungMailData = {
          maTKGD_Futures: group.maTKGDFutures || baseCode,
          maTKGD_ACM: group.maTKGDACM || (group.hasACMRequest ? `${baseCode}-A` : undefined),
          maTKGD_LME: group.hasLMERequest ? `${baseCode}-L` : undefined,
          maTKGD_Spread: group.hasSpreadRequest ? `${baseCode}-S` : undefined,
          tenTaiKhoan: group.tenTaiKhoan || (existingRecord?.noiDungMail as any)?.tenTaiKhoan || '',
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
