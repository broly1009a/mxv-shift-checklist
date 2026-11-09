const https = require('https');

const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJteHZzdXBwb3J0IiwiYXV0aCI6W3siYXV0aG9yaXR5IjoiQURNSU4ifV0sImlhdCI6MTc5NDIxMzU2OSwiZXhwIjoxNzk0MjU2NzY5fQ.MJ9PsDL-57Fuba1QungzXHZ4zp61Sc3Zt9HDR2uWTEE';

function fetchMsApi(pathUrl) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://msapi.mxv.com.vn${pathUrl}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          Origin: 'https://msadmin.mxv.com.vn',
          Referer: 'https://msadmin.mxv.com.vn/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Parse error (${res.statusCode}): ${data.substring(0, 300)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  for (const subType of ['F', 'L', 'A']) {
    const res = await fetchMsApi(`/market/commodity?limit=100&offset=0&subType=${subType}&sort_by=asc(commodityCode)`);
    const items = res.data || [];
    console.log(`\n=== COMMODITY subType=${subType} (totalRows=${res.pagination?.totalRows}, fetched=${items.length}) ===`);
    for (const it of items) {
      console.log(`  [${it.commodityCode}] shortName=${it.shortName} | fullName="${it.fullName}" | status=${it.commodityStatus} | exchange=${it.exchange}`);
    }
  }

  const memRes = await fetchMsApi(`/am/admin/members?limit=100&offset=0&sort_by=desc(createdDate)`);
  const members = memRes.data?.members || [];
  console.log(`\n=== MEMBERS (totalRows=${memRes.pagination?.totalRows}, fetched=${members.length}) ===`);
  const activeMembers = members.filter((m) => m.status === 'ACTIVE');
  console.log(`Active members count: ${activeMembers.length}`);
  for (const m of members) {
    if (m.status === 'ACTIVE' || ['039', '061', '090'].includes(m.code)) {
      console.log(`  [${m.code}] status=${m.status} | created=${new Date(m.createdDate).toISOString().slice(0,10)} | name="${m.name}" | note="${m.note}"`);
    }
  }
}

run().catch(console.error);
