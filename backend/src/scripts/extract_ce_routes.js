const { chromium } = require('playwright-core');
const mongoose = require('mongoose');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
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

async function extractRoutes() {
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
  await page.waitForTimeout(4000);

  // 1. Fetch script bundles and search for menu definitions
  const scriptUrls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
  });

  console.log('Script URLs found:', scriptUrls);

  const foundRoutes = new Set();
  const menuConfig = [];

  for (const url of scriptUrls) {
    const filename = url.split('/').pop().split('?')[0];
    try {
      const text = await page.evaluate(async (u) => {
        const r = await fetch(u);
        return await r.text();
      }, url);

      // Search for path definitions: path: "/..." or to: "/..." or url: "/..."
      const pathMatches = text.match(/(?:path|to|url|href|route):\s*["'](\/[a-zA-Z0-9_\-\/]+)["']/g);
      if (pathMatches) {
        pathMatches.forEach(m => {
          const match = m.match(/["'](\/[a-zA-Z0-9_\-\/]+)["']/);
          if (match && match[1] && match[1].length > 2 && !match[1].startsWith('/static') && !match[1].startsWith('/api')) {
            foundRoutes.add(match[1]);
          }
        });
      }

      // Also regex for UPPERCASE routes: "/ORDERS/...", "/SYSCONFIGMNG/...", etc.
      const upperMatches = text.match(/["'](\/[A-Z0-9_]{3,30}(\/[A-Z0-9_]{3,30})*)["']/g);
      if (upperMatches) {
        upperMatches.forEach(m => {
          const clean = m.replace(/["']/g, '');
          if (!clean.startsWith('/API') && !clean.startsWith('/STATIC')) {
            foundRoutes.add(clean);
          }
        });
      }
    } catch (e) {
      console.log('Error fetching script:', filename, e.message);
    }
  }

  console.log('\n--- ALL UPPERCASE / SYSTEM ROUTES DISCOVERED FROM BUNDLES ---');
  const sortedRoutes = Array.from(foundRoutes).sort();
  sortedRoutes.forEach(r => console.log(r));

  // 2. Now let's map each route to its exact menu name by clicking with scrollIntoViewIfNeeded
  console.log('\n--- MAPPING SIDEBAR CLICKS TO ACTUAL ROUTES ---');
  // Expand sidebar
  await page.click("button[aria-label='Chuyển đổi menu']");
  await page.waitForTimeout(1000);

  // Get all clickable items by selector and text
  const menuTree = await page.evaluate(() => {
    const list = document.querySelector('.menu-sidebar__content');
    const parents = Array.from(list.children);
    const result = [];

    for (let pIdx = 0; pIdx < parents.length; pIdx++) {
      const p = parents[pIdx];
      const pBtn = p.querySelector('div[role="button"]');
      const pText = pBtn ? pBtn.innerText.trim() : '';
      if (!pText) continue;

      result.push({
        pIdx,
        parentText: pText,
      });
    }
    return result;
  });

  const fullMap = [];

  for (const parent of menuTree) {
    if (parent.parentText === 'Trang chủ') {
      fullMap.push({ parent: 'Trang chủ', child: 'Dashboard', url: '/DASHBOARD' });
      continue;
    }
    if (parent.parentText === 'Monitor ME') {
      fullMap.push({ parent: 'Monitor ME', child: 'Monitor ME', url: '/MONITOR_ME' });
      continue;
    }
    if (parent.parentText === 'Báo cáo') {
      fullMap.push({ parent: 'Báo cáo', child: 'Báo cáo', url: '/REPORTS' });
      continue;
    }

    console.log(`\nExpanding Parent: "${parent.parentText}"...`);
    // Click parent to expand
    const pBtn = page.locator(`.menu-sidebar__content > div:nth-child(${parent.pIdx + 1}) >> div[role='button']`).first();
    await pBtn.scrollIntoViewIfNeeded();
    await pBtn.click({ force: true });
    await page.waitForTimeout(600);

    // Get children of this parent
    const children = await page.evaluate((pIdx) => {
      const list = document.querySelector('.menu-sidebar__content');
      const p = list.children[pIdx];
      const childEls = Array.from(p.querySelectorAll('ul li div[role="button"], [class*="MuiCollapse"] li div[role="button"]'));
      return childEls.map((c, cIdx) => ({
        cIdx,
        text: c.innerText ? c.innerText.trim() : '',
      })).filter(c => c.text.length > 0);
    }, parent.pIdx);

    console.log(`Found ${children.length} children under "${parent.parentText}"`);

    for (const child of children) {
      try {
        const childBtn = page.locator(`.menu-sidebar__content > div:nth-child(${parent.pIdx + 1}) >> [class*="MuiCollapse"] li >> div[role='button']`).nth(child.cIdx);
        await childBtn.scrollIntoViewIfNeeded();
        await childBtn.click({ force: true });
        await page.waitForTimeout(1500);

        const currentUrl = page.url().replace('https://uat-coreexchange.mxv.com.vn', '');
        console.log(`  -> [${parent.parentText}] "${child.text}" => ${currentUrl}`);
        fullMap.push({
          parent: parent.parentText,
          child: child.text,
          url: currentUrl,
        });
      } catch (err) {
        console.log(`  -> Error clicking "${child.text}": ${err.message}`);
      }
    }
  }

  console.log('\n--- FINAL VERIFIED MENU TO URL MAP ---');
  console.table(fullMap);
  fs.writeFileSync(path.join(__dirname, 'ce_exact_menu_url_map.json'), JSON.stringify(fullMap, null, 2), 'utf8');

  await browser.close();
}

extractRoutes().catch(console.error);
