import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

test_script = """
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { SystemSettingsService } = require('/opt/mxv-checklist/backend/dist/modules/system-settings/system-settings.service');
const { decrypt } = require('/opt/mxv-checklist/backend/dist/shared/helpers/crypto');

async function debugCreds() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const settingsService = app.get(SystemSettingsService);
  const rawCred = await settingsService.getSetting('bot_credentials_msystem', '');
  console.log('rawCred:', rawCred);
  try {
    const decrypted = decrypt(rawCred);
    console.log('decrypted string:', decrypted);
    const parsed = JSON.parse(decrypted);
    console.log('parsed JSON:', parsed);
  } catch (e) {
    console.error('Error during decrypt/parse:', e.message);
  }
  await app.close();
  process.exit(0);
}

debugCreds().catch(e => { console.error(e); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/debug_ms_creds.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/debug_ms_creds.js')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('STDOUT:\n', out.encode('ascii', errors='replace').decode('ascii'))
print('STDERR:\n', err.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
