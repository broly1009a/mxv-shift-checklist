const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const localPath = path.resolve(__dirname, 'python/tkgd_extractor_worker.py');
const remotePath = '/opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py';

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    console.log('Uploading updated tkgd_extractor_worker.py...');
    sftp.fastPut(localPath, remotePath, async (uploadErr) => {
      if (uploadErr) throw uploadErr;
      console.log('Uploaded! Running test...');
      
      const tests = [
        {
          code: '036C8253769',
          hd: '/opt/mxv-checklist/backend/data/temp_tkgd_attachments/036C8253769/036C8253769_Nguyen Thi Tuyen.pdf',
          front: '/opt/mxv-checklist/backend/data/temp_tkgd_attachments/036C8253769/mt.png',
          back: '/opt/mxv-checklist/backend/data/temp_tkgd_attachments/036C8253769/ms.png',
        },
        {
          code: '036C0141369',
          hd: '/opt/mxv-checklist/backend/data/temp_tkgd_attachments/036C0141369/036C0141369_Vo Thi Minh Huyen.pdf',
          front: '/opt/mxv-checklist/backend/data/temp_tkgd_attachments/036C0141369/tải xuống (1).png',
          back: '/opt/mxv-checklist/backend/data/temp_tkgd_attachments/036C0141369/tải xuống.png',
        },
        {
          code: '036C8888871',
          hd: '/opt/mxv-checklist/backend/data/temp_tkgd_attachments/036C8888871/036C8888871_Hoang Thi Lan.pdf',
          front: '/opt/mxv-checklist/backend/data/temp_tkgd_attachments/036C8888871/tải xuống (2).png',
          back: '/opt/mxv-checklist/backend/data/temp_tkgd_attachments/036C8888871/tải xuống.png',
        },
      ];

      for (const t of tests) {
        console.log(`\n================= TEST ${t.code} =================`);
        const cmd = `python3 /opt/mxv-checklist/backend/src/scripts/python/tkgd_extractor_worker.py --code "${t.code}" --hopdong "${t.hd}" --front "${t.front}" --back "${t.back}"`;
        const res = await new Promise((resolve) => {
          conn.exec(cmd, (err, stream) => {
            if (err) return resolve('ERR: ' + err.message);
            let s = '';
            stream.on('data', d => s += d.toString());
            stream.stderr.on('data', d => console.error('STDERR:', d.toString()));
            stream.on('close', () => resolve(s));
          });
        });
        console.log(res);
      }
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
