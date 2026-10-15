const fs = require('fs');
const path = require('path');

const servicePath = path.resolve('../mxv-cqg-download-investigation/backend/src/modules/ingress/ingress.service.ts');
let content = fs.readFileSync(servicePath, 'utf8');

// 1. Add import
if (!content.includes('AcmEtpAdapter')) {
  content = content.replace(
    "import { AcmSftpAdapter } from './adapters/acm-sftp.adapter';",
    "import { AcmSftpAdapter } from './adapters/acm-sftp.adapter';\nimport { AcmEtpAdapter } from './adapters/acm-etp.adapter';"
  );
}

// 2. Add to constructor
if (!content.includes('private readonly acmEtpAdapter: AcmEtpAdapter')) {
  content = content.replace(
    "private readonly acmSftpAdapter: AcmSftpAdapter,",
    "private readonly acmSftpAdapter: AcmSftpAdapter,\n    private readonly acmEtpAdapter: AcmEtpAdapter,"
  );
}

// 3. Update feature flag mode resolution
const oldModeSection = `    // Cấu hình Động từ CSDL: Ưu tiên đọc key 'ingress_mode' từ bảng system_settings
    let ingressMode = 'PLAYWRIGHT';
    if (this.settingsService) {
      ingressMode = await this.settingsService.getSetting(
        'ingress_mode',
        process.env.INGRESS_MODE || 'PLAYWRIGHT',
      );
    } else {
      ingressMode = process.env.INGRESS_MODE || 'PLAYWRIGHT';
    }

    // Feature Flag: Tắt Playwright và chuyển trực tiếp sang REST/SFTP API khi ingressMode = 'REST_API'
    if (ingressMode === 'REST_API') {
      this.logger.log(
        \`[IngressService] Kích hoạt Direct API Mode từ CSDL cho nguồn "\${source}" (Bỏ qua Playwright, không cần restart server)\`,
      );
      if (source === 'MS' || source === 'CORE_EX') {
        return this.coreExApiAdapter.download('MS', { ...options, targetDirectory: outputDirectory });
      } else if (source === 'CCP' || source === 'CORE_CCP') {
        return this.coreCcpApiAdapter.download('CCP', { ...options, targetDirectory: outputDirectory });
      } else if (source === 'ACM') {
        return this.acmSftpAdapter.download('ACM', { ...options, targetDirectory: outputDirectory });
      }
    }`;

const newModeSection = `    // Cấu hình Động từ CSDL: Ưu tiên cờ riêng từng nguồn, fallback sang key chung 'ingress_mode'
    let globalMode = 'PLAYWRIGHT';
    if (this.settingsService) {
      globalMode = await this.settingsService.getSetting(
        'ingress_mode',
        process.env.INGRESS_MODE || 'PLAYWRIGHT',
      );
    } else {
      globalMode = process.env.INGRESS_MODE || 'PLAYWRIGHT';
    }

    const sourceKeyMap: Record<string, string> = {
      MS: 'ingress_mode_ms',
      CCP: 'ingress_mode_ccp',
      CORE_CCP: 'ingress_mode_ccp',
      ACM: 'ingress_mode_acm',
      CORE_EX: 'ingress_mode_ce',
    };
    const specificKey = sourceKeyMap[source] || \`ingress_mode_\${source.toLowerCase()}\`;
    const ingressMode = this.settingsService
      ? await this.settingsService.getSetting(specificKey, globalMode)
      : (process.env[specificKey.toUpperCase()] || globalMode);

    // Feature Flag: Tắt Playwright và chuyển trực tiếp sang REST/SFTP API khi ingressMode = 'REST_API'
    if (ingressMode === 'REST_API') {
      this.logger.log(
        \`[IngressService] Kích hoạt Direct API Mode từ CSDL cho nguồn "\${source}" (Cờ: \${specificKey}=REST_API)\`,
      );
      if (source === 'MS' || source === 'CORE_EX') {
        return this.coreExApiAdapter.download('MS', { ...options, targetDirectory: outputDirectory });
      } else if (source === 'CCP' || source === 'CORE_CCP') {
        return this.coreCcpApiAdapter.download('CCP', { ...options, targetDirectory: outputDirectory });
      } else if (source === 'ACM') {
        // Tự động phân nhánh: Nếu yêu cầu báo cáo ETP (Orders/Trades) -> dùng AcmEtpAdapter, còn lại dùng AcmSftpAdapter (Straits CSV)
        const isEtpReport = options?.reportCodes?.some((r) => r.includes('ETP') || r === 'ORDERS' || r === 'TRADES');
        if (isEtpReport) {
          return this.acmEtpAdapter.download('ACM', { ...options, targetDirectory: outputDirectory });
        }
        return this.acmSftpAdapter.download('ACM', { ...options, targetDirectory: outputDirectory });
      }
    }`;

if (content.includes("let ingressMode = 'PLAYWRIGHT';")) {
  content = content.replace(oldModeSection, newModeSection);
  fs.writeFileSync(servicePath, content, 'utf8');
  console.log('Updated ingress.service.ts successfully');
} else {
  console.log('Could not find exact oldModeSection, manual inspection needed');
}
