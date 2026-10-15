const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage();
  await page.goto('https://uat-coreccp.mxv.com.vn/login');
  await page.fill("input[name='username']", 'hieptruong');
  await page.fill("input[name='password']", 'Taovipko0!');
  await page.click("button[type='submit']");
  await page.waitForTimeout(2500);

  await page.goto('https://uat-coreccp.mxv.com.vn/RISKMNG/ACCTMARGIN_ALL');
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const clean = (s) => String(s || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    const ths = Array.from(document.querySelectorAll('th'));
    const allHeaders = ths.map((th) => {
      return {
        text: clean(th.innerText || th.textContent),
        id: th.id,
        className: th.className,
        colId: th.getAttribute('col-id') || th.getAttribute('data-field') || th.getAttribute('data-column-id') || '',
      };
    }).filter((t) => t.text);

    return {
      totalThs: ths.length,
      headers: allHeaders,
    };
  });

  console.log('Total Ths:', info.totalThs);
  console.log('Headers Count:', info.headers.length);
  info.headers.forEach((h, i) => {
    console.log(`${i + 1}. [${h.colId || 'NO_ID'}] -> ${h.text} (class: ${h.className})`);
  });

  await browser.close();
})();
