const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const remoteCmd = `
python3 -c "
import fitz

doc = fitz.open('/opt/mxv-checklist/backend/data/audit_14_accounts/003C0879444/C_NG_V_N_GI_I_TR_NH_TVKD_003.pdf')
for i in range(min(2, len(doc))):
    pix = doc[i].get_pixmap(dpi=150)
    pix.save(f'/tmp/congvan_page_{i+1}.png')
print('Rendered pages')
"
`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(remoteCmd, (err, stream) => {
    stream.on('close', () => {
      conn.sftp((err2, sftp) => {
        sftp.fastGet('/tmp/congvan_page_1.png', path.join(__dirname, 'congvan_page_1.png'), () => {
          sftp.fastGet('/tmp/congvan_page_2.png', path.join(__dirname, 'congvan_page_2.png'), () => {
            console.log('Downloaded congvan pages');
            conn.end();
          });
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
