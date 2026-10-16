const { Client } = require('ssh2');

async function main() {
  const conn = new Client();
  conn.on('ready', () => {
    const remoteCmd = `python3 -c "
import openpyxl
import glob

ms_files = glob.glob('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/**/16.10/DSGD.xlsx', recursive=True)
targets = ['045C4913188', '088C7181411', '080C6236989']

print('MS FILES:', ms_files)
for mf in ms_files:
    wb = openpyxl.load_workbook(mf, data_only=True)
    sheet = wb.active
    headers = [str(c.value).strip() if c.value is not None else '' for c in sheet[1]]
    print('Headers:', headers)
    for r_idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        row_str = ' '.join([str(v) for v in row if v is not None])
        for t in targets:
            if t in row_str:
                print(f'Line {r_idx} | TK {t}:', dict(zip(headers, [str(v) for v in row])))
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
      stream.on('close', () => {
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
