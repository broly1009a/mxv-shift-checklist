const { Client } = require('ssh2');

const remoteCmd = `
python3 -c "
import fitz

doc = fitz.open('/opt/mxv-checklist/backend/data/audit_14_accounts/003C0879444/C_NG_V_N_GI_I_TR_NH_TVKD_003.pdf')
for i, page in enumerate(doc):
    print(f'--- PAGE {i+1} ---')
    print(page.get_text())
"
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(remoteCmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});
