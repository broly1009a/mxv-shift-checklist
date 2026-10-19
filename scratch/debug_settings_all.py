import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

test_script = """
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { getConnectionToken } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/mongoose');

async function debugSettings() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const conn = app.get(getConnectionToken());
  const db = conn.db;
  console.log('Connected DB name:', db.databaseName);

  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const allSettings = await db.collection('system_settings').find({}).toArray();
  console.log('All setting keys count:', allSettings.length);
  const msSetting = allSettings.find(s => s.key && s.key.includes('ms'));
  console.log('MS setting found:', msSetting ? msSetting.key : 'NONE');

  const botSettings = allSettings.filter(s => s.key && s.key.startsWith('bot_credentials'));
  console.log('Bot credential keys:', botSettings.map(s => s.key));

  await app.close();
  process.exit(0);
}

debugSettings().catch(e => { console.error(e); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/debug_settings_all.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/debug_settings_all.js')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('STDOUT:\n', out.encode('ascii', errors='replace').decode('ascii'))
print('STDERR:\n', err.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
