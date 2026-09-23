const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `python3 -c '
import os
base = "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem"
cases = [
    ("2026-09-09", "003C7663035"),
    ("2026-09-09", "003C0879444"),
    ("2026-09-09", "046C0002904"),
    ("2026-09-10", "046C0002915"),
    ("2026-09-10", "046C0002881"),
    ("2026-09-10", "003C8780568"),
]
for batch, code in cases:
    d = os.path.join(base, batch, code)
    print("===", code, "===")
    if os.path.exists(d):
        for f in sorted(os.listdir(d)):
            fp = os.path.join(d, f)
            print("  ", f, os.path.getsize(fp)//1024, "KB")
    else:
        print("   NOT FOUND")
'`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
