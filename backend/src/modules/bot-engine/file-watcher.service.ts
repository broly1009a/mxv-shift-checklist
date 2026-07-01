import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FileWatcherService {
  private readonly logger = new Logger(FileWatcherService.name);

  /**
   * Check if file condition is met for a given task configuration.
   */
  async checkFileTask(fileLocation: string, condition: string): Promise<{ success: boolean; message: string }> {
    // 1. Resolve dynamic date parameters in file path
    const resolvedPath = this.resolveDatePlaceholders(fileLocation);

    const isSimulation = process.env.SIMULATE_BOT_CHECKS === 'true' || !path.isAbsolute(resolvedPath);

    if (isSimulation) {
      this.logger.debug(`[Simulation] Checking mock file path: "${resolvedPath}"`);
      return this.checkMockFile(resolvedPath, condition);
    }

    try {
      // 2. Check local or network shared file existence
      if (!fs.existsSync(resolvedPath)) {
        return {
          success: false,
          message: `Không tìm thấy tệp tin tại đường dẫn: ${resolvedPath}`,
        };
      }

      const stats = fs.statSync(resolvedPath);
      
      // 3. Parse condition parameters (e.g. minSizeKb, containsKeyword)
      let minSizeKb = 0;
      let containsKeyword = '';
      try {
        const parsedCondition = JSON.parse(condition);
        minSizeKb = parsedCondition.minSizeKb || 0;
        containsKeyword = parsedCondition.containsKeyword || '';
      } catch {
        // Fallback: If condition is a number, treat it as minSizeKb
        const parsedNum = parseFloat(condition);
        if (!isNaN(parsedNum)) {
          minSizeKb = parsedNum;
        } else {
          containsKeyword = condition;
        }
      }

      // 4. Validate file size
      const fileSizeKb = stats.size / 1024;
      if (fileSizeKb < minSizeKb) {
        return {
          success: false,
          message: `Tệp tồn tại nhưng kích thước quá nhỏ: ${fileSizeKb.toFixed(2)} KB (Yêu cầu tối thiểu: ${minSizeKb} KB)`,
        };
      }

      // 5. Optionally inspect content for keyword
      if (containsKeyword && stats.size < 10 * 1024 * 1024) { // Only read files smaller than 10MB to avoid memory leaks
        const content = fs.readFileSync(resolvedPath, 'utf8');
        if (!content.toLowerCase().includes(containsKeyword.toLowerCase())) {
          return {
            success: false,
            message: `Tệp tồn tại nhưng không chứa từ khóa yêu cầu: "${containsKeyword}"`,
          };
        }
      }

      return {
        success: true,
        message: `Tệp tin hợp lệ tại: ${resolvedPath} (${fileSizeKb.toFixed(2)} KB)`,
      };
    } catch (error: any) {
      this.logger.error(`Error in FileWatcherService: ${error.message}`);
      return {
        success: false,
        message: `Lỗi kiểm tra tệp tin: ${error.message}`,
      };
    }
  }

  /**
   * Resolve templates like ${yyyy}, ${mm}, ${dd}, ${yesterday_yyyy}, ${yesterday_mm}, ${yesterday_dd}
   */
  private resolveDatePlaceholders(templatePath: string): string {
    const now = new Date();
    // Get Vietnam time (GMT+7) date parts
    const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const yesterday = new Date(vietnamTime.getTime() - 24 * 60 * 60 * 1000);

    const pad = (num: number) => num.toString().padStart(2, '0');

    const dateMap: Record<string, string> = {
      '\\${yyyy}': vietnamTime.getFullYear().toString(),
      '\\${mm}': pad(vietnamTime.getMonth() + 1),
      '\\${dd}': pad(vietnamTime.getDate()),
      '\\${yesterday_yyyy}': yesterday.getFullYear().toString(),
      '\\${yesterday_mm}': pad(yesterday.getMonth() + 1),
      '\\${yesterday_dd}': pad(yesterday.getDate()),
    };

    let resolved = templatePath;
    for (const [placeholder, value] of Object.entries(dateMap)) {
      resolved = resolved.replace(new RegExp(placeholder, 'g'), value);
    }
    return resolved;
  }

  /**
   * Helper to check mock file from mock data file.
   */
  private checkMockFile(filePath: string, condition: string): { success: boolean; message: string } {
    const mockFilePath = path.join(__dirname, 'mock-files.json');
    if (!fs.existsSync(mockFilePath)) {
      // Create default mock files catalog
      const defaultMock = [
        {
          filePath: '\\\\shared-folder\\backup\\EOD_TTM.csv',
          sizeBytes: 15240,
          content: 'EOD processing SUCCESS. All volume reconciled.',
        },
        {
          filePath: 'C:\\Backup\\CQG\\Report.xlsx',
          sizeBytes: 1048576,
          content: 'CQG transaction backup EOD',
        }
      ];
      fs.writeFileSync(mockFilePath, JSON.stringify(defaultMock, null, 2), 'utf8');
    }

    try {
      const mockFiles = JSON.parse(fs.readFileSync(mockFilePath, 'utf8'));
      // Resolve name comparison by checking if target path ends with or contains the file name
      const targetBase = path.basename(filePath).toLowerCase();

      // Look for a matching mock file record
      const match = mockFiles.find((f: any) => {
        const mockBase = path.basename(f.filePath).toLowerCase();
        return mockBase === targetBase || f.filePath.toLowerCase().includes(targetBase) || filePath.toLowerCase().includes(mockBase);
      });

      if (match) {
        let minSizeKb = 0;
        let containsKeyword = '';
        try {
          const parsedCondition = JSON.parse(condition);
          minSizeKb = parsedCondition.minSizeKb || 0;
          containsKeyword = parsedCondition.containsKeyword || '';
        } catch {
          const parsedNum = parseFloat(condition);
          if (!isNaN(parsedNum)) minSizeKb = parsedNum;
          else containsKeyword = condition;
        }

        const sizeKb = match.sizeBytes / 1024;
        if (sizeKb < minSizeKb) {
          return {
            success: false,
            message: `[Mô Phỏng] Tệp khớp nhưng kích thước nhỏ hơn yêu cầu: ${sizeKb.toFixed(2)} KB < ${minSizeKb} KB`,
          };
        }

        if (containsKeyword && !match.content.toLowerCase().includes(containsKeyword.toLowerCase())) {
          return {
            success: false,
            message: `[Mô Phỏng] Tệp không chứa từ khóa yêu cầu: "${containsKeyword}"`,
          };
        }

        return {
          success: true,
          message: `[Mô Phỏng] Tệp hợp lệ: "${match.filePath}" (${sizeKb.toFixed(2)} KB)`,
        };
      }
    } catch (err: any) {
      this.logger.error(`Failed to parse mock files file: ${err.message}`);
    }

    return {
      success: false,
      message: `[Mô Phỏng] Không tìm thấy mock file khớp cho: "${filePath}"`,
    };
  }
}
