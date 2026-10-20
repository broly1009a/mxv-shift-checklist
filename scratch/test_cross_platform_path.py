import paramiko
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

import base64

js_code = """
const { resolveStoragePathCrossPlatform } = require('/opt/mxv-checklist/backend/dist/shared/helpers/file-path.helper');
const fs = require('fs');

const p1 = 'M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\TradingCheck\\\\Futures';
const p2 = 'M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\TradingCheck\\\\Ket qua check KLGD';

const r1 = resolveStoragePathCrossPlatform(p1);
const r2 = resolveStoragePathCrossPlatform(p2);

console.log('p1 resolved:', r1, 'exists:', fs.existsSync(r1));
console.log('p2 resolved:', r2, 'exists:', fs.existsSync(r2));
"""

stdin, stdout, stderr = ssh.exec_command('curl -s -k https://localhost/api/v1/system-settings/verify-storage-path -H "Content-Type: application/json" -d \'{"path":"M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\TradingCheck\\\\Futures"}\'')
print("CURL 1 (Futures):", stdout.read().decode('utf-8', errors='ignore'))

stdin, stdout, stderr = ssh.exec_command('curl -s -k https://localhost/api/v1/system-settings/verify-storage-path -H "Content-Type: application/json" -d \'{"path":"M:\\\\Tailieuchung\\\\QLGD-IT\\\\Quanlygiaodich\\\\Tai lieu hoat dong\\\\TradingCheck\\\\Ket qua check KLGD"}\'')
print("CURL 2 (Ket qua check KLGD):", stdout.read().decode('utf-8', errors='ignore'))
err = stderr.read().decode('utf-8', errors='ignore')
if err:
    print('ERR:', err)
ssh.close()
