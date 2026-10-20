import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

js_code = r"""
require('dotenv').config();
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { SystemSettingsService } = require('./dist/modules/system-settings/system-settings.service');

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const settingsService = app.get(SystemSettingsService);
  const model = settingsService.systemSettingModel;

  console.log('Model details with dotenv:');
  console.log('  DB name:', model.db.name);
  console.log('  Collection name:', model.collection.name);
  const count = await model.countDocuments();
  console.log('  Total count:', count);

  const ceDoc = await model.findOne({ key: 'bot_credentials_ce' });
  console.log('  ceDoc exists:', !!ceDoc);
  if (ceDoc) {
    console.log('  ceDoc key:', ceDoc.key);
    console.log('  ceDoc value length:', ceDoc.value.length);
  }

  const rawSetting = await settingsService.getSetting('bot_credentials_ce', '');
  console.log('  settingsService.getSetting length:', rawSetting.length);

  await app.close();
  process.exit(0);
})();
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/check_model_db.js', 'w') as f:
    f.write(js_code)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node check_model_db.js && rm -f check_model_db.js')
print(stdout.read().decode('utf-8'))
print(stderr.read().decode('utf-8'))

ssh.close()
