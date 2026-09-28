const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();

const pythonScript = `
import os
import glob
import json

# Tìm các file config C# trên server
patterns = [
    "/mnt/qlgd-it/**/*.json",
    "/mnt/qlgd-it/**/*.xml",
    "/mnt/qlgd-it/**/*.config",
    "/opt/mxv-checklist/**/*.json"
]

print("=== TÌM KIẾM CẤU HÌNH C# NagativeMarginAccs TRÊN SERVER ===")
for p in ["/mnt/qlgd-it/Quanlygiaodich", "/opt/mxv-checklist"]:
    for root, dirs, files in os.walk(p):
        for f in files:
            if f.endswith(('.json', '.config', '.ini', '.xml')):
                full_p = os.path.join(root, f)
                try:
                    with open(full_p, 'r', encoding='utf-8', errors='ignore') as fp:
                        content = fp.read()
                        if 'NagativeMarginAccs' in content or 'NegativeMargin' in content:
                            print(f"FOUND in {full_p}:")
                            for line in content.splitlines():
                                if 'NagativeMarginAccs' in line or 'NegativeMargin' in line or '003C' in line:
                                    print("  ", line.strip()[:120])
                except Exception as e:
                    pass
`;

conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const writeStream = sftp.createWriteStream('/tmp/find_csharp_config.py');
    writeStream.write(pythonScript);
    writeStream.end();
    writeStream.on('close', () => {
      conn.exec('python3 /tmp/find_csharp_config.py', (err2, stream) => {
        if (err2) throw err2;
        stream.on('data', (d) => process.stdout.write(d));
        stream.stderr.on('data', (d) => process.stderr.write(d));
        stream.on('close', (code) => {
          conn.exec('rm -f /tmp/find_csharp_config.py', () => conn.end());
        });
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});
