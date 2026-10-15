import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { chromium, Browser, BrowserContext, Page, LaunchOptions } from 'playwright-core';

export class BrowserLauncherHelper {
  private static readonly logger = new Logger(BrowserLauncherHelper.name);

  /**
   * Retrieves the Chrome/Edge executable path across Windows and Linux.
   */
  static getChromeExecutablePath(): string | null {
    if (process.platform === 'win32') {
      const candidates = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(
          process.cwd(),
          '..',
          'it-tool-src',
          'operate-transaction-app',
          'Chrome',
          'chrome-win',
          'chrome.exe',
        ),
        path.join(
          process.cwd(),
          'it-tool-src',
          'operate-transaction-app',
          'Chrome',
          'chrome-win',
          'chrome.exe',
        ),
        'C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\it-tool-src\\operate-transaction-app\\Chrome\\chrome-win\\chrome.exe',
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          this.logger.log(`Using Chrome/Edge binary at: ${p}`);
          return p;
        }
      }
      this.logger.warn('No system Edge/Chrome or bundled Chrome found on Windows.');
    } else {
      const linuxCandidates = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/snap/bin/chromium',
      ];
      for (const p of linuxCandidates) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
    }
    return null;
  }

  /**
   * Tạo Browser session Playwright chuẩn cho bot cào dữ liệu
   */
  static async launchBrowser(options?: {
    headless?: boolean;
    downloadsPath?: string;
  }): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
    const executablePath = this.getChromeExecutablePath();
    const isHeadless =
      options?.headless ??
      (process.env.HEADLESS_BOT !== 'false' && process.env.PLAYWRIGHT_HEADLESS !== 'false');

    const launchOptions: LaunchOptions = {
      headless: isHeadless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--window-size=1280,800',
      ],
    };

    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    page.setDefaultTimeout(30000);
    return { browser, context, page };
  }
}
