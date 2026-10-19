import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=10)

test_script = """
require('/opt/mxv-checklist/backend/node_modules/dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { NestFactory } = require('/opt/mxv-checklist/backend/node_modules/@nestjs/core');
const { AppModule } = require('/opt/mxv-checklist/backend/dist/app.module');
const { KlgdReconWorker } = require('/opt/mxv-checklist/backend/dist/modules/trading-ops/workers/klgd-recon.worker');

async function testRecon() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn', 'log'] });
  const worker = app.get(KlgdReconWorker);

  console.log('--- EXECUTING KLGD RECON WORKER WITH FRESH FILES ---');
  const result = await worker.execute({
    date: '2026-10-16',
    options: {
      checkKlgd: true,
      checkTtm: true,
      checkTttt: true
    }
  });

  console.log('RECON RESULT SUMMARY:');
  console.log(JSON.stringify(result, null, 2));

  await app.close();
  process.exit(0);
}

testRecon().catch(e => { console.error('FATAL RECON ERROR:', e); process.exit(1); });
"""

sftp = ssh.open_sftp()
with sftp.file('/tmp/test_klgd_worker_run.js', 'w') as f:
    f.write(test_script)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/test_klgd_worker_run.js')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print('STDOUT:\n', out.encode('ascii', errors='replace').decode('ascii'))
print('STDERR:\n', err.encode('ascii', errors='replace').decode('ascii'))
ssh.close()
