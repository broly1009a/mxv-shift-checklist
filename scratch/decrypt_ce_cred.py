import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_code = r"""
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { SystemSettingsService } = require('./dist/modules/system-settings/system-settings.service');
const { decrypt } = require('./dist/shared');

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const settings = app.get(SystemSettingsService);
  const rawCred = await settings.getSetting('bot_credentials_ce', '');
  console.log('rawCred length:', rawCred.length);
  if (rawCred) {
    const dec = decrypt(rawCred);
    const parsed = JSON.parse(dec);
    console.log('DECRYPTED CE CREDENTIALS:');
    console.log('  url:', parsed.url);
    console.log('  username:', parsed.username);
    console.log('  password:', parsed.password ? (parsed.password.substring(0, 3) + '***' + parsed.password.substring(parsed.password.length - 2)) : 'EMPTY');
    console.log('  full password length:', parsed.password ? parsed.password.length : 0);
    console.log('  clientId:', parsed.clientId);
    console.log('  clientSecret:', parsed.clientSecret ? 'EXISTS' : 'EMPTY');
  }
  await app.close();
  process.exit(0);
})();
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/print_ce_cred.js', 'w') as f:
    f.write(js_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node print_ce_cred.js && rm -f print_ce_cred.js')
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))

ssh.close()
