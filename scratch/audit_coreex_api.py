import paramiko

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.0.0.26', username='mxvadmin', password='MxV!,#2o26', timeout=10)

sftp = client.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/test_ccp_session.js', 'w') as f:
  f.write("""
(async () => {
  const fs = require('fs');
  const sessionPath = '/opt/mxv-checklist/backend/temp/coreccp_session.json';
  const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  const baseUrl = 'https://coreccp.vnclear.vn';

  for (const code of ['CP2CO', 'PL1NY', 'SI5CO']) {
    const res = await fetch(`${baseUrl}/ccp/inquiry/maintain/COMMODITY/search/INSTRUMENTS`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        connectkey: 'fsscssiam2021',
        'Content-Type': 'application/json',
        Cookie: session.sessionCookie,
      },
      body: JSON.stringify({
        searchcode: 'INSTRUMENTS',
        search: { KEYVAL: code },
        filter: {},
        orderBy: {},
        page: { pageIndex: 1, pageSize: 20 }
      }),
    });
    const d = await res.json();
    console.log(`[CoreCCP INSTRUMENTS] Code ${code}: count = ${d.payload?.data?.length || d.data?.length || 0}`);
    if (d.data?.[0] || d.payload?.data?.[0]) {
      const row = d.data?.[0] || d.payload?.data?.[0];
      console.log(`   Sample contract: SYMBOL = ${row.SYMBOL}, FULLNAME = ${row.FULLNAME}`);
    }
  }
})();
""")

stdin, stdout, stderr = client.exec_command("cd /opt/mxv-checklist/backend && node test_ccp_session.js && rm test_ccp_session.js")
print(stdout.read().decode('ascii', errors='ignore'))
print(stderr.read().decode('ascii', errors='ignore'))
client.close()
