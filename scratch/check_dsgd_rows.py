import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26')

remote_code = '''
const fs = require('fs');
const { parseDSGD } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/helpers/trading-math.helper');
const { parseFR } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/parsers/cqg-excel.parser');

const dsgdBuffer = fs.readFileSync("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/2026/T10.2026/21.10/DSGD.xlsx");
const frBuffer = fs.readFileSync("/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/Futures/CQG/2026/T10.2026/21.10/FR.xlsx");

const dsgdList = parseDSGD(dsgdBuffer);
const frList = parseFR(frBuffer, new Date('2026-10-21'), []);

console.log("Parsed DSGD length:", dsgdList.length);
console.log("Parsed FR length:", frList.length);

const foundDsgd = dsgdList.filter(d => String(d.maLenh) === '162091632' || String(d.maTKGD).includes('080C1638824'));
console.log("foundDsgd:", foundDsgd);

const foundFr = frList.filter(f => String(f.ord) === '162091632' || String(f.account).includes('080C1638824'));
console.log("foundFr:", foundFr);
'''

sftp = ssh.open_sftp()
with sftp.file('/tmp/test_parse_order.js', 'w') as f:
    f.write(remote_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('node /tmp/test_parse_order.js')
print(stdout.read().decode('utf-8'))
err = stderr.read().decode('utf-8')
if err:
    print("STDERR:", err)
ssh.close()
