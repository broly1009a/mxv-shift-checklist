const { Client } = require('ssh2');

const script = `
import fitz

doc = fitz.open('/opt/mxv-checklist/backend/data/audit_14_accounts/003C0879444/C_NG_V_N_GI_I_TR_NH_TVKD_003.pdf')
for i in range(len(doc)):
    print(f"=== PAGE {i+1} ===")
    t = doc[i].get_text()
    if t.strip():
        print(t)
    else:
        print("(No embedded text - scanned image)")
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    const ws = sftp.createWriteStream('/tmp/check_cv_text.py');
    ws.write(script);
    ws.end();
    ws.on('close', () => {
      conn.exec('python3 /tmp/check_cv_text.py', (err2, stream) => {
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
