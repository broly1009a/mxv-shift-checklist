const { Client } = require('ssh2');

const script = `
import glob
import os
import openpyxl

files = glob.glob('/opt/mxv-checklist/backend/data/audit_14_accounts/003C0879444/*.xlsx')
print("Found xlsx files:", files)
for fpath in files:
    print("=== READING:", os.path.basename(fpath))
    wb = openpyxl.load_workbook(fpath)
    for sname in wb.sheetnames:
        print("--- Sheet:", sname)
        sheet = wb[sname]
        for row in sheet.iter_rows(values_only=True):
            if any(row):
                print(" | ".join([str(c).strip() if c is not None else "" for c in row if c is not None]))
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    const ws = sftp.createWriteStream('/tmp/read_xlsx.py');
    ws.write(script);
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
