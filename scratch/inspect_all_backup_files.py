import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=15)

node_script = """
const fs = require('fs');
const path = require('path');
const ExcelJS = require('/opt/mxv-checklist/backend/node_modules/exceljs');

async function auditDir(title, dirPath) {
  console.log('========================================================================');
  console.log(' AUDIT THU MUC: ' + title);
  console.log(' Duong dan: ' + dirPath);
  console.log('========================================================================');

  if (!fs.existsSync(dirPath)) {
    console.log('  Thu muc KHONG TON TAI!');
    return;
  }

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.xlsx'));
  console.log('Tim thay ' + files.length + ' file .xlsx:\\n');

  console.log(
    'STT'.padEnd(4) +
    'Ten file'.padEnd(30) +
    'Kich thuoc'.padEnd(14) +
    'So dong'.padEnd(10) +
    'So cot'.padEnd(8) +
    'Trang thai'
  );
  console.log('-'.repeat(80));

  let idx = 1;
  for (const f of files.sort()) {
    const fullPath = path.join(dirPath, f);
    const stat = fs.statSync(fullPath);
    const sizeKB = (stat.size / 1024).toFixed(1) + ' KB';

    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(fullPath);
      const ws = wb.worksheets[0];
      const rowCount = ws ? ws.rowCount : 0;
      const colCount = ws ? ws.columnCount : 0;

      let status = '';
      if (rowCount === 0) {
        status = 'RONG (0 dong)';
      } else if (rowCount === 1) {
        const val1 = ws.getRow(1).getCell(1).value;
        if (typeof val1 === 'string' && val1.includes('Khong co du lieu')) {
          status = 'KHONG CO DU LIEU PHAT SINH';
        } else {
          status = 'CHI CO HEADER (0 dong data)';
        }
      } else {
        status = 'CO DU LIEU (' + (rowCount - 1) + ' dong data)';
      }

      console.log(
        String(idx++).padEnd(4) +
        f.padEnd(30) +
        sizeKB.padEnd(14) +
        String(rowCount).padEnd(10) +
        String(colCount).padEnd(8) +
        status
      );
    } catch (err) {
      console.log(
        String(idx++).padEnd(4) +
        f.padEnd(30) +
        sizeKB.padEnd(14) +
        'ERR'.padEnd(10) +
        'ERR'.padEnd(8) +
        'Loi doc: ' + err.message
      );
    }
  }
}

(async () => {
  await auditDir('BACKUP CORECCP (19.10)', '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/19.10');
  console.log('\\n');
  await auditDir('BACKUP COREEX (19.10)', '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CE/Futures/2026/T10.2026/19.10');
})();
"""

sftp = client.open_sftp()
with sftp.open('/tmp/audit_backup_files.js', 'w') as f:
    f.write(node_script)
sftp.close()

stdin, stdout, stderr = client.exec_command('cd /opt/mxv-checklist/backend && node /tmp/audit_backup_files.js')
print(stdout.read().decode('utf-8', errors='ignore'))
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print('STDERR:', err)
client.close()
