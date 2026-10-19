import paramiko
import sys
sys.stdout.reconfigure(encoding='utf-8')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.0.0.26', port=22, username='mxvadmin', password='MxV!,#2o26', timeout=15)

test_js = """
let WebSocket = globalThis.WebSocket;
if (!WebSocket) {
  try { WebSocket = require('ws'); } catch {}
}

async function testWsEvent() {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('./dist/app.module');
  const { CoreCcpApiAdapter } = require('./dist/modules/ingress/adapters/coreccp-api.adapter');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const adapter = app.get(CoreCcpApiAdapter);
  const session = await adapter.getValidSession();
  const baseUrl = adapter.defaultBaseUrl || 'https://coreccp.vnclear.vn';

  // 1. Get ticket
  const ticketRes = await fetch(`${baseUrl}/sso/api/v1/oauth/issue-ws-ticket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      Cookie: session.sessionCookie,
    },
  });
  const ticketJson = await ticketRes.json();
  const wsTicket = ticketJson.payload?.[0] || 'ticket_default';
  console.log('WS Ticket:', wsTicket);

  const userId = session.userId || 6;
  const wsUrl = `wss://coreccp.vnclear.vn/notisocket/socket.io/?ticket=${wsTicket}&userId=${userId}&EIO=4&transport=websocket`;

  const ws = new WebSocket(wsUrl, {
    headers: {
      Cookie: session.sessionCookie,
      Origin: baseUrl,
    },
  });

  const fekey = 'TEST_DEBUG_' + Date.now();
  console.log('Target fekey:', fekey);

  ws.on('open', () => {
    console.log('WS OPENED');
  });

  ws.on('message', async (data) => {
    const msg = data.toString();
    console.log('WS RAW MSG:', msg.substring(0, 150));

    if (msg.startsWith('0')) {
      ws.send('40');
      console.log('-> Sent 40');
    } else if (msg.startsWith('40')) {
      const sub = `42["SUBSCRIBE",{"action":"SUBSCRIBE","userID":${userId},"room":["NOTI","REPORT","SOCKET"]}]`;
      ws.send(sub);
      console.log('-> Sent SUBSCRIBE room REPORT');

      // Now create export job
      console.log('-> Calling POST /ccp/export/create...');
      const res = await fetch(`${baseUrl}/ccp/export/create`, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/plain, */*',
          Authorization: `Bearer ${session.accessToken}`,
          connectkey: 'fsscssiam2021',
          'Content-Type': 'application/json',
          Cookie: session.sessionCookie,
          Origin: baseUrl,
          Referer: `${baseUrl}/ORDERS/ORDERMATCH_DETAIL`,
        },
        body: JSON.stringify({
          searchcode: 'ORDERMATCH_DETAIL',
          search: {},
          filter: {},
          orderBy: {},
          page: { pageIndex: 1, pageSize: 20 },
          exptype: 'XLSX',
          fekey,
        }),
      });
      const resJson = await res.json();
      console.log('-> Export create response:', resJson);
    } else if (msg.startsWith('42')) {
      console.log('*** RECEIVED 42 EVENT ***:', msg);
      setTimeout(() => {
        ws.close();
        app.close().then(() => process.exit(0));
      }, 1000);
    }
  });

  ws.on('error', (err) => console.error('WS Error:', err));
  ws.on('close', (c, r) => console.log('WS Closed:', c, r.toString()));

  // Wait max 20s
  setTimeout(() => {
    console.log('Test completed or timed out.');
    ws.close();
    app.close().then(() => process.exit(0));
  }, 20000);
}

testWsEvent().catch(console.error);
"""

sftp = ssh.open_sftp()
with sftp.file('/opt/mxv-checklist/backend/test_ws_event.js', 'w') as f:
    f.write(test_js)
sftp.close()

stdin, stdout, stderr = ssh.exec_command('cd /opt/mxv-checklist/backend && node test_ws_event.js')
status = stdout.channel.recv_exit_status()
out = stdout.read().decode('utf-8', errors='ignore')
err = stderr.read().decode('utf-8', errors='ignore')
print("STATUS:", status)
print("STDOUT:\n", out)
if err:
    print("STDERR:\n", err)

ssh.close()
