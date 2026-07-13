const fs = require('fs');
const https = require('https');
const path = require('path');

const urls = [
  'https://www.cqgtrader.com/CAST/bundles/asp/libs.js?version=1783906759767',
  'https://www.cqgtrader.com/CAST/bundles/asp/cast.common.js?version=1783906759767',
  'https://www.cqgtrader.com/CAST/logon/Logon.js.asp'
];

async function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  const dir = path.join(__dirname, 'temp_js');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  for (const url of urls) {
    const filename = url.split('/').pop().split('?')[0];
    const dest = path.join(dir, filename);
    console.log(`Downloading ${filename}...`);
    try {
      await download(url, dest);
      const code = fs.readFileSync(dest, 'utf8');
      console.log(`Downloaded ${filename} (${code.length} bytes). Searching...`);

      // Search queries
      const queries = ['CSRFtoken', '__RequestVerificationToken', 'RequestManager', 'doLogon'];
      for (const q of queries) {
        let count = 0;
        let index = -1;
        while ((index = code.indexOf(q, index + 1)) !== -1) {
          count++;
          if (count <= 5) {
            const start = Math.max(0, index - 100);
            const end = Math.min(code.length, index + q.length + 100);
            const snippet = code.substring(start, end).replace(/\r?\n/g, ' ');
            console.log(`  [Found '${q}'] in ${filename}: ...${snippet}...`);
          }
        }
        console.log(`  Total matches for '${q}' in ${filename}: ${count}`);
      }
    } catch (err) {
      console.error(`Error processing ${url}:`, err.message);
    }
  }
}

main();
