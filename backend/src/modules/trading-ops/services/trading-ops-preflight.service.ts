import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { resolveStoragePathCrossPlatform } from '../../../shared';
import {
  resolveCcpAccumulatorFilePath,
  checkDateExistsInAccumulator,
} from '../helpers/ccp-accumulator.helper';
import {
  TRADING_OPS_PREFLIGHT_REGISTRY,
  getPreflightTaskDefinition,
  getAllPreflightTasks,
  TradingOpsTaskPreflightDefinition,
} from '../constants/trading-ops-preflight.registry';
import { findMatchingTradingFile } from '../constants/trading-file-patterns.constant';

export interface PreflightInspectionOptions {
  taskKey: string;
  dateStr: string; // YYYY-MM-DD
  filterScope?: 'LOT' | 'VALUE' | 'ALL';
}

@Injectable()
export class TradingOpsPreflightService {
  private readonly logger = new Logger(TradingOpsPreflightService.name);

  constructor(private readonly settingsService: SystemSettingsService) {}

  /**
   * Lấy danh sách tất cả các tác vụ hỗ trợ kiểm tra trước khi chạy
   */
  getRegisteredTasks(): TradingOpsTaskPreflightDefinition[] {
    return getAllPreflightTasks();
  }

  /**
   * Định dạng kích thước byte sang chuỗi thân thiện người dùng
   */
  private formatBytes(bytes?: number): string {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  /**
   * Lấy đường dẫn thư mục sao lưu ngày theo phân hệ (CCP, CE, MS, CQG)
   */
  private async resolveDailyBackupFolder(
    category: 'CCP' | 'CE' | 'MS' | 'CQG' | 'COMMON',
    dateStr: string,
  ): Promise<{ resolvedPath: string; exists: boolean; candidatePaths: string[] }> {
    const [year, month, day] = dateStr.split('-');
    const subFolderDot = `${day}.${month}`; // VD: "22.10"
    const subFolderFull = `${day}.${month}.${year}`; // VD: "22.10.2026"
    const subFolderDash = `${year}-${month}-${day}`; // VD: "2026-10-22"

    let baseSettingKey = 'backup_path_ccp';
    let defaultMount = 'M:\\Trading\\Trading\\2026\\Backup hang ngay';

    if (category === 'CE') {
      baseSettingKey = 'ce_backup_path';
      defaultMount = 'M:\\Trading\\Trading\\2026\\Backup hang ngay ACM';
    } else if (category === 'MS') {
      baseSettingKey = 'ms_backup_path';
      defaultMount = 'M:\\Trading\\Trading\\2026\\Backup M-System';
    } else if (category === 'CQG') {
      baseSettingKey = 'cqg_backup_path';
      defaultMount = 'M:\\Trading\\Trading\\2026\\Backup CQG';
    }

    const configuredRoot = await this.settingsService.getSetting(baseSettingKey, defaultMount);
    const resolvedRoot = resolveStoragePathCrossPlatform(configuredRoot);

    const candidates = [
      path.join(resolvedRoot, subFolderDot),
      path.join(resolvedRoot, subFolderFull),
      path.join(resolvedRoot, subFolderDash),
      path.join(resolvedRoot, dateStr),
      path.join(resolvedRoot, `${subFolderDot} ACM`),
      path.join(resolvedRoot, `${subFolderDot} CoreCCP`),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return { resolvedPath: cand, exists: true, candidatePaths: candidates };
      }
    }

    return {
      resolvedPath: candidates[0],
      exists: false,
      candidatePaths: candidates,
    };
  }

  /**
   * Quét tỷ giá USD/VND hiện hành từ DB cấu hình hoặc mặc định
   */
  private async getUsdExchangeRate(): Promise<number> {
    const raw = await this.settingsService.getSetting('exchange_rate_usd', '25920');
    const parsed = parseFloat(String(raw).replace(/,/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 25920;
  }

  /**
   * Thực thi kiểm tra Pre-Flight tập trung cho một tác vụ bất kỳ
   */
  async inspect(options: PreflightInspectionOptions): Promise<any> {
    const { taskKey, dateStr, filterScope = 'ALL' } = options;
    const taskDef = getPreflightTaskDefinition(taskKey);

    if (!taskDef) {
      throw new NotFoundException(
        `Không tìm thấy định nghĩa tác vụ "${taskKey}" trong TRADING_OPS_PREFLIGHT_REGISTRY.`,
      );
    }

    // 1. Kiểm tra trạng thái BẬT/TẮT (ENABLED / OFF) của tác vụ
    let isTaskEnabled = taskDef.enabled;
    if (taskDef.toggleSettingKey) {
      const toggleVal = await this.settingsService.getSetting(taskDef.toggleSettingKey, 'ON');
      const norm = String(toggleVal).trim().toUpperCase();
      if (norm === 'OFF' || norm === '0' || norm === 'FALSE' || norm === 'DISABLED') {
        isTaskEnabled = false;
      }
    }

    if (!isTaskEnabled) {
      return {
        taskKey: taskDef.taskKey,
        displayName: taskDef.displayName,
        category: taskDef.category,
        date: dateStr,
        enabled: false,
        status: 'DISABLED',
        isReady: false,
        canExecute: false,
        summaryBadge: {
          variant: 'muted',
          label: 'Tác vụ đang TẮT (OFF)',
          description: `Tác vụ "${taskDef.displayName}" hiện đang tắt trong cấu hình hệ thống. Các kiểm tra tệp được bỏ qua.`,
        },
        warnings: [
          `Tác vụ ${taskDef.displayName} đang được cấu hình TẮT (enabled: false). Để kích hoạt, vui lòng bật lại trong TRADING_OPS_PREFLIGHT_REGISTRY hoặc cài đặt hệ thống.`,
        ],
        recommendations: [
          'Nếu cần sử dụng tác vụ này, hãy liên hệ Quản trị viên kích hoạt lại.',
        ],
        sourceFiles: [],
        destinations: [],
      };
    }

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // 2. Quét kiểm tra các File Nguồn Đầu Vào (Input Files)
    const categoryFolderCache: Record<string, { resolvedPath: string; exists: boolean }> = {};
    const sourceFiles: any[] = [];

    for (const fileSpec of taskDef.inputFiles) {
      if (fileSpec.enabled === false) {
        continue; // File này bị tắt
      }

      const cat = fileSpec.sourceCategory;
      if (!categoryFolderCache[cat]) {
        categoryFolderCache[cat] = await this.resolveDailyBackupFolder(cat, dateStr);
      }
      const folderInfo = categoryFolderCache[cat];

      let found = false;
      let filename = '';
      let fullPath = '';
      let sizeBytes = 0;

      if (folderInfo.exists) {
        const matched = findMatchingTradingFile(folderInfo.resolvedPath, fileSpec.patterns);
        if (matched) {
          found = true;
          filename = matched.filename;
          fullPath = matched.fullPath;
          sizeBytes = matched.size;
        }
      }

      let status: 'READY' | 'MISSING' | 'OPTIONAL_MISSING' = 'READY';
      let statusText = `Sẵn sàng (${this.formatBytes(sizeBytes)})`;

      if (!found) {
        if (fileSpec.required) {
          status = 'MISSING';
          statusText = `Chưa có tệp ${fileSpec.name} trong thư mục ngày`;
          warnings.push(`Thiếu tệp bắt buộc: "${fileSpec.name}" tại ${folderInfo.resolvedPath}`);
        } else {
          status = 'OPTIONAL_MISSING';
          statusText = 'Không bắt buộc (có thể bỏ qua)';
        }
      }

      sourceFiles.push({
        key: fileSpec.id,
        name: fileSpec.name,
        role: fileSpec.role,
        required: fileSpec.required,
        present: found,
        filename: filename || undefined,
        fullPath: fullPath || path.join(folderInfo.resolvedPath, `${fileSpec.id}.xlsx`),
        sizeBytes,
        formattedSize: this.formatBytes(sizeBytes),
        status,
        statusText,
      });
    }

    // 3. Quét kiểm tra các File Lũy Kế / Đầu Ra (Accumulator Files)
    const destinations: any[] = [];
    if (taskDef.accumulators && taskDef.accumulators.length > 0) {
      for (const accSpec of taskDef.accumulators) {
        if (accSpec.enabled === false) {
          continue; // Accumulator này bị tắt
        }

        // Kiểm tra lọc theo nhóm (LOT, VALUE, ALL)
        if (
          filterScope !== 'ALL' &&
          accSpec.group &&
          accSpec.group !== 'ALL' &&
          accSpec.group !== filterScope
        ) {
          continue;
        }

        const configuredPattern = await this.settingsService.getSetting(
          accSpec.settingKey,
          accSpec.defaultPattern,
        );

        if (!configuredPattern || !configuredPattern.trim()) {
          destinations.push({
            key: accSpec.key,
            label: accSpec.label,
            group: accSpec.group || 'ALL',
            configuredPattern: '',
            resolvedPath: '',
            existsOnDisk: false,
            parentDir: '',
            parentDirValid: false,
            dateAlreadyRecorded: false,
            status: 'UNCONFIGURED',
            statusText: 'Chưa cấu hình đường dẫn lưu file',
            recommendation: `Vào Cấu hình hệ thống để thiết lập đường dẫn cho: ${accSpec.label}`,
          });
          warnings.push(`Chưa cấu hình đường dẫn cho sổ lũy kế: ${accSpec.label}`);
          continue;
        }

        const resolvedPath = resolveCcpAccumulatorFilePath(configuredPattern);
        const parentDir = path.dirname(resolvedPath);
        const parentDirValid = fs.existsSync(parentDir);
        const existsOnDisk = fs.existsSync(resolvedPath);

        let sizeBytes = 0;
        let dateAlreadyRecorded = false;
        let existingTotal: number | undefined;

        if (existsOnDisk) {
          try {
            const st = fs.statSync(resolvedPath);
            sizeBytes = st.size;
          } catch {
            // Ignore stat error
          }

          if (accSpec.checkOverwriteRule === 'DATE_IN_SHEET') {
            try {
              const logs: string[] = [];
              const groupType: 'LOT' | 'GTGD' = accSpec.group === 'VALUE' ? 'GTGD' : 'LOT';
              const checkRes = await checkDateExistsInAccumulator(
                resolvedPath,
                dateStr,
                groupType,
                logs,
              );
              dateAlreadyRecorded = !!checkRes.hasExistingData;
              existingTotal = checkRes.existingTotal;
            } catch {
              // Ignore check error
            }
          }
        }

        let status: 'READY' | 'OVERWRITE_WARNING' | 'FOLDER_INVALID' | 'UNCONFIGURED' = 'READY';
        let statusText = 'Đường dẫn hợp lệ';
        let recommendation = 'Tệp đã sẵn sàng để ghi dữ liệu';

        if (!parentDirValid) {
          status = 'FOLDER_INVALID';
          statusText = 'Thư mục cha không tồn tại hoặc không thể truy cập';
          recommendation = `Đảm bảo ổ đĩa mạng (${parentDir}) đã được mount và máy chủ có quyền ghi.`;
          warnings.push(`Thư mục lưu ${accSpec.label} không tồn tại: ${parentDir}`);
        } else if (!existsOnDisk) {
          status = 'READY';
          statusText = 'Tệp chưa tạo (Sẽ tự động khởi tạo khi chạy)';
          recommendation = 'Hệ thống sẽ tự động tạo file mới theo mẫu chuẩn.';
        } else if (dateAlreadyRecorded) {
          status = 'OVERWRITE_WARNING';
          statusText = `Phiên ngày ${dateStr} đã có số liệu trong file (${existingTotal?.toLocaleString('vi-VN')} ${accSpec.group === 'VALUE' ? 'đ' : 'lot'})`;
          recommendation = 'Khi chạy sẽ ghi đè dữ liệu phiên cũ (có tự động sao lưu an toàn).';
        } else {
          status = 'READY';
          statusText = `Tệp đã tồn tại (${this.formatBytes(sizeBytes)}) - Sẵn sàng ghi thêm dòng mới`;
          recommendation = `Sẽ ghi nối tiếp dòng cho phiên ${dateStr}.`;
        }

        destinations.push({
          key: accSpec.key,
          label: accSpec.label,
          group: accSpec.group || 'ALL',
          configuredPattern,
          resolvedPath,
          existsOnDisk,
          parentDir,
          parentDirValid,
          dateAlreadyRecorded,
          existingTotal,
          sizeBytes,
          formattedSize: this.formatBytes(sizeBytes),
          status,
          statusText,
          recommendation,
        });
      }
    }

    // 4. Các kiểm tra bổ sung (Extra Checks)
    let extraData: Record<string, any> = {};
    if (taskDef.extraChecks?.includes('USD_EXCHANGE_RATE')) {
      const usdRate = await this.getUsdExchangeRate();
      extraData.usdExchangeRate = usdRate;
    }

    // 5. Đánh giá tính sẵn sàng tổng thể (Executive Readiness)
    const missingRequiredFiles = sourceFiles.filter((f) => f.required && !f.present);
    const invalidDestinations = destinations.filter((d) => !d.parentDirValid || d.status === 'UNCONFIGURED');
    const overwriteDestinations = destinations.filter((d) => d.dateAlreadyRecorded);

    const canExecute = missingRequiredFiles.length === 0 && invalidDestinations.length === 0;
    const isReady = canExecute && overwriteDestinations.length === 0;

    let summaryBadge = {
      variant: 'success',
      label: '100% Sẵn Sàng',
      description: 'Đầy đủ các tệp đầu vào bắt buộc và tất cả đường dẫn lưu file đều hợp lệ.',
    };

    if (!canExecute) {
      summaryBadge = {
        variant: 'danger',
        label: 'Chưa Thể Thực Thi',
        description: `Còn ${missingRequiredFiles.length} tệp đầu vào bắt buộc chưa có hoặc ${invalidDestinations.length} đường dẫn lưu file không hợp lệ.`,
      };
      if (missingRequiredFiles.length > 0) {
        recommendations.push(
          `Vui lòng kiểm tra quá trình sao lưu hoặc tải thủ công các tệp: ${missingRequiredFiles.map((f) => f.name).join(', ')}.`,
        );
      }
      if (invalidDestinations.length > 0) {
        recommendations.push(
          `Kiểm tra lại cấu hình đường dẫn và quyền truy cập thư mục cho: ${invalidDestinations.map((d) => d.label).join(', ')}.`,
        );
      }
    } else if (overwriteDestinations.length > 0) {
      summaryBadge = {
        variant: 'warning',
        label: 'Cảnh Báo Ghi Đè',
        description: `Phiên ngày ${dateStr} đã được ghi vào ${overwriteDestinations.length} tệp lũy kế trước đó. Thực thi sẽ cập nhật lại số liệu.`,
      };
      recommendations.push(
        'Nếu bạn muốn ghi đè phiên này, hệ thống sẽ tự động tạo bản sao lưu an toàn trong thư mục Backup_Snapshots/.',
      );
    }

    return {
      taskKey: taskDef.taskKey,
      displayName: taskDef.displayName,
      category: taskDef.category,
      date: dateStr,
      enabled: true,
      canExecute,
      isReady,
      summaryBadge,
      sourceFiles,
      destinations,
      warnings,
      recommendations,
      extraData,
    };
  }
}
