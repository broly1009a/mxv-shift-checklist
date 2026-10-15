const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage();
  await page.goto('https://admin-dev.msystem.newgen.dev/#/login');
  await page.waitForTimeout(1500);
  await (await page.waitForSelector('input[name="username"]')).fill('mxvhieptruong');
  await (await page.waitForSelector('input[name="password"]')).fill('Taovipko0!');
  await page.click('button[type="submit"]');

  const pinModal = await page.waitForSelector('div.pincode', { timeout: 8000 }).catch(() => null);
  if (pinModal) {
    for (const d of '269696'.split('')) {
      await page.click(`div.pincode >> xpath=.//div[text()='${d}']`);
      await page.waitForTimeout(200);
    }
  }

  await page.waitForTimeout(4000);
  console.log('Current URL after login:', page.url());

  const info = await page.evaluate(() => {
    const clean = s => String(s || '').trim();
    const links = Array.from(document.querySelectorAll('a, .nav-dropdown, .nav-item')).map(a => {
      return {
        text: clean(a.innerText).replace(/\n+/g, ' > '),
        href: a.getAttribute('href') || '',
      };
    }).filter(l => l.text);
    return links;
  });

  console.log('VISIBLE MENUS & ROUTES:');
  info.forEach((m, idx) => console.log(`${idx + 1}. [${m.href}] -> ${m.text}`));

  await browser.close();
})();
