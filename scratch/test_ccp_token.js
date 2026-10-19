const { chromium } = require('playwright-core');

async function test() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.on('request', req => {
    const auth = req.headers()['authorization'];
    if (auth) {
      console.log('REQUEST with AUTH:', req.url(), auth.slice(0, 30));
    }
  });
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('token') || url.includes('oauth') || url.includes('login') || url.includes('auth') || url.includes('user')) {
      console.log('RESPONSE:', res.status(), url);
      try {
        const text = await res.text();
        if (text.includes('token') || text.includes('Bearer')) {
          console.log('-> Response contains token:', text.slice(0, 200));
        }
      } catch {}
    }
  });

  await page.goto('https://coreccp.vnclear.vn/login', { waitUntil: 'domcontentloaded' });
  await page.fill("input[name='username'], input[type='text']", 'hieptruong');
  await page.fill("input[name='password'], input[type='password']", 'Taovipko0!');
  await page.click("button[type='submit'], button:has-text('Đăng nhập')");
  await page.waitForTimeout(4000);
  console.log('Current URL:', page.url());
  await browser.close();
}

test().catch(console.error);
