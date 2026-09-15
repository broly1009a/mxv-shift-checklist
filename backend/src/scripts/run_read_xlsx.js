const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const scriptContent = `
import openpyxl

file_path = '/opt/mxv-checklist/backend/data/audit_14_accounts/003C0879444/DANH SÁCH TKGD HUỶ + TỪ CHỐI KÍCH HOẠT.xlsx'
try:
    wb = openpyxl.load_workbook(file_path)
    for sname in wb.sheetnames:
        print('=== SHEET:', sname)
        sheet = wb[sname]
        for row in sheet.iter_rows(values_only=True):
            if any(row):
                row_str = [str(c).strip() if c is not None else '' for c in row]
                print(' | '.join(row_str[:7]))
except Exception as e:
    print('Error:', e)
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    const ws = sftp.createWriteStream('/tmp/read_xlsx.py');
    ws.write(scriptContent);
    ws.end();
    ws.on('close', () => {
      conn.exec('python3 /tmp/read_xlsx.py', (err2, stream) => {
        let out = '';
        stream.on('data', d => out += d);
        stream.on('close', () => {
          console.log(out);
          conn.end();
        });
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});
