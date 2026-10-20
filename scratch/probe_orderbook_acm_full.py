import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=15)

remote_js = """
const { CoreExApiAdapter } = require('/opt/mxv-checklist/backend/dist/modules/ingress/adapters/coreex-api.adapter');

async function test() {
  const adapter = new CoreExApiAdapter({
    getCredential: async () => ({
      username: 'anhdao',
      password: 'encrypted:d261e56b3e7ee5a32ec693e506526eb6:4e3e3b3b49ba58c1df95e0c52bb3057e',
      baseUrl: 'https://coreexchange.mxv.com.vn',
      authUrl: 'https://coreexchange.mxv.com.vn/auth/realms/mxv/protocol/openid-connect/token'
    })
  });
  
  require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
  const session = await adapter.getValidSession();
  
  // 1. ORDERBOOK_ACM with targetDate 2026-10-19
  const res = await adapter.searchData(session, 'ORDERBOOK_ACM', { targetDate: '2026-10-19', search: {}, pageSize: 200000 });
  console.log('ORDERBOOK_ACM targetDate 2026-10-19 total rows:', res.rows.length);
  
  const byStatus = {};
  for (const r of res.rows) {
    const k = `${r.STATUS} | ${r.EN_STATUS} | ${r.STATUS_DESC}`;
    byStatus[k] = (byStatus[k] || 0) + 1;
  }
  console.log('Breakdown:', JSON.stringify(byStatus, null, 2));

  // 2. ORDERBOOK_ALL_ACM with targetDate 2026-10-16
  const res16 = await adapter.searchData(session, 'ORDERBOOK_ALL_ACM', { targetDate: '2026-10-16', search: {}, pageSize: 200000 });
  console.log('ORDERBOOK_ALL_ACM targetDate 2026-10-16 total rows:', res16.rows.length);

  // 3. ORDERBOOK_ALL_ACM with targetDate 2026-10-19
  const res19 = await adapter.searchData(session, 'ORDERBOOK_ALL_ACM', { targetDate: '2026-10-19', search: {}, pageSize: 200000 });
  console.log('ORDERBOOK_ALL_ACM targetDate 2026-10-19 total rows:', res19.rows.length);
}

test().catch(console.error);
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/probe_orderbook_full.js', 'w') as f:
    f.write(remote_js)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node probe_orderbook_full.js')
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print("STDOUT:\n", out)
if err:
    print("STDERR:\n", err)

ssh.close()
