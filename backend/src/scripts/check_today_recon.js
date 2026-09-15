const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
stat "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/15.09/DSGD.xlsx"
echo "---"
python3 -c "
import os, datetime
import openpyxl

ms_dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/15.09'
cqg_dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures/2026/T09.2026/15.09'

dsgd_path = os.path.join(ms_dir, 'DSGD.xlsx')
fr_path = os.path.join(cqg_dir, 'FR.xlsx')

print('=== CHECKING TIMESTAMPS ===')
if os.path.exists(dsgd_path):
    mtime_dsgd = os.path.getmtime(dsgd_path)
    dt_dsgd = datetime.datetime.fromtimestamp(mtime_dsgd)
    print(f'DSGD.xlsx mtime: {dt_dsgd} (UTC: {datetime.datetime.utcfromtimestamp(mtime_dsgd)})')
else:
    print('DSGD.xlsx does not exist!')

if os.path.exists(fr_path):
    mtime_fr = os.path.getmtime(fr_path)
    dt_fr = datetime.datetime.fromtimestamp(mtime_fr)
    print(f'FR.xlsx mtime: {dt_fr} (UTC: {datetime.datetime.utcfromtimestamp(mtime_fr)})')
    
    wb = openpyxl.load_workbook(fr_path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    for r in rows:
        r_str = ' '.join([str(x) for x in r if x is not None])
        if '003C0930168' in r_str:
            print('FOUND TARGET TRADE IN FR:', r)

if os.path.exists(dsgd_path):
    wb_dsgd = openpyxl.load_workbook(dsgd_path, data_only=True)
    ws_dsgd = wb_dsgd.active
    rows_dsgd = list(ws_dsgd.iter_rows(values_only=True))
    found_dsgd = False
    for r in rows_dsgd:
        r_str = ' '.join([str(x) for x in r if x is not None])
        if '003C0930168' in r_str:
            print('FOUND TARGET TRADE IN DSGD:', r)
            found_dsgd = True
    if not found_dsgd:
        print('NOT FOUND TARGET TRADE IN DSGD!')

"`;

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream
      .on('close', () => conn.end())
      .on('data', (d) => process.stdout.write(d))
      .stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
