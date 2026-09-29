const { chromium } = require('playwright-core');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return '';
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

async function probe() {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri);
  const setting = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_ce' });
  await mongoose.disconnect();
  const creds = JSON.parse(decrypt(setting.value));

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('https://uat-coreexchange.mxv.com.vn/login');
  await page.fill("input[name='username']", creds.username);
  await page.fill("input[name='password']", creds.password);
  await page.click("button[type='submit']");
  await page.waitForTimeout(5000);
  console.log('Current URL after submit:', page.url());

  // Expand menu first!
  console.log('Expanding sidebar...');
  await page.click("button[aria-label='Chuyển đổi menu']");
  await page.waitForTimeout(1500);

  // Click Quản lý sổ lệnh to expand it
  console.log('Clicking Quản lý sổ lệnh...');
  const soLenhBtn = page.locator(".menu-sidebar__content >> xpath=.//*[normalize-space(text())='Quản lý sổ lệnh']").first();
  await soLenhBtn.click({ force: true });
  await page.waitForTimeout(1000);

  // Inspect the child elements under Quản lý sổ lệnh
  const childInfo = await page.evaluate(() => {
    const parent = Array.from(document.querySelectorAll('.menu-sidebar__content > div')).find(d => d.innerText.includes('Quản lý sổ lệnh'));
    if (!parent) return { found: false };
    const links = Array.from(parent.querySelectorAll('li, div[role="button"], a')).map(l => ({
      tag: l.tagName,
      class: l.className,
      role: l.getAttribute('role'),
      text: l.innerText ? l.innerText.trim() : '',
      href: l.getAttribute('href'),
      html: l.outerHTML.slice(0, 150)
    }));
    return { found: true, linksCount: links.length, sample: links.slice(0, 10) };
  });
  console.log('Child items of Quản lý sổ lệnh:\n', JSON.stringify(childInfo, null, 2));

  // Test clicking Báo cáo
  console.log('Clicking "Báo cáo"...');
  const baoCaoBtn = page.locator(".menu-sidebar__content >> xpath=.//*[normalize-space(text())='Báo cáo']").first();
  await baoCaoBtn.click({ force: true });
  await page.waitForTimeout(2000);
  console.log('URL after clicking Báo cáo:', page.url());

  // Check if Báo cáo expanded any sub-items
  const baoCaoChildren = await page.evaluate(() => {
    const parent = Array.from(document.querySelectorAll('.menu-sidebar__content > div')).find(d => d.innerText.includes('Báo cáo'));
    if (!parent) return { found: false };
    const links = Array.from(parent.querySelectorAll('li, div[role="button"]')).map(l => l.innerText ? l.innerText.trim() : '');
    return { found: true, links: [...new Set(links)] };
  });
  console.log('Báo cáo children:', JSON.stringify(baoCaoChildren, null, 2));

  // Test clicking Monitor ME
  console.log('Clicking "Monitor ME"...');
  const monitorBtn = page.locator(".menu-sidebar__content >> xpath=.//*[normalize-space(text())='Monitor ME']").first();
  await monitorBtn.click({ force: true });
  await page.waitForTimeout(2000);
  console.log('URL after clicking Monitor ME:', page.url());

  // Find all sibling/clickable items in that container
  const allTexts = await page.evaluate(() => {
    // Find the left menu container
    const allDivs = Array.from(document.querySelectorAll('div, nav, aside, ul'));
    const leftBar = allDivs.find(d => d.innerText && d.innerText.includes('Quản lý tham số') && d.innerText.includes('Quản lý FCM') && d.innerText.includes('Báo cáo') && d.clientWidth < 400 && d.clientWidth > 100);
    if (!leftBar) return { leftBarFound: false };
    
    // Find all clickable children or direct menu item nodes
    const items = Array.from(leftBar.querySelectorAll('[role="button"], a, li, .MuiListItem-root, .MuiButtonBase-root')).map(x => ({
      text: x.innerText ? x.innerText.trim().replace(/\n+/g, ' ') : '',
      tag: x.tagName,
      class: x.className,
      role: x.getAttribute('role'),
    })).filter(x => x.text.length > 0);

    return {
      leftBarTag: leftBar.tagName,
      leftBarClass: leftBar.className,
      leftBarWidth: leftBar.clientWidth,
      totalItems: items.length,
      sampleItems: items.slice(0, 25)
    };
  });
  console.log('LeftBar info:', JSON.stringify(allTexts, null, 2));

  await browser.close();
}
probe().catch(console.error);
