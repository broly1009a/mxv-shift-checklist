import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { BotJobQueueService } from '../../checklist-hub/queue/bot-job-queue.service';

@Controller(['api/v1/trading-ops', 'api/v1/bot-engine'])
@UseGuards(JwtAuthGuard)
export class MacroExecutionController {
  private readonly logger = new Logger(MacroExecutionController.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly jobQueueService: BotJobQueueService,
  ) {}

  /**
   * Lấy cấu hình chạy Excel Macro thống kê số lot.
   */
  @Get('macro-lot/config')
  async getMacroLotConfig() {
    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(
          process.cwd(),
          'marco',
          'Thong ke so lot giao dich có ACM',
          'Macro thong ke so lot giao dich có ACM.xlsm',
        )
      : path.join(
          process.cwd(),
          '..',
          'marco',
          'Thong ke so lot giao dich có ACM',
          'Macro thong ke so lot giao dich có ACM.xlsm',
        );

    const macroPath = await this.settingsService.getSetting(
      'bot_macro_lot_path',
      defaultMacroPath,
    );
    const backupMs = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      '',
    );
    const backupCqg = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      '',
    );
    const defaultScriptPath = (() => {
      const relPath = path.join(
        process.cwd(),
        '..',
        'POC',
        'scripts',
        'run_lot_macro.py',
      );
      const relPath2 = path.join(process.cwd(), 'scripts', 'run_lot_macro.py');
      if (fs.existsSync(relPath)) return relPath;
      if (fs.existsSync(relPath2)) return relPath2;
      return path.join('C:', 'POC', 'scripts', 'run_lot_macro.py');
    })();

    const pythonExe = await this.settingsService.getSetting(
      'bot_python_path',
      'python',
    );
    const scriptPath = await this.settingsService.getSetting(
      'bot_lot_script_path',
      defaultScriptPath,
    );
    const targetRoot = await this.settingsService.getSetting(
      'bot_lot_macro_target_root',
      'M:\\Quanlygiaodich\\Tai lieu hoat dong',
    );
    return {
      macroPath,
      backupMs,
      backupCqg,
      pythonExe,
      scriptPath,
      targetRoot,
    };
  }

  /**
   * Lưu cấu hình Excel Macro thống kê số lot.
   */
  @Post('macro-lot/config')
  async saveMacroLotConfig(
    @Body('macroPath') macroPath?: string,
    @Body('scriptPath') scriptPath?: string,
    @Body('pythonExe') pythonExe?: string,
    @Body('targetRoot') targetRoot?: string,
  ) {
    if (macroPath !== undefined) {
      await this.settingsService.setSetting(
        'bot_macro_lot_path',
        macroPath.trim(),
      );
    }
    if (scriptPath !== undefined) {
      await this.settingsService.setSetting(
        'bot_lot_script_path',
        scriptPath.trim(),
      );
    }
    if (pythonExe !== undefined) {
      await this.settingsService.setSetting(
        'bot_python_path',
        pythonExe.trim(),
      );
    }
    if (targetRoot !== undefined) {
      await this.settingsService.setSetting(
        'bot_lot_macro_target_root',
        targetRoot.trim(),
      );
    }
    return {
      success: true,
      message: 'Đã cập nhật cấu hình chạy Excel Macro thống kê số lot.',
    };
  }

  /**
   * Kích hoạt job chạy Excel Macro thống kê số lot.
   */
  @Post('trigger-lot-macro')
  async triggerLotMacro(@Body('targetDate') targetDateStr?: string) {
    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(
          process.cwd(),
          'marco',
          'Thong ke so lot giao dich có ACM',
          'Macro thong ke so lot giao dich có ACM.xlsm',
        )
      : path.join(
          process.cwd(),
          '..',
          'marco',
          'Thong ke so lot giao dich có ACM',
          'Macro thong ke so lot giao dich có ACM.xlsm',
        );

    const macroPath = await this.settingsService.getSetting(
      'bot_macro_lot_path',
      defaultMacroPath,
    );
    const backupPathMs = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      '',
    );
    const backupPathCqg = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      '',
    );
    const pythonExe = await this.settingsService.getSetting(
      'bot_python_path',
      'python',
    );
    const targetRoot = await this.settingsService.getSetting(
      'bot_lot_macro_target_root',
      'M:\\Quanlygiaodich\\Tai lieu hoat dong',
    );

    const defaultScriptPath = (() => {
      const relPath = path.join(
        process.cwd(),
        '..',
        'POC',
        'scripts',
        'run_lot_macro.py',
      );
      const relPath2 = path.join(process.cwd(), 'scripts', 'run_lot_macro.py');
      if (fs.existsSync(relPath)) return relPath;
      if (fs.existsSync(relPath2)) return relPath2;
      return path.join('C:', 'POC', 'scripts', 'run_lot_macro.py');
    })();
    const scriptPath = await this.settingsService.getSetting(
      'bot_lot_script_path',
      defaultScriptPath,
    );

    let targetDate = new Date();
    if (targetDateStr) {
      targetDate = new Date(targetDateStr);
    }
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    const job = await this.jobQueueService.enqueue('RUN_LOT_MACRO', {
      targetDate: formattedDate,
      macroPath,
      scriptPath,
      backupPathMs,
      backupPathCqg,
      targetRoot,
      pythonExe,
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu chạy Excel Macro thống kê số lot vào hàng đợi.',
      jobId: job._id,
    };
  }

  // =========================================================================
  // MACRO VALUE CONSOLIDATION ENDPOINTS
  // =========================================================================

  /**
   * Lấy cấu hình chạy Excel Macro thống kê giá trị.
   */
  @Get('macro-value/config')
  async getMacroValueConfig() {
    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(
          process.cwd(),
          'marco',
          'Thong ke gia tri giao dich có ACM',
          'Macro thong ke gia tri giao dich có ACM.xlsm',
        )
      : path.join(
          process.cwd(),
          '..',
          'marco',
          'Thong ke gia tri giao dich có ACM',
          'Macro thong ke gia tri giao dich có ACM.xlsm',
        );

    const defaultScriptPath = (() => {
      const relPath = path.join(
        process.cwd(),
        '..',
        'POC',
        'scripts',
        'run_value_macro.py',
      );
      const relPath2 = path.join(
        process.cwd(),
        'scripts',
        'run_value_macro.py',
      );
      if (fs.existsSync(relPath)) return relPath;
      if (fs.existsSync(relPath2)) return relPath2;
      return path.join('C:', 'POC', 'scripts', 'run_value_macro.py');
    })();

    const macroPath = await this.settingsService.getSetting(
      'bot_macro_value_path',
      defaultMacroPath,
    );
    const scriptPath = await this.settingsService.getSetting(
      'bot_value_script_path',
      defaultScriptPath,
    );
    const pythonExe = await this.settingsService.getSetting(
      'bot_python_path',
      'python',
    );
    return { macroPath, scriptPath, pythonExe };
  }

  /**
   * Lưu cấu hình Excel Macro thống kê giá trị.
   */
  @Post('macro-value/config')
  async saveMacroValueConfig(
    @Body('macroPath') macroPath?: string,
    @Body('scriptPath') scriptPath?: string,
    @Body('pythonExe') pythonExe?: string,
  ) {
    if (macroPath !== undefined) {
      await this.settingsService.setSetting(
        'bot_macro_value_path',
        macroPath.trim(),
      );
    }
    if (scriptPath !== undefined) {
      await this.settingsService.setSetting(
        'bot_value_script_path',
        scriptPath.trim(),
      );
    }
    if (pythonExe !== undefined) {
      await this.settingsService.setSetting(
        'bot_python_path',
        pythonExe.trim(),
      );
    }
    return {
      success: true,
      message: 'Đã cập nhật cấu hình chạy Excel Macro thống kê giá trị.',
    };
  }

  /**
   * Kích hoạt job chạy Excel Macro thống kê giá trị.
   */
  @Post('trigger-value-macro')
  async triggerValueMacro(@Body('targetDate') targetDateStr?: string) {
    const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
      ? path.join(
          process.cwd(),
          'marco',
          'Thong ke gia tri giao dich có ACM',
          'Macro thong ke gia tri giao dich có ACM.xlsm',
        )
      : path.join(
          process.cwd(),
          '..',
          'marco',
          'Thong ke gia tri giao dich có ACM',
          'Macro thong ke gia tri giao dich có ACM.xlsm',
        );

    const macroPath = await this.settingsService.getSetting(
      'bot_macro_value_path',
      defaultMacroPath,
    );

    const defaultScriptPath = (() => {
      const relPath = path.join(
        process.cwd(),
        '..',
        'POC',
        'scripts',
        'run_value_macro.py',
      );
      const relPath2 = path.join(
        process.cwd(),
        'scripts',
        'run_value_macro.py',
      );
      if (fs.existsSync(relPath)) return relPath;
      if (fs.existsSync(relPath2)) return relPath2;
      return path.join('C:', 'POC', 'scripts', 'run_value_macro.py');
    })();

    const scriptPath = await this.settingsService.getSetting(
      'bot_value_script_path',
      defaultScriptPath,
    );
    const pythonExe = await this.settingsService.getSetting(
      'bot_python_path',
      'python',
    );

    let targetDate = new Date();
    if (targetDateStr) {
      targetDate = new Date(targetDateStr);
    }
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;

    const job = await this.jobQueueService.enqueue('RUN_VALUE_MACRO', {
      targetDate: formattedDate,
      macroPath,
      scriptPath,
      pythonExe,
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu chạy Excel Macro thống kê giá trị vào hàng đợi.',
      jobId: job._id,
    };
  }
}
