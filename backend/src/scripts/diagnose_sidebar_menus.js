const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) throw new Error('Format mã hóa không hợp lệ (thiếu IV)');
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';
  await mongoose.connect(uri);
  const setting = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });
  await mongoose.disconnect();
  const creds = JSON.parse(decrypt(setting.value));

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto(creds.url || 'https://msadmin.mxv.com.vn/#/login');
  await page.waitForTimeout(2000);

  if (await page.locator('input[name="username"]').isVisible()) {
    await page.fill('input[name="username"]', creds.username);
    await page.fill('input[name="password"]', creds.password);
    await page.click('button.btn-primary');
    await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 });
    for (const digit of (creds.pin || '123456').split('')) {
      await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
      await page.waitForTimeout(300);
    }
    await page.waitForSelector("xpath=//*[contains(text(), 'QL hệ thống') or contains(text(), 'QL trạng thái')]", { timeout: 30000 });
  }

  console.log('Login OK. Current URL:', page.url());

  // 1. Inspect all nav-link items on the sidebar
  const navItems = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('aside a, nav.sidebar-nav a, .sidebar a, a.nav-link'));
    return links.map(a => ({
      text: a.innerText ? a.innerText.trim().replace(/\n+/g, ' ') : '',
      href: a.getAttribute('href') || '',
      className: a.className,
      parentClass: a.parentElement ? a.parentElement.className : '',
    })).filter(x => x.text.length > 0);
  });
  console.log('\n--- ALL SIDEBAR LINKS IN DOM ---');
  navItems.forEach((item, idx) => {
    console.log(`[${idx + 1}] "${item.text}" -> href: "${item.href}" (parent: ${item.parentClass})`);
  });

  // 2. Test Direct Hash navigation for NR
  console.log('\n--- TESTING DIRECT HASH FOR NR ---');
  await page.goto('https://msadmin.mxv.com.vn/#/clientManagement/transactionHistory');
  await page.waitForTimeout(2500);
  console.log('URL after goto transactionHistory:', page.url());

  // 3. Test Direct Hash for orderList
  console.log('\n--- TESTING DIRECT HASH FOR ORDERLIST ---');
  await page.goto('https://msadmin.mxv.com.vn/#/orderManagement/orderList');
  await page.waitForTimeout(2500);
  console.log('URL after goto orderList:', page.url());
  const orderTabs = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.el-tabs__item, .nav-tabs a, div[role="tab"]'));
    return tabs.map(t => t.innerText ? t.innerText.trim() : '');
  });
  console.log('Order list tabs found:', orderTabs);

  await browser.close();
}

main().catch(console.error);
