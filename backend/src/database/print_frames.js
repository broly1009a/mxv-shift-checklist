const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const USERNAME = 'mxvanhdao';
const PASSWORD = 'Mxv@2026Q3';
const LOGIN_URL = 'https://www.cqgtrader.com/CAST/Logon/Logon.asp';

const IE_MOCK_SCRIPT = `
  // Mock localeinfoproviderObj (IE ActiveX COM object) using Object.defineProperty to override HTMLObjectElement
  Object.defineProperty(window, 'localeinfoproviderObj', {
    value: {
      ShortDateFormat:   'MM/dd/yyyy',
      TimeFormat:        'hh:mm:ss tt',
      DecimalPoint:      '.',
      ThousandSeparator: ',',
      DigitsGrouping:    '3;0',
      DigitsAfterDecimal: 2
    },
    writable: true,
    configurable: true
  });

  // Mock window.event
  if (typeof window.event === 'undefined') {
    Object.defineProperty(window, 'event', {
      get: function() { return { keyCode: 0 }; },
      configurable: true
    });
  }

  // Override document.getElementById to emulate IE's behavior of matching 'name' when 'id' is not found
  const originalGetElementById = document.getElementById;
  document.getElementById = function(id) {
    let el = originalGetElementById.call(document, id);
    if (!el) {
      const elements = document.getElementsByName(id);
      if (elements.length > 0) {
        el = elements[0];
      }
    }
    return el;
  };
`;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: null,
    acceptDownloads: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko',
  });

  await context.addInitScript(IE_MOCK_SCRIPT);

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log('Navigating to login...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    console.log('Filling credentials...');
    await page.locator('#userNameInput').fill(USERNAME);
    await page.locator('#passwordInput').fill(PASSWORD);
    await page.waitForTimeout(500);

    console.log('Calling doLogon()...');
    await page.evaluate(() => {
      window.doLogon();
    });

    console.log('Waiting for login redirect...');
    await page.waitForNavigation({
      url: url => !url.href.includes('Logon'),
      timeout: 30000,
    });

    console.log('Logged in successfully! Current URL:', page.url());
    console.log('Waiting 8 seconds for all frames to load fully...');
    await page.waitForTimeout(8000);

    const allFrames = page.frames();
    console.log(`\nFound ${allFrames.length} frames:`);

    for (let i = 0; i < allFrames.length; i++) {
      const frame = allFrames[i];
      const url = frame.url();
      const name = frame.name();
      console.log(`\n[Frame ${i}] Name: "${name}", URL: ${url}`);
      
      try {
        const html = await frame.content();
        console.log(`  Content length: ${html.length} bytes`);
        
        // Let's search for some keywords in this frame's HTML
        const keywords = ['Reporting', 'report', 'Reporting Tool', 'Accounts', 'Balance'];
        for (const kw of keywords) {
          if (html.toLowerCase().includes(kw.toLowerCase())) {
            console.log(`  -> Contains keyword: "${kw}"`);
          }
        }

        // Find all links in the frame
        const linksCount = await frame.locator('a').count();
        if (linksCount > 0) {
          console.log(`  Found ${linksCount} links. Printing first 10 links:`);
          const links = await frame.locator('a').all();
          for (let j = 0; j < Math.min(10, links.length); j++) {
            const text = await links[j].innerText().catch(() => '');
            const href = await links[j].getAttribute('href').catch(() => '');
            console.log(`    Link ${j}: "${text.trim()}" -> href="${href}"`);
          }
        }
      } catch (err) {
        console.log(`  Could not read content of Frame ${i}: ${err.message}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

main();
