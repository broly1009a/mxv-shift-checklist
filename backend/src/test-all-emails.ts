import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ReconciliationService } from './modules/reconciliation/reconciliation.service';
import { MarginCheckerService } from './modules/margin-checker/margin-checker.service';
import { ShiftsService } from './modules/shifts/shifts.service';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';
import { BotJobQueueService } from './modules/bot-engine/bot-job-queue.service';
import { ShiftLog } from './schemas/shift-log.schema';
import * as fs from 'fs';
import * as path from 'path';

async function testAllEmails() {
  console.log('=== KHỞI ĐỘNG KIỂM THỬ TẤT CẢ EMAIL BÁO CÁO & CẢNH BÁO ===');

  const app = await NestFactory.createApplicationContext(AppModule);
  const reconciliationService = app.get(ReconciliationService);
  const marginCheckerService = app.get(MarginCheckerService);
  const shiftsService = app.get(ShiftsService);
  const settingsService = app.get(SystemSettingsService);
  const botJobQueueService = app.get(BotJobQueueService);

  const tempDir = path.join(process.cwd(), 'temp', 'email-previews');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // Intercept sendEmailNotification or nodemailer transporters to capture emails
  const capturedEmails: Record<
    string,
    { subject: string; body: string; to: string[] }
  > = {};

  // Mock sendEmailNotification
  marginCheckerService.sendEmailNotification = async (
    config: any,
    toEmails: string[],
    subject: string,
    htmlBody: string,
  ) => {
    let key = 'unknown';
    if (subject.includes('PRE-EOD')) key = 'pre-eod';
    else if (subject.includes('EOD BALANCE') || subject.includes('SOD'))
      key = 'eod-balance';
    else if (subject.includes('Negative Margin')) key = 'negative-margin';
    else if (subject.includes('HANDOVER')) key = 'shift-handover';

    capturedEmails[key] = { subject, body: htmlBody, to: toEmails };
    console.log(`[Email Intercepted] Subject: ${subject}`);
    return { success: true, messageId: `mock-id-${key}` };
  };

  // Mock global nodemailer sendMail if called directly via transporter
  const nodemailer = require('nodemailer');
  const originalCreateTransport = nodemailer.createTransport;
  nodemailer.createTransport = function (options: any) {
    return {
      sendMail: async (mailOptions: any) => {
        let key = 'unknown';
        const subject = mailOptions.subject || '';
        if (subject.includes('FAILURE ALERT')) key = 'bot-failure';
        else if (subject.includes('SECURITY AUDIT')) key = 'security-audit';

        capturedEmails[key] = {
          subject,
          body: mailOptions.html || mailOptions.text,
          to:
            typeof mailOptions.to === 'string'
              ? mailOptions.to.split(', ')
              : mailOptions.to || [],
        };
        console.log(`[Nodemailer Intercepted] Subject: ${subject}`);
        return { messageId: `mock-id-${key}` };
      },
    };
  };

  // ==========================================
  // 1. Test Pre-EOD Report
  // ==========================================
  console.log('\n--- 1. Testing Pre-EOD Email Report ---');
  try {
    const passed = false;
    const totals = {
      totalACM_MS: 1500,
      totalACM_Straits: 1485,
      differACM: 15,
      totalCQG_MS: 3000,
      totalCQG_FR: 3005,
      differCQG: -5,
    };
    const mismatchedTrades = [
      {
        source: 'MSystem' as const,
        maTKGD: '000100',
        maHD: 'CLEQ6',
        giaKhop: 75.5,
        klGiaoDich: 2,
        ngayGio: '2026-07-11 10:15:00',
        reason: 'Không tìm thấy lệnh đối ứng bên CQG/Straits',
      },
    ];
    const mismatchedPositions = [
      {
        account: '000200',
        symbol: 'ZCEQ6',
        msPosition: 10,
        cqgPosition: 8,
        differ: 2,
      },
    ];

    const html = reconciliationService['buildPreEodEmailHtml'](
      passed,
      totals,
      mismatchedTrades,
      mismatchedPositions,
    );
    await marginCheckerService.sendEmailNotification(
      await marginCheckerService.loadConfig(),
      ['test-preeod@mxv.vn'],
      '[MXV PRE-EOD CHECK] Báo cáo đối chiếu Khối lượng & Vị thế cuối ngày - LỆCH',
      html,
    );
  } catch (err: any) {
    console.error('Lỗi test Pre-EOD:', err.message);
  }

  // ==========================================
  // 2. Test EOD Balance Report
  // ==========================================
  console.log('\n--- 2. Testing EOD Balance Email Report ---');
  try {
    const discrepancies = [
      {
        maTKGD: '000100',
        calculatedBalance: 12500,
        cqgBalance: 12000,
        differ: 500,
      },
      {
        maTKGD: '000200',
        calculatedBalance: 4500,
        cqgBalance: 4500,
        differ: 0,
      },
    ];

    // Soạn email tương tự runAutoCheckSOD
    let discrepanciesRowsHtml = '';
    discrepancies.forEach((d) => {
      discrepanciesRowsHtml += `
        <tr>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${d.maTKGD}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">$${d.calculatedBalance.toLocaleString()}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace;">$${d.cqgBalance.toLocaleString()}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #b82c1c; font-family: monospace;">$${d.differ.toLocaleString()}</td>
        </tr>
      `;
    });

    const emailHtmlBody = `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>🚨 Phát Hiện Lệch Số Dư EOD</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f8f9fa;">
                <th style="border: 1px solid #ddd; padding: 8px;">Mã TKGD</th>
                <th style="border: 1px solid #ddd; padding: 8px;">MS Balance</th>
                <th style="border: 1px solid #ddd; padding: 8px;">CQG Balance</th>
                <th style="border: 1px solid #ddd; padding: 8px;">Lệch</th>
              </tr>
            </thead>
            <tbody>
              ${discrepanciesRowsHtml}
            </tbody>
          </table>
        </body>
      </html>
    `;

    await marginCheckerService.sendEmailNotification(
      await marginCheckerService.loadConfig(),
      ['test-eod-balance@mxv.vn'],
      '[MXV EOD BALANCE] Báo cáo đối chiếu số dư đầu ngày - LỆCH',
      emailHtmlBody,
    );
  } catch (err: any) {
    console.error('Lỗi test EOD Balance:', err.message);
  }

  // ==========================================
  // 3. Test Negative Margin Report
  // ==========================================
  console.log('\n--- 3. Testing Negative Margin Email Report ---');
  try {
    const balanceAccs = ['000100', '000300'];
    const imrAccs = ['000200', '000400'];

    const html = reconciliationService['buildNegativeMarginEmailHtml'](
      balanceAccs,
      imrAccs,
    );
    await marginCheckerService.sendEmailNotification(
      await marginCheckerService.loadConfig(),
      ['test-negative-margin@mxv.vn'],
      '🚨 [MXV WARNING] Danh Sách Tài Khoản Âm Ký Quỹ Đầu Ngày (Negative Margin Accounts)',
      html,
    );
  } catch (err: any) {
    console.error('Lỗi test Negative Margin:', err.message);
  }

  // ==========================================
  // 4. Test Bot Job Failure Alert
  // ==========================================
  console.log('\n--- 4. Testing Bot Failure Email Alert ---');
  try {
    const mockJob: any = {
      _id: '64b18c9f5647ba3568c07e12',
      jobType: 'RPA_DOWNLOAD_REPORTS',
      status: 'FAILED',
      attempts: 3,
      maxAttempts: 3,
      payload: new Map(
        Object.entries({ targetDate: '2026-07-11', taskChecklistId: '123' }),
      ),
      logs: [
        'Connecting to CQG client...',
        'Timeout error after 60000ms',
        'Attempt 3 failed: CQG Client Connection Timeout',
      ],
      save: async () => mockJob,
    };

    await botJobQueueService['sendOperationalFailureAlert'](
      mockJob,
      'CQG Client Connection Timeout',
    );
  } catch (err: any) {
    console.error('Lỗi test Bot Failure:', err.message);
  }

  // ==========================================
  // 5. Test Shift Handover Report
  // ==========================================
  console.log('\n--- 5. Testing Shift Handover Email Report ---');
  try {
    const mockShiftLog: any = {
      _id: '64b18c9f5647ba3568c07e15',
      shiftDate: '2026-07-11',
      templateId: { title: 'Ca Sáng (06:00 - 14:00)' },
      closedBy: { fullName: 'Nguyễn Văn A' },
      closedAt: new Date(),
      progressPercentage: 95.5,
      handoverNote:
        'Ca trực diễn ra bình thường. Các bot chạy ổn định. Lưu ý kiểm tra file excel sao lưu CE.',
      details: [
        {
          taskId: 'TASK01',
          taskNameSnapshot: 'Kiểm tra trạng thái kết nối server',
          isChecked: true,
          status: 'PASSED',
          updatedBy: { fullName: 'Nguyễn Văn A' },
          note: 'OK',
        },
        {
          taskId: 'TASK02',
          taskNameSnapshot: 'Chạy bot download báo cáo CQG',
          isChecked: true,
          status: 'PASSED',
          updatedBy: { fullName: 'Nguyễn Văn A' },
        },
        {
          taskId: 'TASK03',
          taskNameSnapshot: 'Đối chiếu số dư SOD',
          isChecked: false,
          status: 'FAILED',
          updatedBy: { fullName: 'Nguyễn Văn A' },
          note: 'Lệch $150 ở tài khoản 000100',
        },
      ],
    };

    await shiftsService['sendShiftHandoverEmail'](mockShiftLog);
  } catch (err: any) {
    console.error('Lỗi test Shift Handover:', err.message);
  }

  // ==========================================
  // 6. Test Security Audit Alert
  // ==========================================
  console.log('\n--- 6. Testing Security Audit Email Alert ---');
  try {
    const oldValue = JSON.stringify(
      {
        smtp: { host: 'smtp.oldserver.com', port: 25 },
      },
      null,
      2,
    );

    const newValue = JSON.stringify(
      {
        smtp: { host: 'smtp.office365.com', port: 587 },
      },
      null,
      2,
    );

    await settingsService['sendSecurityAuditEmail'](
      'margin_checker_config',
      oldValue,
      newValue,
    );
  } catch (err: any) {
    console.error('Lỗi test Security Audit:', err.message);
  }

  // ==========================================
  // Output and Save HTML Previews
  // ==========================================
  console.log('\n==========================================');
  console.log('TỔNG HỢP KẾT QUẢ PREVIEW:');
  console.log('==========================================');

  Object.entries(capturedEmails).forEach(([key, data]) => {
    const filePath = path.join(tempDir, `${key}-preview.html`);
    fs.writeFileSync(filePath, data.body, 'utf8');
    console.log(`[+] Đã lưu preview ${key.toUpperCase()}:`);
    console.log(`    - File: ${filePath}`);
    console.log(`    - Subject: ${data.subject}`);
    console.log(`    - To: ${data.to.join(', ')}`);
  });

  console.log(
    '\n✔ Hoàn thành kiểm thử. Tất cả email mock đã được xuất và lưu thành công.',
  );

  // Restore original nodemailer
  nodemailer.createTransport = originalCreateTransport;

  await app.close();
}

testAllEmails().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
