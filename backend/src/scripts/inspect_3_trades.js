const { Client } = require('ssh2');

async function main() {
  const conn = new Client();
  conn.on('ready', () => {
    console.log('Connected to Ubuntu 10.0.0.26. Inspecting 3 accounts in DSGD.xlsx and FR.xlsx...\n');

    const remoteCmd = `python3 -c "
import openpyxl
import os
import glob
from datetime import datetime

base_dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck'
# Tim thu muc ngay 16.10
ms_files = glob.glob(base_dir + '/**/16.10/**/DSGD*.xlsx', recursive=True) + glob.glob(base_dir + '/**/16.10/DSGD.xlsx', recursive=True)
cqg_files = glob.glob(base_dir + '/**/16.10/**/FR*.xlsx', recursive=True)

print('Found MS files:', ms_files)
print('Found CQG files:', cqg_files)

targets = ['045C4913188', '088C7181411', '080C6236989']
symbols = ['CTEZ26', 'ZCEH27', 'ZWAN27', 'CTE', 'ZCE', 'ZWA']

print('\\n=== 1. KIỂM TRA TRONG FILE DSGD.XLSX (M-SYSTEM) ===')
for mf in ms_files:
    if os.path.exists(mf):
        print('Checking file:', mf)
        try:
            wb = openpyxl.load_workbook(mf, data_only=True)
            sheet = wb.active
            headers = [str(c.value) for c in sheet[1]]
            print('Headers:', headers[:15])
            
            for row in sheet.iter_rows(min_row=2, values_only=True):
                row_str = ' '.join([str(v) for v in row if v is not None])
                if any(t in row_str for t in targets) or any(s in row_str for s in ['CTEZ26', 'ZCEH27', 'ZWAN27']):
                    print('MS ROW MATCH:', row[:12])
        except Exception as e:
            print('Error reading', mf, e)

print('\\n=== 2. KIỂM TRA TRONG FILE FR / CQG (CQG) ===')
for cf in cqg_files:
    if os.path.exists(cf):
        print('Checking CQG file:', cf)
        try:
            wb = openpyxl.load_workbook(cf, data_only=True)
            sheet = wb.active
            headers = [str(c.value) for c in sheet[1]]
            print('Headers:', headers[:15])
            
            for row in sheet.iter_rows(min_row=2, values_only=True):
                row_str = ' '.join([str(v) for v in row if v is not None])
                if any(t in row_str for t in targets) or any(s in row_str for s in ['CTEZ26', 'ZCEH27', 'ZWAN27', 'CTE', 'ZCE', 'ZWA']):
                    # In ra neu trung tk hoac trung hang hoa
                    if any(t in row_str for t in targets):
                        print('CQG ROW MATCH BY ACCOUNT:', row[:12])
                    elif any(s in row_str for s in ['CTEZ26', 'ZCEH27', 'ZWAN27']):
                        print('CQG ROW MATCH BY CONTRACT:', row[:12])
        except Exception as e:
            print('Error reading', cf, e)
"`;

    let stdout = '';
    conn.exec(remoteCmd, { maxBuffer: 50 * 1024 * 1024 }, (err, stream) => {
      if (err) {
        console.error(err);
        conn.end();
        return;
      }
      stream.on('data', d => stdout += d.toString());
      stream.stderr.on('data', d => console.error(d.toString()));
      stream.on('close', (code) => {
        conn.end();
        console.log(stdout);
      });
    });
  }).connect({
    host: '10.0.0.26',
    port: 22,
    username: 'mxvadmin',
    password: 'MxV!,#2o26',
    readyTimeout: 15000,
  });
}
main().catch(console.error);
