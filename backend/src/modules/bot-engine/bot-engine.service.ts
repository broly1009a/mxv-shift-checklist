import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { ShiftsService } from '../shifts/shifts.service';
import { EmailWatcherService } from './email-watcher.service';
import { FileWatcherService } from './file-watcher.service';
import { ApiWatcherService } from './api-watcher.service';
import { BotJobQueueService } from './bot-job-queue.service';
import { PostEodHandlerService } from './post-eod-handler.service';
import { TelegramService } from '../telegram/telegram.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  TeamsNotifierService,
  ExpiringContract,
} from '../notifications/teams-notifier.service';
import { RpaDownloaderService } from './rpa-downloader.service';
import { MarginChangeRequestsService } from '../margin-change-requests/margin-change-requests.service';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

@Injectable()
export class BotEngineService {
  private readonly logger = new Logger(BotEngineService.name);
  private isProcessing = false;

  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    private readonly shiftsService: ShiftsService,
    private readonly emailWatcherService: EmailWatcherService,
    private readonly fileWatcherService: FileWatcherService,
    private readonly apiWatcherService: ApiWatcherService,
    private readonly botJobQueueService: BotJobQueueService,
    private readonly postEodHandlerService: PostEodHandlerService,
    private readonly telegramService: TelegramService,
    private readonly settingsService: SystemSettingsService,
    private readonly teamsNotifierService: TeamsNotifierService,
    private readonly rpaDownloaderService: RpaDownloaderService,
    @Inject(forwardRef(() => MarginChangeRequestsService))
    private readonly marginChangeRequestsService: MarginChangeRequestsService,
  ) { }

  /**
   * Run every 1 minute to check active shift checklists.
   */
  @Cron('* * * * *', {
    name: 'automated-bot-checklist-runner',
    timeZone: 'Asia/Saigon',
  })
  async handleBotChecks() {
    if (this.isProcessing) {
      this.logger.warn(
        'Bot check loop is already running. Skipping this tick.',
      );
      return;
    }

    this.isProcessing = true;
    this.logger.debug('Starting automated checklist bot runner check...');

    try {
      // 1. Fetch active shift logs
      const activeLogs = await this.shiftLogModel
        .find({ status: 'PENDING' })
        .exec();

      if (activeLogs.length === 0) {
        return;
      }

      const systemUser = {
        id: '000000000000000000000000',
        fullName: 'Hệ thống tự động (Bot)',
        username: 'system_bot',
        role: 'ADMIN',
      };

      // Pass 1: Periodic task reset pass based on frequencyMinutes
      for (const log of activeLogs) {
        let hasReset = false;
        for (const task of log.details) {
          if (
            task.isBotCheckSnapshot &&
            task.frequencyMinutesSnapshot &&
            task.frequencyMinutesSnapshot > 0
          ) {
            const isResolved = ['PASSED', 'FAILED', 'NEEDS_ATTENTION'].includes(
              task.status,
            );
            if (isResolved) {
              const lastCheckedTime =
                task.checkedAt ||
                task.completedAt ||
                task.failedAt ||
                task.needsAttentionAt;
              if (lastCheckedTime) {
                const diffMs = Date.now() - new Date(lastCheckedTime).getTime();
                const diffMin = diffMs / (60 * 1000);
                if (diffMin >= task.frequencyMinutesSnapshot) {
                  this.logger.log(
                    `[Bot] Periodic reset for Task [${task.taskId}] in ShiftLog [${log._id}] (Frequency: ${task.frequencyMinutesSnapshot}m, Stale for: ${Math.round(diffMin)}m).`,
                  );
                  await this.shiftsService.updateTaskStatus(
                    log._id.toString(),
                    task.taskId,
                    'PENDING',
                    systemUser,
                    `[Hệ thống tự động] Reset định kỳ ${task.frequencyMinutesSnapshot} phút để quét lại.`,
                    true,
                  );
                  hasReset = true;
                }
              }
            }
          }
        }
        if (hasReset) {
          const updatedLog = await this.shiftLogModel.findById(log._id).exec();
          if (updatedLog) {
            log.details = updatedLog.details;
          }
        }
      }

      for (const log of activeLogs) {
        for (const task of log.details) {
          // Check only bot-driven tasks that are not yet resolved (PASSED, SKIPPED)
          const needsCheck =
            task.isBotCheckSnapshot &&
            (task.status === 'PENDING' || task.status === 'WAITING');
          if (!needsCheck) {
            continue;
          }

          // 2. Enforce Dependency ordering (maker-checker sequential pipeline)
          if (
            task.status === 'PENDING' &&
            task.dependsOnTaskIdsSnapshot &&
            task.dependsOnTaskIdsSnapshot.length > 0
          ) {
            const hasUnmetDeps = task.dependsOnTaskIdsSnapshot.some((depId) => {
              const depTask = log.details.find((t) => t.taskId === depId);
              return depTask && !depTask.isChecked;
            });
            if (hasUnmetDeps) {
              this.logger.debug(
                `[Bot] Task [${task.taskId}] has unmet dependencies. Skipping check.`,
              );
              continue;
            }
          }

          // 3. Enforce Trigger Time
          const nowVN = new Date(Date.now() + 7 * 60 * 60 * 1000); // Vietnam time (GMT+7)
          if (task.status === 'PENDING' && task.botTriggerTimeSnapshot) {
            const [trigH, trigM] = task.botTriggerTimeSnapshot
              .split(':')
              .map(Number);
            const currH = nowVN.getUTCHours();
            const currM = nowVN.getUTCMinutes();

            if (currH < trigH || (currH === trigH && currM < trigM)) {
              // Not yet time to run
              continue;
            }
          }

          // 4. Update task state to WAITING if it was PENDING
          if (task.status === 'PENDING') {
            this.logger.log(
              `[Bot] Transitioning Task [${task.taskId}] to WAITING state.`,
            );
            await this.shiftsService.updateTaskStatus(
              log._id.toString(),
              task.taskId,
              'WAITING',
              systemUser,
              'Hệ thống đang bắt đầu quét kiểm tra tự động...',
              true,
            );
            // Refresh local task variable status
            task.status = 'WAITING';
          }

          // 5. Delegate the check to the corresponding handler
          let checkResult = {
            success: false,
            message: 'Loại kiểm tra không được hỗ trợ.',
          };

          const checkType = task.botCheckTypeSnapshot || 'EMAIL_PARSE';
          const target = task.botCheckTargetSnapshot || '';
          const condition = task.botSuccessConditionSnapshot || '';

          this.logger.debug(
            `[Bot] Checking Task [${task.taskId}] via ${checkType}. Target: "${target}"`,
          );

          if (checkType === 'EMAIL_PARSE') {
            // checkResult = await this.emailWatcherService.checkEmailTask(
            checkResult = await this.emailWatcherService.checkEmailTaskDelegated(
              target,
              condition,
            );

            // Post-EOD processing logic for Negative Margin Accounts Check (Tạm thời đóng tính năng này, comment lại chưa dùng)
            /*
            if (checkResult.success) {
              const isEodTask = task.taskId.toLowerCase().includes('eod') || 
                                task.taskNameSnapshot.toLowerCase().includes('eod') || 
                                target.toLowerCase().includes('eod') ||
                                target.toLowerCase().includes('đối chiếu') ||
                                target.toLowerCase().includes('snapshot');

              if (isEodTask) {
                const rawDownloadDir = await this.settingsService.getSetting('m365_download_directory', '');
                if (rawDownloadDir) {
                  const today = new Date(Date.now() + 7 * 60 * 60 * 1000);
                  const yyyy = today.getUTCFullYear().toString();
                  const mm = (today.getUTCMonth() + 1).toString().padStart(2, '0');
                  const dd = today.getUTCDate().toString().padStart(2, '0');
                  const downloadDir = rawDownloadDir
                    .replace(/\${YYYY}/g, yyyy)
                    .replace(/\${MM}/g, mm)
                    .replace(/\${DD}/g, dd)
                    .replace(/\${yyyy}/g, yyyy)
                    .replace(/\${mm}/g, mm)
                    .replace(/\${dd}/g, dd);

                  if (fs.existsSync(downloadDir)) {
                    const files = fs.readdirSync(downloadDir);
                    const eodFiles = files.filter(f => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls') || f.toLowerCase().endsWith('.csv'));
                    
                    if (eodFiles.length > 0) {
                      this.logger.log(`[Post-EOD] Quét các file EOD tại ${downloadDir} để tìm tài khoản âm ký quỹ...`);
                      let allNegativeAccounts: any[] = [];
                      for (const file of eodFiles) {
                        const filePath = path.join(downloadDir, file);
                        const negatives = await this.postEodHandlerService.scanNegativeMarginAccounts(filePath);
                        allNegativeAccounts = [...allNegativeAccounts, ...negatives];
                      }

                      if (allNegativeAccounts.length > 0) {
                        const count = allNegativeAccounts.length;
                        const detailsList = allNegativeAccounts.map(a => `• Tài khoản: <b>${a.account}</b> | Số dư ký quỹ: <font color="red"><b>${a.margin.toLocaleString()}</b></font>`).join('\n');
                        
                        // Construct Telegram Alert
                        const alertMsg = `⚠️ <b>[CẢNH BÁO KÝ QUỸ ĐẦU NGÀY - POST EOD]</b>\n` +
                          `Phát hiện <b>${count} tài khoản bị âm ký quỹ đầu ngày</b> sau phiên EOD:\n\n` +
                          `${detailsList}\n\n` +
                          `Đề nghị bộ phận trực ca vận hành kiểm tra và xử lý theo quy trình!`;

                        // Send alert via Telegram
                        await this.telegramService.sendMessage(alertMsg);
                        this.logger.warn(`[Post-EOD] Đã phát hiện ${count} tài khoản âm ký quỹ đầu ngày. Đã gửi cảnh báo Telegram.`);

                        // Append to checkResult message for Web UI representation
                        checkResult.message += `. ⚠️ CẢNH BÁO: Phát hiện ${count} tài khoản âm ký quỹ đầu ngày: ${allNegativeAccounts.map(a => `${a.account}(${a.margin})`).join(', ')}`;
                      } else {
                        checkResult.message += `. ✅ Không phát hiện tài khoản nào bị âm ký quỹ đầu ngày.`;
                      }
                    }
                  }
                }
              }
            }
            */
          } else if (checkType === 'FILE_EXISTS') {
            // Fallback to target if fileLocation is not set
            const filePath = task.fileLocationSnapshot || target;
            checkResult = await this.fileWatcherService.checkFileTask(
              filePath,
              condition,
            );
          } else if (checkType === 'API_STATUS') {
            checkResult = await this.apiWatcherService.checkApiTask(
              target,
              condition,
            );
          } else if (checkType === 'RPA_DOWNLOAD') {
            let targets: string[] = ['QLTKGD', 'NR', 'DSTKGD-Futures'];
            try {
              if (target && target.trim().startsWith('[')) {
                targets = JSON.parse(target);
              } else if (target && target.trim()) {
                targets = target.split(',').map((t) => t.trim());
              }
            } catch (e) {
              if (target) targets = [target];
            }

            const existingJob = await this.botJobQueueService.getJobForTask(
              task.taskId,
              log._id.toString(),
            );
            const shouldEnqueueNewJob =
              !existingJob ||
              (existingJob.status === 'FAILED' &&
                (task.status === 'WAITING' || task.status === 'PENDING'));

            if (shouldEnqueueNewJob) {
              // Enqueue new job
              await this.botJobQueueService.enqueue('RPA_DOWNLOAD_REPORTS', {
                taskId: task.taskId,
                shiftLogId: log._id.toString(),
                targets,
                sessionDay: log.shiftDate,
              });
              checkResult = {
                success: false,
                message: 'Đang khởi tạo tác vụ RPA tải file báo cáo...',
              };
            } else {
              if (existingJob.status === 'COMPLETED') {
                checkResult = {
                  success: true,
                  message: `RPA tải báo cáo thành công: ${targets.join(', ')}`,
                };
              } else if (existingJob.status === 'FAILED') {
                const lastLog =
                  existingJob.logs[existingJob.logs.length - 1] ||
                  'Lỗi không xác định';
                checkResult = {
                  success: false,
                  message: `RPA thất bại: ${lastLog}`,
                };
                (checkResult as any).forceFailed = true;
              } else {
                checkResult = {
                  success: false,
                  message: 'Đang chạy RPA tải file báo cáo từ M-System...',
                };
              }
            }
          } else if (checkType === 'RPA_DOWNLOAD_CAST') {
            const existingJob = await this.botJobQueueService.getJobForTask(
              task.taskId,
              log._id.toString(),
            );
            const shouldEnqueueNewJob =
              !existingJob ||
              (existingJob.status === 'FAILED' &&
                (task.status === 'WAITING' || task.status === 'PENDING'));

            if (shouldEnqueueNewJob) {
              await this.botJobQueueService.enqueue('DOWNLOAD_CAST', {
                taskId: task.taskId,
                shiftLogId: log._id.toString(),
                sessionDay: log.shiftDate,
              });
              checkResult = {
                success: false,
                message: 'Đang bắt đầu tải báo cáo CQG CAST Balances...',
              };
            } else {
              if (existingJob.status === 'COMPLETED') {
                checkResult = {
                  success: true,
                  message: 'Tải báo cáo CQG CAST Balances thành công.',
                };
              } else if (existingJob.status === 'FAILED') {
                const lastLog =
                  existingJob.logs[existingJob.logs.length - 1] ||
                  'Lỗi không xác định';
                checkResult = {
                  success: false,
                  message: `Tải CAST thất bại: ${lastLog}`,
                };
                (checkResult as any).forceFailed = true;
              } else {
                checkResult = {
                  success: false,
                  message: 'Đang tải báo cáo CQG CAST Balances...',
                };
              }
            }
          } else if (checkType === 'EMAIL_STATUS_CHECK') {
            const existingJob = await this.botJobQueueService.getJobForTask(
              task.taskId,
              log._id.toString(),
            );
            const shouldEnqueueNewJob =
              !existingJob ||
              (existingJob.status === 'FAILED' &&
                (task.status === 'WAITING' || task.status === 'PENDING'));

            if (shouldEnqueueNewJob) {
              await this.botJobQueueService.enqueue('VERIFY_EMAIL_STATUS', {
                taskId: task.taskId,
                shiftLogId: log._id.toString(),
                sessionDay: log.shiftDate,
              });
              checkResult = {
                success: false,
                message: 'Đang bắt đầu xác minh gửi email sao kê...',
              };
            } else {
              if (existingJob.status === 'COMPLETED') {
                const jobPayload =
                  existingJob.payload instanceof Map
                    ? Object.fromEntries(existingJob.payload)
                    : existingJob.payload || {};
                const failedCount = jobPayload.failedCount || 0;
                const totalCount = jobPayload.totalCount || 0;
                const failedList = jobPayload.failedList || '';

                const checkData = {
                  success: failedCount === 0,
                  message:
                    failedCount === 0
                      ? `Tất cả email sao kê đã được gửi thành công (${totalCount} email).`
                      : `Phát hiện ${failedCount} email gửi thất bại trên tổng số ${totalCount} email.`,
                  data: {
                    totalCount,
                    failedCount,
                    failedList,
                    timestamp: new Date().toISOString(),
                  },
                };

                if (failedCount > 0) {
                  checkResult = {
                    success: false,
                    message: JSON.stringify(checkData),
                  };
                  (checkResult as any).forceFailed = true;
                } else {
                  checkResult = {
                    success: true,
                    message: JSON.stringify(checkData),
                  };
                }
              } else if (existingJob.status === 'FAILED') {
                const lastLog =
                  existingJob.logs[existingJob.logs.length - 1] ||
                  'Lỗi không xác định';
                const checkData = {
                  success: false,
                  message: `RPA xác minh email thất bại: ${lastLog}`,
                  data: {
                    totalCount: 0,
                    failedCount: 0,
                    failedList: '',
                    timestamp: new Date().toISOString(),
                  },
                };
                checkResult = {
                  success: false,
                  message: JSON.stringify(checkData),
                };
                (checkResult as any).forceFailed = true;
              } else {
                checkResult = {
                  success: false,
                  message:
                    'Đang chạy RPA Playwright xác minh trạng thái gửi email sao kê...',
                };
              }
            }
          } else if (checkType === 'AUTO_CHECK_SOD') {
            const existingJob = await this.botJobQueueService.getJobForTask(
              task.taskId,
              log._id.toString(),
            );
            const shouldEnqueueNewJob =
              !existingJob ||
              (existingJob.status === 'FAILED' &&
                (task.status === 'WAITING' || task.status === 'PENDING'));

            if (shouldEnqueueNewJob) {
              await this.botJobQueueService.enqueue('AUTO_CHECK_SOD', {
                taskId: task.taskId,
                shiftLogId: log._id.toString(),
                sessionDay: log.shiftDate,
              });
              checkResult = {
                success: false,
                message: 'Đang bắt đầu đối chiếu SOD...',
              };
            } else {
              if (
                existingJob.status === 'COMPLETED' ||
                existingJob.status === 'FAILED'
              ) {
                const jobPayload =
                  existingJob.payload instanceof Map
                    ? Object.fromEntries(existingJob.payload)
                    : existingJob.payload || {};
                const resData = jobPayload.result || {};
                const discrepancies = resData.discrepancies || resData || [];
                const isSuccess =
                  existingJob.status === 'COMPLETED' &&
                  (!Array.isArray(discrepancies) || discrepancies.length === 0);
                const usdRate = resData.usdRate || 26320;

                let note = `[ĐỐI CHIẾU SỐ DƯ CQG TỰ ĐỘNG]\n`;
                note += `• Lượt quét: Lượt #${existingJob.attempts || 1}/${existingJob.maxAttempts || 3} (Lúc ${new Date().toLocaleTimeString('vi-VN')})\n`;
                note += `• Số tài khoản chênh lệch (> 100 USD): ${Array.isArray(discrepancies) ? discrepancies.length : 0}\n`;
                if (Array.isArray(discrepancies) && discrepancies.length > 0) {
                  note += `⚠️ Danh sách tài khoản lệch:\n`;
                  discrepancies.slice(0, 10).forEach((r: any) => {
                    note += `  - TK ${r.maTKGD}: MS $${r.calculatedBalance} vs CQG $${r.cqgBalance} (Chênh lệch: $${r.differ?.toFixed(2)})\n`;
                  });
                  if (discrepancies.length > 10) {
                    note += `  ... và ${discrepancies.length - 10} tài khoản khác.\n`;
                  }
                } else {
                  note += `✓ Số dư khớp hoàn toàn giữa M-System và CQG.\n`;
                }

                const jsonMsg = JSON.stringify({
                  success: isSuccess,
                  message: note,
                  result: Array.isArray(discrepancies) ? discrepancies : [],
                  type: 'CQG',
                  usdRate,
                });

                checkResult = {
                  success: isSuccess,
                  message: jsonMsg,
                };
                if (!isSuccess) {
                  (checkResult as any).forceFailed = true;
                }
              } else {
                const logsSummary =
                  existingJob.logs.length > 0
                    ? existingJob.logs.join('\n')
                    : 'Đang thực hiện đối chiếu số dư đầu ngày SOD...';
                checkResult = { success: false, message: logsSummary };
              }
            }
          } else if (checkType === 'CHECK_MARGIN_DECISION') {
            try {
              const userObj = {
                id: log.userId,
                _id: log.userId,
                role: 'ADMIN',
              };
              const scanRes =
                await this.marginChangeRequestsService.scanDecisionDocument(
                  userObj,
                );
              if (scanRes && scanRes.fileName) {
                checkResult = {
                  success: true,
                  message: `[Bot quét tự động]: Phát hiện Quyết định "${scanRes.fileName}" (Hiệu lực: ${scanRes.effectiveSession || 'Phiên T'}). Đã tự động bóc tách ${scanRes.totalExtracted || 0} mặt hàng và tạo ${scanRes.totalCreated || 0} yêu cầu chờ duyệt.`,
                };
              } else {
                checkResult = {
                  success: true,
                  message: `[Bot quét tự động]: Không tìm thấy file Quyết định thay đổi ký quỹ trong thư mục ngày ${log.shiftDate}. Mức ký quỹ giữ nguyên.`,
                };
              }
            } catch (err: any) {
              checkResult = {
                success: false,
                message: `[Bot quét tự động]: Lỗi quét thư mục quyết định ký quỹ: ${err.message}`,
              };
            }
          } else if (
            checkType === 'CHECK_KLGD' ||
            checkType === 'CHECK_PRE_EOD'
          ) {
            if (task.taskId === 'ops_open_04_s4') {
              const msBackupBase = await this.settingsService.getSetting(
                'bot_backup_path_ms',
                'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
              );
              const targetDate = new Date(log.shiftDate);
              const year = targetDate.getFullYear().toString();
              const month = String(targetDate.getMonth() + 1).padStart(2, '0');
              const day = String(targetDate.getDate()).padStart(2, '0');
              const subFolder = path.join(
                year,
                `T${month}.${year}`,
                `${day}.${month}`,
              );
              const dailyPath = path.join(msBackupBase, subFolder);

              if (!fs.existsSync(dailyPath)) {
                checkResult = {
                  success: false,
                  message:
                    'Đang chờ thư mục backup ngày hiện tại được khởi tạo...',
                };
              } else {
                const files = fs.readdirSync(dailyPath);
                const marginFiles = files.filter(
                  (f) =>
                    (f.toLowerCase().includes('qltkgd') ||
                      f.toLowerCase().includes('accounts_balances') ||
                      f.toLowerCase().includes('balances')) &&
                    (f.toLowerCase().endsWith('.xlsx') ||
                      f.toLowerCase().endsWith('.xls') ||
                      f.toLowerCase().endsWith('.csv')),
                );

                if (marginFiles.length === 0) {
                  checkResult = {
                    success: false,
                    message:
                      'Đang chờ file báo cáo QLTKGD.xlsx được tải xuống...',
                  };
                } else {
                  this.logger.log(
                    `[Negative Margin Check] Quét file ${marginFiles.join(', ')} tại ${dailyPath} để tìm tài khoản âm ký quỹ...`,
                  );
                  let allNegativeAccounts: any[] = [];
                  for (const file of marginFiles) {
                    const filePath = path.join(dailyPath, file);
                    const negatives =
                      await this.postEodHandlerService.scanNegativeMarginAccounts(
                        filePath,
                      );
                    allNegativeAccounts = [
                      ...allNegativeAccounts,
                      ...negatives,
                    ];
                  }

                  if (allNegativeAccounts.length > 0) {
                    const accNames = allNegativeAccounts
                      .map((a) => a.maTKGD || a.account)
                      .join(', ');
                    checkResult = {
                      success: true,
                      message: `⚠️ Phát hiện ${allNegativeAccounts.length} tài khoản âm ký quỹ: ${accNames}`,
                    };
                  } else {
                    checkResult = {
                      success: true,
                      message: `[Quét tự động]: Thành công. Không phát hiện tài khoản nào bị âm ký quỹ đầu ngày.`,
                    };
                  }
                }
              }
            } else {
              const existingJob = await this.botJobQueueService.getJobForTask(
                task.taskId,
                log._id.toString(),
              );
              const shouldEnqueueNewJob =
                !existingJob ||
                (['COMPLETED', 'FAILED'].includes(existingJob.status) &&
                  (task.status === 'WAITING' || task.status === 'PENDING'));

              if (shouldEnqueueNewJob) {
                const targetJobType =
                  checkType === 'CHECK_KLGD' ? 'CHECK_KLGD' : 'CHECK_PRE_EOD';
                await this.botJobQueueService.enqueue(targetJobType, {
                  taskId: task.taskId,
                  shiftLogId: log._id.toString(),
                  sessionDay: log.shiftDate,
                });
                checkResult = {
                  success: false,
                  message:
                    'Đang bắt đầu đối chiếu dữ liệu 3 bên (M-System vs CQG vs ACM)...',
                };
              } else {
                if (existingJob.status === 'COMPLETED') {
                  const payload = existingJob.payload || {};
                  const result = payload.result || {};
                  if (result.isWaitingFiles) {
                    checkResult = {
                      success: false,
                      message: result.message || 'Đang chờ file đối chiếu...',
                    };
                  } else {
                    const lastLog =
                      existingJob.logs[existingJob.logs.length - 1] ||
                      'Đối chiếu dữ liệu 3 bên thành công.';
                    checkResult = { success: true, message: lastLog };
                  }
                } else if (existingJob.status === 'FAILED') {
                  const logsSummary = existingJob.logs.join('\n');
                  checkResult = {
                    success: false,
                    message: `Đối chiếu 3 bên thất bại:\n${logsSummary}`,
                  };
                  (checkResult as any).forceFailed = true;
                } else {
                  const logsSummary =
                    existingJob.logs.length > 0
                      ? existingJob.logs.join('\n')
                      : 'Đang tự động chạy đối chiếu dữ liệu 3 bên...';
                  checkResult = { success: false, message: logsSummary };
                }
              }
            }
          } else if (checkType === 'FILE_AUDIT_ACM') {
            const existingJob = await this.botJobQueueService.getJobForTask(
              task.taskId,
              log._id.toString(),
            );
            const shouldEnqueueNewJob =
              !existingJob ||
              (['COMPLETED', 'FAILED'].includes(existingJob.status) &&
                (task.status === 'WAITING' || task.status === 'PENDING'));

            if (shouldEnqueueNewJob) {
              await this.botJobQueueService.enqueue('FILE_AUDIT_ACM', {
                taskId: task.taskId,
                shiftLogId: log._id.toString(),
                sessionDay: log.shiftDate,
              });
              checkResult = {
                success: false,
                message: 'Đang khởi chạy kiểm tra file backup ACM...',
              };
            } else {
              if (existingJob.status === 'COMPLETED') {
                const logsSummary = existingJob.logs.join('\n');
                checkResult = { success: true, message: logsSummary };
              } else if (existingJob.status === 'FAILED') {
                const logsSummary = existingJob.logs.join('\n');
                checkResult = {
                  success: false,
                  message: `Kiểm tra backup ACM thất bại:\n${logsSummary}`,
                };
                (checkResult as any).forceFailed = true;
              } else {
                const logsSummary =
                  existingJob.logs.length > 0
                    ? existingJob.logs.join('\n')
                    : 'Đang thực hiện scan & kiểm tra file backup ACM...';
                checkResult = { success: false, message: logsSummary };
              }
            }
          } else if (checkType === 'FILE_AUDIT_MS') {
            const existingJob = await this.botJobQueueService.getJobForTask(
              task.taskId,
              log._id.toString(),
            );
            const shouldEnqueueNewJob =
              !existingJob ||
              (['COMPLETED', 'FAILED'].includes(existingJob.status) &&
                (task.status === 'WAITING' || task.status === 'PENDING'));

            if (shouldEnqueueNewJob) {
              await this.botJobQueueService.enqueue('FILE_AUDIT_MS', {
                taskId: task.taskId,
                shiftLogId: log._id.toString(),
                sessionDay: log.shiftDate,
              });
              checkResult = {
                success: false,
                message: 'Đang khởi chạy kiểm tra file backup MS...',
              };
            } else {
              if (existingJob.status === 'COMPLETED') {
                const logsSummary = existingJob.logs.join('\n');
                checkResult = { success: true, message: logsSummary };
              } else if (existingJob.status === 'FAILED') {
                const logsSummary = existingJob.logs.join('\n');
                checkResult = {
                  success: false,
                  message: `Kiểm tra backup MS thất bại:\n${logsSummary}`,
                };
                (checkResult as any).forceFailed = true;
              } else {
                const logsSummary =
                  existingJob.logs.length > 0
                    ? existingJob.logs.join('\n')
                    : 'Đang thực hiện scan & kiểm tra file backup MS...';
                checkResult = { success: false, message: logsSummary };
              }
            }
          } else if (checkType === 'FILE_AUDIT_CQG') {
            const existingJob = await this.botJobQueueService.getJobForTask(
              task.taskId,
              log._id.toString(),
            );
            const shouldEnqueueNewJob =
              !existingJob ||
              (['COMPLETED', 'FAILED'].includes(existingJob.status) &&
                (task.status === 'WAITING' || task.status === 'PENDING'));

            if (shouldEnqueueNewJob) {
              await this.botJobQueueService.enqueue('FILE_AUDIT_CQG', {
                taskId: task.taskId,
                shiftLogId: log._id.toString(),
                sessionDay: log.shiftDate,
              });
              checkResult = {
                success: false,
                message: 'Đang khởi chạy kiểm tra file backup CQG...',
              };
            } else {
              if (existingJob.status === 'COMPLETED') {
                const logsSummary = existingJob.logs.join('\n');
                checkResult = { success: true, message: logsSummary };
              } else if (existingJob.status === 'FAILED') {
                const logsSummary = existingJob.logs.join('\n');
                checkResult = {
                  success: false,
                  message: `Kiểm tra backup CQG thất bại:\n${logsSummary}`,
                };
                (checkResult as any).forceFailed = true;
              } else {
                const logsSummary =
                  existingJob.logs.length > 0
                    ? existingJob.logs.join('\n')
                    : 'Đang thực hiện scan & kiểm tra file backup CQG...';
                checkResult = { success: false, message: logsSummary };
              }
            }
          } else if (checkType === 'RUN_MACRO') {
            const existingJob = await this.botJobQueueService.getJobForTask(
              task.taskId,
              log._id.toString(),
            );
            const shouldEnqueueNewJob =
              !existingJob ||
              (['COMPLETED', 'FAILED'].includes(existingJob.status) &&
                (task.status === 'WAITING' || task.status === 'PENDING'));

            if (shouldEnqueueNewJob) {
              await this.botJobQueueService.enqueue('RUN_MACRO', {
                taskId: task.taskId,
                shiftLogId: log._id.toString(),
                targetDate: log.shiftDate,
              });
              checkResult = {
                success: false,
                message: 'Đang bắt đầu chạy thống kê báo cáo CCP...',
              };
            } else {
              if (existingJob.status === 'COMPLETED') {
                checkResult = {
                  success: true,
                  message: 'Chạy thống kê báo cáo CCP thành công.',
                };
              } else if (existingJob.status === 'FAILED') {
                const lastLog =
                  existingJob.logs[existingJob.logs.length - 1] ||
                  'Lỗi không xác định';
                checkResult = {
                  success: false,
                  message: `Chạy báo cáo CCP thất bại: ${lastLog}`,
                };
                (checkResult as any).forceFailed = true;
              } else {
                checkResult = {
                  success: false,
                  message: 'Đang chạy báo cáo thống kê CCP...',
                };
              }
            }
          } else if (checkType === 'NOTIFY_MATURITY') {
            try {
              let expiringContracts: ExpiringContract[] = [];
              const email = await this.emailWatcherService.getLatestEmail(
                'Thông báo tất toán hợp đồng',
                'daonguyen@mxv.vn',
              );
              if (email) {
                expiringContracts = this.parseMaturityEmail(email.body);
              } else {
                // TODO: Bỏ đoạn fallback đọc file mail.txt dưới đây khi đã cấu hình đọc email thật thành công
                const fallbackPath = path.join(
                  process.cwd(),
                  'temp',
                  'downloads',
                  'mail.txt',
                );
                if (fs.existsSync(fallbackPath)) {
                  const fallbackContent = fs.readFileSync(fallbackPath, 'utf8');
                  expiringContracts = this.parseEmailText(fallbackContent);
                  this.logger.log(
                    `Using fallback mock email content from: ${fallbackPath} (${expiringContracts.length} contracts)`,
                  );
                }
              }

              if (expiringContracts.length === 0) {
                checkResult = {
                  success: false,
                  message:
                    'Chưa nhận được email Thông báo tất toán hợp đồng từ daonguyen@mxv.vn và không tìm thấy tệp mock fallback.',
                };
              } else {
                const today = new Date(Date.now() + 7 * 60 * 60 * 1000);
                const yyyy = today.getUTCFullYear().toString();
                const mm = (today.getUTCMonth() + 1)
                  .toString()
                  .padStart(2, '0');
                const dd = today.getUTCDate().toString().padStart(2, '0');
                const dateStr = `${yyyy}-${mm}-${dd}`;
                const todayStr = `${dd}/${mm}/${yyyy}`;

                // Filter contracts for today
                const todayContracts = expiringContracts.filter((c) =>
                  c.deadline.includes(todayStr),
                );
                if (todayContracts.length === 0) {
                  checkResult = {
                    success: true,
                    message: `Không có hợp đồng nào đến hạn tất toán trong ngày hôm nay (${todayStr}).`,
                  };
                } else {
                  const tempDir = path.join(
                    process.cwd(),
                    'temp',
                    'reconciliation',
                    dateStr,
                  );
                  if (!fs.existsSync(tempDir)) {
                    fs.mkdirSync(tempDir, { recursive: true });
                  }

                  const openPosPath = path.join(tempDir, 'open_positions.xlsx');
                  const pendingOrdersPath = path.join(
                    tempDir,
                    'pending_orders.xlsx',
                  );

                  const isSimulation =
                    process.env.SIMULATE_BOT_CHECKS === 'true';
                  if (
                    isSimulation &&
                    (!fs.existsSync(openPosPath) ||
                      !fs.existsSync(pendingOrdersPath))
                  ) {
                    const mockDir = path.dirname(openPosPath);
                    if (!fs.existsSync(mockDir)) {
                      fs.mkdirSync(mockDir, { recursive: true });
                    }

                    // Generate mock open_positions
                    const opWorkbook = XLSX.utils.book_new();
                    const opRows = [
                      [
                        'STT',
                        'Mã thành viên',
                        'Tên thành viên',
                        'Số HĐ',
                        'Tên khách hàng',
                        'SĐT',
                        'Email',
                        'Mã TKGD',
                        'Tên tài khoản',
                        'Mã HĐ',
                        'Tên hợp đồng',
                        'KL Mua',
                        'KL Bán',
                        'Giá khớp',
                        'Giá TT',
                        'Ký quỹ y/c',
                        'Lãi lỗ thực tế',
                        'Lãi lỗ ròng',
                      ],
                      [
                        1,
                        '003',
                        'Gia Cát Lợi',
                        '003001',
                        'Nguyễn Văn A',
                        '',
                        '',
                        '003C111111',
                        'Nguyễn Văn A',
                        'TRUN26',
                        'Cao su RSS3 7/26',
                        5,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                      ],
                      [
                        2,
                        '003',
                        'Gia Cát Lợi',
                        '003002',
                        'Trần Thị B',
                        '',
                        '',
                        '003C222222',
                        'Trần Thị B',
                        'ZFTQ26',
                        'Cao su TSR20 8/26',
                        0,
                        10,
                        0,
                        0,
                        0,
                        0,
                        0,
                      ],
                    ];
                    const opSheet = XLSX.utils.aoa_to_sheet(opRows);
                    XLSX.utils.book_append_sheet(opWorkbook, opSheet, 'Sheet1');
                    XLSX.writeFile(opWorkbook, openPosPath);

                    // Generate mock pending_orders
                    const poWorkbook = XLSX.utils.book_new();
                    const poRows = [
                      [
                        'STT',
                        'Mã lệnh',
                        'Mã TV',
                        'Mã TKGD',
                        'Mã ĐV',
                        'Mã HĐ',
                        'Mã hàng hóa',
                        'Kỳ hạn',
                        'Lệnh',
                        'Chiều mua bán',
                        'KL đặt lệnh',
                        'KL khớp',
                        'Giá giới hạn',
                        'Trạng thái',
                      ],
                      [
                        1,
                        'L001',
                        '003',
                        '003C111111',
                        '003',
                        'TRUN26',
                        'TRU',
                        '7/26',
                        'LMT',
                        'BUY',
                        2,
                        0,
                        100,
                        'Đang chờ khớp',
                      ],
                      [
                        2,
                        'L002',
                        '003',
                        '003C222222',
                        '003',
                        'ZFTQ26',
                        'ZFT',
                        '8/26',
                        'LMT',
                        'SELL',
                        3,
                        0,
                        200,
                        'Đang chờ khớp',
                      ],
                    ];
                    const poSheet = XLSX.utils.aoa_to_sheet(poRows);
                    XLSX.utils.book_append_sheet(poWorkbook, poSheet, 'Sheet1');
                    XLSX.writeFile(poWorkbook, pendingOrdersPath);

                    this.logger.log(
                      `Generated simulated open_positions.xlsx and pending_orders.xlsx files at: ${mockDir}`,
                    );
                  }

                  // If files do not exist and not in simulation, use RPA to download them
                  if (
                    !isSimulation &&
                    (!fs.existsSync(openPosPath) ||
                      !fs.existsSync(pendingOrdersPath))
                  ) {
                    this.logger.log(
                      'M-System reports not found locally. Triggering Playwright RPA download...',
                    );
                    const { browser, page } =
                      await this.rpaDownloaderService.loginMSystem(tempDir);
                    try {
                      if (!fs.existsSync(openPosPath)) {
                        this.logger.log(
                          'Downloading Trạng thái mở (open_positions.xlsx)...',
                        );
                        await this.rpaDownloaderService.downloadTTM(
                          page,
                          openPosPath,
                        );
                      }
                      if (!fs.existsSync(pendingOrdersPath)) {
                        this.logger.log(
                          'Downloading Lệnh chờ khớp (pending_orders.xlsx)...',
                        );
                        await this.rpaDownloaderService.downloadDSLCK(
                          page,
                          pendingOrdersPath,
                        );
                      }
                    } finally {
                      await browser.close().catch(() => { });
                    }
                  }

                  if (
                    !fs.existsSync(openPosPath) ||
                    !fs.existsSync(pendingOrdersPath)
                  ) {
                    checkResult = {
                      success: false,
                      message:
                        'Thiếu file báo cáo open_positions.xlsx hoặc pending_orders.xlsx để đối chiếu vị thế.',
                    };
                  } else {
                    const openPosBuffer = fs.readFileSync(openPosPath);
                    const pendingOrdersBuffer =
                      fs.readFileSync(pendingOrdersPath);

                    const res =
                      await this.teamsNotifierService.checkMaturityAndNotifyFromMSystem(
                        openPosBuffer,
                        pendingOrdersBuffer,
                        expiringContracts,
                        'Bot NOTIFY_MATURITY task',
                      );
                    checkResult = res;
                  }
                }
              }
            } catch (err: any) {
              checkResult = {
                success: false,
                message: `Lỗi tính mốc đáo hạn & gửi thông báo: ${err.message}`,
              };
            }
          }

          // 6. Handle verification outcomes
          if (checkResult.success) {
            this.logger.log(
              `[Bot] Task [${task.taskId}] check PASSED: ${checkResult.message}`,
            );
            try {
              await this.shiftsService.updateTaskStatus(
                log._id.toString(),
                task.taskId,
                'PASSED',
                systemUser,
                checkResult.message,
                true,
              );
            } catch (updateErr: any) {
              // Dependency not yet satisfied — skip silently, bot will retry next cycle
              this.logger.warn(
                `[Bot] Task [${task.taskId}] PASSED check but skipped update: ${updateErr.message}`,
              );
            }
          } else {
            // Check for SLA deadline breach
            let isOverdue = false;

            const checkTimeOverdue = (
              sla: string | null | undefined,
              trigger: string | null | undefined,
            ): boolean => {
              if (!sla) return false;
              if (sla.includes(':')) {
                const [slaH, slaM] = sla.split(':').map(Number);
                const currH = nowVN.getUTCHours();
                const currM = nowVN.getUTCMinutes();
                return currH > slaH || (currH === slaH && currM >= slaM);
              } else {
                // Relative SLA (minutes from trigger time)
                const trig = trigger || '00:00';
                const [trigH, trigM] = trig.split(':').map(Number);
                const triggerDate = new Date(nowVN);
                triggerDate.setUTCHours(trigH, trigM, 0, 0);

                const durationMinutes = parseInt(sla, 10) || 15;
                const overdueTime =
                  triggerDate.getTime() + durationMinutes * 60 * 1000;
                return nowVN.getTime() >= overdueTime;
              }
            };

            // 1. Kiểm tra trễ hạn của tác vụ con
            const isSubtaskOverdue = checkTimeOverdue(
              task.slaDeadlineSnapshot,
              task.botTriggerTimeSnapshot,
            );

            // 2. Kiểm tra trễ hạn của tác vụ cha (nếu có)
            let isParentOverdue = false;
            if (task.parentTaskIdSnapshot) {
              const parentTask = log.details.find(
                (d) => d.taskId === task.parentTaskIdSnapshot,
              );
              if (parentTask) {
                isParentOverdue = checkTimeOverdue(
                  parentTask.slaDeadlineSnapshot,
                  parentTask.botTriggerTimeSnapshot,
                );
              }
            }

            // Quá hạn nếu tác vụ con quá hạn HOẶC tác vụ cha đã quá hạn
            isOverdue = isSubtaskOverdue || isParentOverdue;

            if (isOverdue || (checkResult as any).forceFailed) {
              this.logger.warn(
                `[Bot] Task [${task.taskId}] failed immediately or breached SLA. Transitioning to FAILED state.`,
              );
              try {
                await this.shiftsService.updateTaskStatus(
                  log._id.toString(),
                  task.taskId,
                  'FAILED',
                  systemUser,
                  (checkResult as any).forceFailed
                    ? checkResult.message
                    : `[BOT TRỄ SLA] Kiểm tra tự động thất bại: ${checkResult.message}`,
                  true,
                );
              } catch (updateErr: any) {
                this.logger.warn(
                  `[Bot] Task [${task.taskId}] FAILED transition skipped: ${updateErr.message}`,
                );
              }
            } else {
              // Update status note with retry logs
              const formattedTime = nowVN
                .toISOString()
                .replace('T', ' ')
                .substring(0, 19);
              await this.shiftsService.updateTaskStatus(
                log._id.toString(),
                task.taskId,
                'WAITING',
                systemUser,
                checkResult.message.startsWith('{')
                  ? checkResult.message
                  : `[Quét tự động lúc ${formattedTime}]: ${checkResult.message}`,
                true,
              );
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Error executing bot checklist loop: ${err.message}`,
        err.stack,
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Parse HTML email body to extract list of expiring contracts and details
   */
  public parseMaturityEmail(htmlBody: string): ExpiringContract[] {
    const contracts: ExpiringContract[] = [];
    try {
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;

      trRegex.lastIndex = 0;
      tdRegex.lastIndex = 0;
      thRegex.lastIndex = 0;

      const parts = htmlBody.split(/<table[^>]*>/gi);
      for (let i = 1; i < parts.length; i++) {
        const precedingText = parts[i - 1].toLowerCase();
        const tableContent = parts[i].split(/<\/table>/gi)[0];

        let side: 'BUY' | 'SELL' = 'BUY';
        if (
          precedingText.includes('bán') ||
          precedingText.includes('ngày giao dịch cuối cùng')
        ) {
          side = 'SELL';
        }

        const rows: string[] = [];
        let match;
        while ((match = trRegex.exec(tableContent)) !== null) {
          rows.push(match[1]);
        }

        if (rows.length === 0) continue;
        const headerCols: string[] = [];
        let thMatch;
        const headerRow = rows[0];
        while ((thMatch = thRegex.exec(headerRow)) !== null) {
          headerCols.push(
            thMatch[1]
              .replace(/<[^>]*>/g, '')
              .trim()
              .toLowerCase(),
          );
        }
        if (headerCols.length === 0) {
          let tdMatch;
          while ((tdMatch = tdRegex.exec(headerRow)) !== null) {
            headerCols.push(
              tdMatch[1]
                .replace(/<[^>]*>/g, '')
                .trim()
                .toLowerCase(),
            );
          }
        }

        const contractCodeIdx = headerCols.findIndex(
          (h) =>
            h.includes('mã hợp đồng') ||
            h.includes('mã hđ') ||
            h.includes('contract'),
        );
        const contractNameIdx = headerCols.findIndex(
          (h) => h.includes('tên hợp đồng') || h.includes('name'),
        );
        const targetDateIdx = headerCols.findIndex(
          (h) =>
            h.includes('ngày thông báo') ||
            h.includes('ngày giao dịch') ||
            h.includes('date'),
        );
        const deadlineIdx = headerCols.findIndex(
          (h) =>
            h.includes('thời gian') ||
            h.includes('hạn tất toán') ||
            h.includes('deadline') ||
            h.includes('trước'),
        );

        for (let r = 1; r < rows.length; r++) {
          const cells: string[] = [];
          let tdMatch;
          tdRegex.lastIndex = 0;
          while ((tdMatch = tdRegex.exec(rows[r])) !== null) {
            cells.push(tdMatch[1].replace(/<[^>]*>/g, '').trim());
          }

          if (cells.length > 0) {
            const contractCode =
              cells[contractCodeIdx !== -1 ? contractCodeIdx : 1] || '';
            const contractName =
              cells[contractNameIdx !== -1 ? contractNameIdx : 2] || '';
            const targetDate =
              cells[targetDateIdx !== -1 ? targetDateIdx : 3] || '';
            const deadline = cells[deadlineIdx !== -1 ? deadlineIdx : 4] || '';

            if (contractCode && contractCode !== 'Mã Hợp đồng') {
              contracts.push({
                contractCode: contractCode.trim(),
                contractName: contractName.trim(),
                targetDate: targetDate.trim(),
                deadline: deadline.trim(),
                side,
              });
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Error parsing maturity email HTML: ${err.message}`);
    }
    return contracts;
  }

  /**
   * Parse plain text email body to extract list of expiring contracts and details
   */
  public parseEmailText(content: string): ExpiringContract[] {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const contracts: ExpiringContract[] = [];
    let currentSide: 'BUY' | 'SELL' = 'BUY';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        line.includes('Đối với Vị thế mở mua') ||
        line.includes('Ngày thông báo đầu tiên')
      ) {
        currentSide = 'BUY';
        continue;
      }
      if (
        line.includes('Đối với Vị thế mở bán') ||
        line.includes('Ngày giao dịch cuối cùng')
      ) {
        currentSide = 'SELL';
        continue;
      }

      // A contract row starts with STT (digit) followed by contract code
      if (/^\d+$/.test(line) && i + 4 < lines.length) {
        const contractCode = lines[i + 1];
        const contractName = lines[i + 2];
        const targetDate = lines[i + 3];
        const deadline = lines[i + 4];

        if (/^[A-Z0-9]{4,10}$/.test(contractCode) && targetDate.includes('/')) {
          contracts.push({
            contractCode,
            contractName,
            targetDate,
            deadline,
            side: currentSide,
          });
          i += 4;
        }
      }
    }

    return contracts;
  }
}
