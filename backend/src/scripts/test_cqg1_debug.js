const { Client } = require('ssh2');

const testScript = `
require('dotenv').config({ path: '/opt/mxv-checklist/backend/.env' });
const { chromium } = require('playwright-core');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
const getSecretKey = () => crypto.createHash('sha256').update(rawKey).digest();

function decrypt(text) {
  if (!text) return '';
  const parts = text.split(':');
  if (parts.length < 2) return text;
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getSecretKey(), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist');
  await client.connect();
  const setting = await client.db().collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
  await client.close();

  const creds = JSON.parse(decrypt(setting.value));
  console.log('CQG URL:', creds.url);
  console.log('User 1:', creds.username1 || creds.usernameCQG1);
  console.log('User 2:', creds.username2 || creds.usernameCQG2);

  const u2 = creds.username2 || creds.usernameCQG2;
  const p2 = creds.password2 || creds.passwordCQG2;

  const profileDir = '/opt/mxv-checklist/backend/temp/cqg_profile_debug2';
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled'],
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  page.setDefaultTimeout(60000);

  console.log('Navigating to', creds.url);
  try {
    await page.goto(creds.url, { waitUntil: 'commit', timeout: 30000 });
  } catch (e) {
    console.log('Goto commit warning:', e.message);
  }
  console.log('Checking page state for 30s...');
  for (let i = 1; i <= 10; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const url = page.url();
    const title = await page.title().catch(() => '');
    const hasLogin = await page.locator('input[name="userName"]').isVisible().catch(() => false);
    const hasLogo = await page.locator('div.wpfe-logo-image').isVisible().catch(() => false);
    if (hasLogin || hasLogo) break;
  }

  console.log('Filling user 2:', u2);
  await page.fill('input[name="userName"]', u2);
  await page.fill('input[name="password"]', p2);
  await page.waitForTimeout(500);
  console.log('Submitting via Enter key...');
  await page.keyboard.press('Enter');

  console.log('Submitted. Waiting up to 90s for 24,513 accounts to load and dashboard to appear...');
  for (let i = 1; i <= 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const url = page.url();
    const hasLogo = await page.locator('div.wpfe-logo-image').isVisible().catch(() => false);
    const hasHome = await page.locator("//div[text()='Ho']").isVisible().catch(() => false);
    const hasSpinner = await page.locator('.wpfe-pre-bootstrap-loading-spinner-container, .wpfe-app-loading-image, button .spinner, .mat-progress-spinner').count().catch(() => 0);
    const dialogs = await page.locator('div[role="dialog"], .modal-dialog, .wpfe-dialog, .wpfe-message-box').count().catch(() => 0);
    const btns = await page.locator('button').allInnerTexts().catch(() => []);
    
    // Auto dismiss notification x
    const notifClose = page.locator('//wpfe-multi-snack-bar-container//button | //button[contains(@class,"wpfe-dialog-close-button-button")] | .mat-snack-bar-container button');
    if (await notifClose.first().isVisible().catch(() => false)) {
      console.log('Dismissing notification toast...');
      await notifClose.first().click().catch(() => {});
    }

    console.log(\`[\${i*3}s] URL: \${url} | Logo: \${hasLogo} | Ho: \${hasHome} | Spinners: \${hasSpinner} | Dialogs: \${dialogs} | Buttons: \${JSON.stringify(btns)}\`);

    if (hasLogo || hasHome) {
      console.log('🎉 SUCCESS: Dashboard reached!');
      const successSnap = '/opt/mxv-checklist/backend/temp/debug/cqg1_dashboard_reached.png';
      await page.screenshot({ path: successSnap, fullPage: true }).catch(() => {});
      console.log('Saved success screenshot:', successSnap);
      break;
    }

    // Check takeover buttons
    const takeoverBtn = page.locator('button:has-text("Logoff"), button:has-text("Log off"), button:has-text("Disconnect"), button:has-text("Continue"), button:has-text("Yes"), button:has-text("OK")');
    if (await takeoverBtn.first().isVisible().catch(() => false)) {
      const text = await takeoverBtn.first().innerText();
      console.log(\`Clicking takeover button: "\${text}"\`);
      await takeoverBtn.first().click().catch(() => {});
    }
  }

  const finalSnap = '/opt/mxv-checklist/backend/temp/debug/cqg1_login_final.png';
  await page.screenshot({ path: finalSnap, fullPage: true }).catch(() => {});
  console.log('Saved final screenshot to:', finalSnap);
  await context.close();
}

run().catch(console.error);
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const ws = sftp.createWriteStream('/opt/mxv-checklist/backend/test_cqg1_debug.js');
    ws.on('close', () => {
      conn.exec('cd /opt/mxv-checklist/backend && node test_cqg1_debug.js', (e, stream) => {
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => {
          conn.exec('rm -f /opt/mxv-checklist/backend/test_cqg1_debug.js', () => conn.end());
        });
      });
    });
    ws.end(testScript);
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
