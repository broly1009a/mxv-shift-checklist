const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage();
  const searchCalls = [];

  page.on('request', (req) => {
    if (req.url().includes('/search/') || req.url().includes('/export/')) {
      searchCalls.push({
        url: req.url(),
        method: req.method(),
        postData: req.postData(),
      });
    }
  });

  await page.goto('https://uat-coreccp.mxv.com.vn/login');
  await page.fill("input[name='username']", 'hieptruong');
  await page.fill("input[name='password']", 'Taovipko0!');
  await page.click("button[type='submit']");
  await page.waitForTimeout(3000);

  console.log('--- Điều hướng tới /RISKMNG/ACCTMARGIN_POS ---');
  await page.goto('https://uat-coreccp.mxv.com.vn/RISKMNG/ACCTMARGIN_POS');
  await page.waitForTimeout(3000);

  console.log('--- Click tab TVKD ---');
  const tvkdTab = await page.$("xpath=//*[contains(text(), 'Danh sách ký quỹ TKTVKD')]");
  if (tvkdTab) await tvkdTab.click();
  await page.waitForTimeout(3000);

  console.log('SEARCH CALLS CAPTURED:');
  console.log(JSON.stringify(searchCalls, null, 2));

  await browser.close();
})();
