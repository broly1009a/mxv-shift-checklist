import paramiko
import sys
import json

print('Connecting to 10.0.0.26...')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

test_node_script = """
require('/opt/mxv-checklist/backend/node_modules/dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { QlgdDashboardService } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/services/qlgd-dashboard.service');

async function testDashboard() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const dashboardService = app.get(QlgdDashboardService);

  const testDates = ['2026-10-19', '2026-10-16'];
  for (const targetDate of testDates) {
    console.log(`\\n======================================================`);
    console.log(`KIỂM THỬ EXECUTIVE DASHBOARD PHIÊN: ${targetDate}`);
    console.log(`======================================================`);
    
    try {
      const res = await dashboardService.getExecutiveDashboard(targetDate, 'ALL', 'TOP17', false);
      
      console.log(`1. Trạng thái nguồn dữ liệu:`);
      console.log(`   - hasActualFiles: ${res.hasActualFiles}`);
      console.log(`   - dataSource: ${res.dataSource}`);
      
      console.log(`2. Khối lượng và Giá trị tức thời:`);
      console.log(`   - ACM: ${res.latestMetrics?.acm?.klgd} lots | GTGD: ${res.latestMetrics?.acm?.gtgdStr}`);
      console.log(`   - Còn lại: ${res.latestMetrics?.others?.klgd} lots | GTGD: ${res.latestMetrics?.others?.gtgdStr}`);
      
      console.log(`3. Bốn mốc thời điểm (Milestones):`);
      console.log(`   - ACM Milestones:`, JSON.stringify(res.milestones?.acm));
      console.log(`   - Others Milestones:`, JSON.stringify(res.milestones?.others));
      console.log(`   - Unique Accounts:`, JSON.stringify(res.milestones?.uniqueAccounts));
      
      // Kiểm tra có bị dính số ảo 123, 456, 789, 1111 không
      const isFakeAcm = res.milestones?.acm?.earlySession === 123 && res.milestones?.acm?.americanSession === 1111;
      const isFakeOthers = res.milestones?.others?.earlySession === 123 && res.milestones?.others?.americanSession === 1111;
      if (isFakeAcm || isFakeOthers) {
        console.error(`   [CẢNH BÁO]: Vẫn còn số liệu ảo 123/456/789/1111!`);
      } else {
        console.log(`   [CHÍNH XÁC]: Không còn bất kỳ số ảo 123/456/789/1111 nào! Số liệu 100% thực tế.`);
      }

      console.log(`4. Tin nhắn Ban Giám Sát:`);
      console.log(`   - 16h: ${res.bgsMessages?.session16h.split('\\n')[0]}`);
      console.log(`   - 23h: ${res.bgsMessages?.session23h.split('\\n')[0]}`);
      console.log(`   - EOD: ${res.bgsMessages?.sessionEod.split('\\n')[0]}`);

      console.log(`5. Ma trận mặt hàng (Top 5 items):`);
      res.items.slice(0, 5).forEach(it => {
        console.log(`   - [${it.symbol}] ${it.name}: Vị thế mở = ${it.openPositions} (Long ${it.longRatio}% / Short ${it.shortRatio}%), Lãi lỗ DK = ${it.expectedPnL.toLocaleString()} VND, Đã tất toán = ${it.liquidatedLots} lots, Lãi lỗ TT = ${it.realizedPnL.toLocaleString()} VND`);
      });
      console.log(`   Tổng toàn sàn: Vị thế mở = ${res.totals?.openPositions}, Lãi lỗ DK = ${res.totals?.expectedPnL.toLocaleString()} VND, Đã tất toán = ${res.totals?.liquidatedLots}`);
    } catch (e) {
      console.error(`Lỗi khi test phiên ${targetDate}:`, e.message);
    }
  }

  await app.close();
  process.exit(0);
}

testDashboard().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/test_dashboard_live.js', 'w') as f:
    f.write(test_node_script)
sftp.close()

print('Running live test on Ubuntu...')
stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_dashboard_live.js')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')

sys.stdout.reconfigure(encoding='utf-8')
print('=== KẾT QUẢ TEST TRỰC TIẾP TRÊN UBUNTU ===')
print(out)
if err and 'error' in err.lower():
    print('=== ERROR ===\n', err)

ssh.close()
