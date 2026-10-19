const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const https = require('https');

const baseUrl = 'https://coreccp.vnclear.vn';
const postData = JSON.stringify({ username: 'hieptruong', password: 'Taovipko0!' });

console.log('1. Testing POST /login to CoreCCP...');
const req1 = https.request({
  hostname: 'coreccp.vnclear.vn',
  port: 443,
  path: '/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Accept': 'application/json, text/plain, */*',
    'connectkey': 'fsscssiam2021',
    'x-devicetype': 'WEB',
    'x-lang': 'vi',
    'Origin': baseUrl,
    'Referer': baseUrl + '/login',
  },
  timeout: 10000,
}, (res) => {
  console.log('  Login status:', res.statusCode);
  const rawCookies = res.headers['set-cookie'] || [];
  let sessionCookie = '';
  for (const c of rawCookies) {
    const match = c.match(/SESSION=([^;]+)/i);
    if (match) sessionCookie = match[1];
  }
  console.log('  Session cookie:', sessionCookie ? sessionCookie.slice(0, 15) + '...' : '(none)');

  // 2. Testing searchFullJson
  console.log('\\n2. Testing searchFullJson /ccp/inquiry/maintain/ORDERMATCH_DETAIL/search/ORDERMATCH_DETAIL...');
  const searchPayload = JSON.stringify({
    searchcode: 'ORDERMATCH_DETAIL',
    search: {},
    filter: {},
    orderBy: {},
    page: { pageIndex: 1, pageSize: 200000 },
  });

  const req2 = https.request({
    hostname: 'coreccp.vnclear.vn',
    port: 443,
    path: '/ccp/inquiry/maintain/ORDERMATCH_DETAIL/search/ORDERMATCH_DETAIL',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(searchPayload),
      'Accept': 'application/json, text/plain, */*',
      'Authorization': 'Bearer ',
      'connectkey': 'fsscssiam2021',
      'Cookie': 'SESSION=' + sessionCookie,
      'Origin': baseUrl,
      'Referer': baseUrl + '/ORDERS/ORDERMATCH_DETAIL',
    },
    timeout: 10000,
  }, (res2) => {
    let body = '';
    res2.on('data', chunk => body += chunk);
    res2.on('end', () => {
      console.log('  Search status code:', res2.statusCode);
      console.log('  Search response headers:', res2.headers);
      console.log('  Search response body:', body);
    });
  });
  req2.on('error', console.error);
  req2.write(searchPayload);
  req2.end();
});

req1.on('error', console.error);
req1.write(postData);
req1.end();
`;

  conn.exec(`node -e "${remoteScript.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
