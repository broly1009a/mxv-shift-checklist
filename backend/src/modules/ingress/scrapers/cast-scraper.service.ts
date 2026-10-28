import { Injectable, Logger, Optional } from '@nestjs/common';
import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';
import { BrowserLauncherHelper } from '../helpers/browser-launcher.helper';
import { IE_MOCK_SCRIPT } from '../helpers/ie-mock.script';
import { decrypt } from '../../../shared';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

export interface ICastLoginCredentials {
  url?: string;
  username: string;
  password?: string;
  fcm?: string;
  currency?: string;
  desc?: string;
}

/**
 * CastScraperService (Modular Monolith V2)
 * Service chuyên biệt chịu trách nhiệm cào dữ liệu báo cáo số dư từ cổng CQG CAST (Web ASP cổ điển).
 * Đóng gói độc lập toàn bộ script IE Mock, request interception, và cơ chế Fail-Fast bắt lỗi đăng nhập.
 */
@Injectable()
export class CastScraperService {
  private readonly logger = new Logger(CastScraperService.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  /**
   * Lấy cấu hình tài khoản CQG CAST từ MongoDB (bot_credentials_cast) hoặc .env
   */
  public async getCastCredentials(): Promise<ICastLoginCredentials> {
    let credentialsRaw = '';
    if (this.settingsService) {
      credentialsRaw = await this.settingsService.getSetting(
        'bot_credentials_cast',
        '',
      );
    }

    if (!credentialsRaw && process.env.CAST_CREDENTIALS) {
      credentialsRaw = process.env.CAST_CREDENTIALS;
    }

    if (!credentialsRaw) {
      throw new Error(
        'Chưa cấu hình tài khoản CQG CAST trong cài đặt hệ thống (bot_credentials_cast).',
      );
    }

    let credentials: any;
    try {
      credentials = JSON.parse(decrypt(credentialsRaw));
    } catch {
      throw new Error(
        'Không thể giải mã cấu hình tài khoản CQG CAST. Vui lòng kiểm tra lại cấu hình.',
      );
    }

    return {
      url: credentials.url || 'https://www.cqgtrader.com/CAST/Logon/Logon.asp',
      username: credentials.username || '',
      password: credentials.password || '',
      fcm: credentials.fcm || 'MXV',
      currency: credentials.currency || 'USD',
      desc: credentials.desc || 'current',
    };
  }

  /**
   * Tự động đăng nhập CQG CAST và tải Accounts_Balances.xlsx
   */
  async downloadCastBalances(
    destFile: string,
    customCreds?: ICastLoginCredentials,
    onLog?: (msg: string) => void,
  ): Promise<string> {
    const creds = customCreds || (await this.getCastCredentials());
    const castUrl = creds.url || 'https://www.cqgtrader.com/CAST/Logon/Logon.asp';
    const { username, password } = creds;
    const fcm = creds.fcm || 'MXV';
    const currency = creds.currency || 'USD';
    const desc = creds.desc || 'current';

    if (!username || !password) {
      throw new Error(
        'Thông tin đăng nhập CQG CAST (username, password) không đầy đủ.',
      );
    }

    const executablePath = BrowserLauncherHelper.getChromeExecutablePath();
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    this.logger.log(`Starting Playwright session for CQG CAST (${username})...`);
    if (onLog) onLog(`Khởi chạy trình duyệt cào dữ liệu CQG CAST cho tài khoản: ${username}...`);

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
      acceptDownloads: true,
      // Dùng User-Agent IE11 để tránh cảnh báo trình duyệt của CAST
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko',
    });

    // Register Mock Script
    await context.addInitScript({ content: IE_MOCK_SCRIPT });

    const page = await context.newPage();
    page.setDefaultTimeout(45000);

    // Pipe browser console messages and errors to NestJS logger
    page.on('console', (msg) => {
      this.logger.log(`[CAST-Browser] [${msg.type()}] ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      this.logger.error(`[CAST-BrowserError] ${err.message}`);
    });

    let searchFrameXmlText = '';
    let userIndexXmlText = '';

    // Intercept XML/XSL/ASP requests to clean leading whitespace/BOM characters before the browser engine parses them
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = request.url().toLowerCase();

      const isAsp = url.includes('.asp') && !url.includes('.aspx');
      if (url.includes('.xml') || url.includes('.xsl') || isAsp) {
        try {
          const response = await route.fetch();
          const contentType = (
            response.headers()['content-type'] || ''
          ).toLowerCase();

          if (
            contentType.includes('xml') ||
            contentType.includes('xsl') ||
            contentType.includes('text') ||
            isAsp
          ) {
            const rawBody = await response.text();
            let cleanedBody = rawBody.replace(/^\s+/, '').trimStart();

            if (url.includes('searchframe.xml.asp')) {
              searchFrameXmlText = cleanedBody;
            }
            if (
              url.includes('userindex.asp') &&
              !url.includes('userindex.xsl.asp') &&
              !url.includes('userindex.js.asp')
            ) {
              userIndexXmlText = cleanedBody;
            }

            // Translate obsolete Microsoft WD-xsl to standard W3C XSLT 1.0
            if (
              url.includes('.xsl') ||
              cleanedBody.includes('http://www.w3.org/TR/WD-xsl')
            ) {
              cleanedBody = cleanedBody.replace(
                /http:\/\/www\.w3\.org\/TR\/WD-xsl/g,
                'http://www.w3.org/1999/XSL/Transform',
              );
              // Fix legacy WD-xsl style node/attribute test .[@attr='val'] -> @attr='val'
              cleanedBody = cleanedBody.replace(/\.\[@([^\]]+)\]/g, '@$1');
            }

            // Inject the source XML text of SearchFrame.xml.asp into SearchFrame.xsl.asp
            if (url.includes('searchframe.xsl.asp') && searchFrameXmlText) {
              const b64 = Buffer.from(searchFrameXmlText).toString('base64');
              cleanedBody = cleanedBody.replace(
                `<script type='text/javascript' src='/CAST/Script/DataScripts.js.asp'></script>`,
                `<script type='text/javascript'>window.__originalXMLText = atob('${b64}');</script>\n<script type='text/javascript' src='/CAST/Script/DataScripts.js.asp'></script>`,
              );
            }

            // Inject the source XML text of UserIndex.xml.asp into UserIndex.xsl.asp
            if (url.includes('userindex.xsl.asp') && userIndexXmlText) {
              const b64 = Buffer.from(userIndexXmlText).toString('base64');
              cleanedBody = cleanedBody.replace(
                /<script\s+language=["']JScript["']\s+src=["']UserIndex\.js\.asp\?language=EN["']\s+charset=["']UTF-8["']>/i,
                `<SCRIPT TYPE="text/javascript">window.__originalXMLText = atob('${b64}');</SCRIPT>\n<SCRIPT LANGUAGE="JScript" SRC="UserIndex.js.asp?language=EN" charset="UTF-8">`,
              );
            }

            if (url.includes('userindex.js.asp')) {
              // Fix event handler parameter
              cleanedBody = cleanedBody.replace(
                /function anonymous\s*\(\s*\)/g,
                'function anonymous(event)',
              );

              // Fix jumpToLink event srcElement resolution
              cleanedBody = cleanedBody.replace(
                /if\s*\(\s*obj\s*==\s*null\s*\)\s*\r?\n?\s*obj\s*=\s*event\.srcElement\s*;/g,
                `var event = window.event;
                if (obj == null) obj = event ? (event.srcElement || event.target) : null;
                if (!obj) return;`,
              );

              // Add null guards to all obj.tagName and obj.pageLink checks
              cleanedBody = cleanedBody.replace(
                /if\s*\(\s*obj\.tagName/g,
                'if (obj && obj.tagName',
              );
              cleanedBody = cleanedBody.replace(
                /if\s*\(\s*event\s*!=\s*null/g,
                'if (typeof event !== "undefined" && event != null',
              );

              // Fix IE document.all(id) -> document.getElementById(id)
              cleanedBody = cleanedBody.replace(
                /dataFrameLink\.document\.all\(([^)]+)\)/g,
                'dataFrameLink.document.getElementById($1)',
              );

              // Fix &amp; literal check
              cleanedBody = cleanedBody.replace(
                /obj\.pageLink\.slice\(-5\) == "&amp;"/g,
                '(obj.pageLink.slice(-5) === "&amp;" || obj.pageLink.slice(-1) === "&")',
              );

              // Wrap searchFrameLink.show() in try/catch
              cleanedBody = cleanedBody.replace(
                /searchFrameLink\.show\(/g,
                'try { searchFrameLink.show(',
              );
              cleanedBody = cleanedBody.replace(
                /(searchFrameLink\.show\([^;]+;)/g,
                '$1 } catch(e) { console.warn("[IE-MOCK] searchFrameLink.show failed:", e.message); }',
              );
            }

            await route.fulfill({
              response,
              body: cleanedBody,
              headers: {
                ...response.headers(),
                'content-type': url.includes('xsl')
                  ? 'text/xml'
                  : response.headers()['content-type'],
              },
            });
            return;
          }
        } catch (e: any) {
          if (
            !e.message.includes('disposed') &&
            !e.message.includes('closed')
          ) {
            this.logger.error(
              `[XML-ROUTE-ERROR] Failed to clean ${request.url()}: ${e.message}`,
            );
          }
        }
      }

      await route.continue().catch(() => { });
    });

    try {
      this.logger.log(`Navigating to CQG CAST at ${castUrl}...`);
      await page.goto(castUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Điền thông tin đăng nhập
      await page.locator('#userNameInput').fill(username);
      await page.locator('#passwordInput').fill(password);
      await page.waitForTimeout(500);

      // Chờ Logon.js.asp load xong để gọi doLogon()
      await page.waitForFunction(
        () => typeof (window as any).doLogon === 'function',
        { timeout: 10000 },
      );
      await page.evaluate(() => {
        (window as any).doLogon();
      });

      // Chờ chuyển hướng sau đăng nhập hoặc phát hiện lỗi đăng nhập (Fail-Fast)
      this.logger.log('Chờ phản hồi sau khi gửi form đăng nhập CQG CAST...');
      const waitRedirect = page.waitForURL('**/CastMain.asp', { timeout: 30000 }).then(() => 'SUCCESS' as const);
      const waitLoginFailed = page
        .waitForSelector("text='Logon failed. Please try again', text='Logon failed', //td[contains(text(), 'Logon failed')]", { timeout: 8000 })
        .then(() => 'FAILED' as const)
        .catch(() => 'CONTINUE' as const);

      const navState = await Promise.race([waitRedirect, waitLoginFailed]);
      if (navState === 'FAILED') {
        throw new Error(`Đăng nhập CQG CAST thất bại cho tài khoản "${username}": Hệ thống báo "Logon failed. Please try again" (Sai mật khẩu hoặc tài khoản CAST bị khóa).`);
      }
      if (navState !== 'SUCCESS') {
        await waitRedirect.catch((waitErr) => {
          throw new Error(`Đăng nhập CQG CAST không thành công sau 30s chờ chuyển hướng: ${waitErr.message}`);
        });
      }
      this.logger.log('Đăng nhập CQG CAST thành công!');
      if (onLog) onLog('Đăng nhập CQG CAST thành công, đang điều hướng menu báo cáo...');

      // Đợi thêm 5 giây để frameset và menu XML tải hoàn toàn
      await page.waitForTimeout(5000);

      // Tìm frame userIndex (menu frame bên trái)
      const allFrames = page.frames();
      let userIndexFrame = allFrames.find(
        (f) => f.name() === 'userIndex' || f.url().includes('UserIndex.asp'),
      );
      if (!userIndexFrame) {
        for (const f of allFrames) {
          const childFrames = f.childFrames();
          const found = childFrames.find(
            (cf) =>
              cf.name() === 'userIndex' || cf.url().includes('UserIndex.asp'),
          );
          if (found) {
            userIndexFrame = found;
            break;
          }
        }
      }

      if (userIndexFrame) {
        this.logger.log(`Found userIndex frame: ${userIndexFrame.url()}`);

        // Tìm span LEAFITEM "Reporting Tool" và navigate dataFrame trực tiếp
        const result = await userIndexFrame.evaluate(() => {
          const spans = Array.from(document.querySelectorAll('span.LEAFITEM'));
          const target = spans.find(
            (s) => s.textContent && s.textContent.trim() === 'Reporting Tool',
          );
          if (!target) {
            return { found: false };
          }
          const pageLink =
            (target as any).getAttribute('pageLink') ||
            (target as any).pageLink;
          const win = window as any;

          try {
            const df =
              win.parent &&
              win.parent.parent &&
              win.parent.parent.innerFrame &&
              win.parent.parent.innerFrame.dataFrame;
            if (df) {
              df.location.href = pageLink;
              return { found: true, pageLink, navigated: true };
            }
          } catch (e: any) {
            return {
              found: true,
              pageLink,
              navigated: false,
              error: e.message,
            };
          }
          return { found: true, pageLink, navigated: false };
        });

        this.logger.log(
          `Reporting Tool link evaluation result: ${JSON.stringify(result)}`,
        );
        await page.waitForTimeout(3000);
      } else {
        this.logger.warn(
          'Could not find userIndex frame, falling back to direct navigation...',
        );
        const castBase = new URL(castUrl).origin;
        await page
          .goto(`${castBase}/CAST/ReportingTool/ReportingTool.asp`, {
            timeout: 20000,
          })
          .catch(() => { });
      }

      // Tìm main frame chứa form
      let dataFrame = page
        .frames()
        .find(
          (f) => f.name() === 'dataFrame' || f.url().includes('ReportingTool'),
        );
      if (!dataFrame) {
        await page.waitForTimeout(2000);
        dataFrame = page
          .frames()
          .find(
            (f) =>
              f.name() === 'dataFrame' || f.url().includes('ReportingTool'),
          );
      }

      if (dataFrame) {
        this.logger.log(`Target dataFrame found: ${dataFrame.url()}`);
        await dataFrame.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);

        // Chọn template "Accounts: Balances"
        const selectResult = await dataFrame.evaluate(() => {
          const doc = document as any;
          const win = window as any;

          // Tìm template dropdown
          const templateSelect =
            doc.getElementById('ctl00_mainContent_ddlTemplates') ||
            doc.querySelector('select[name*="Template"]') ||
            doc.querySelector('select[id*="Template"]') ||
            Array.from(doc.querySelectorAll('select')).find((s: any) =>
              Array.from(s.options).some((o: any) =>
                o.text.includes('Balances'),
              ),
            );

          if (!templateSelect) {
            return { error: 'Template select not found' };
          }

          // Tìm option có text "Balances"
          const balancesOption = Array.from(templateSelect.options).find(
            (o: any) => o.text.includes('Balances'),
          ) as any;

          if (!balancesOption) {
            return { error: 'Balances option not found' };
          }

          // Chọn template
          templateSelect.value = balancesOption.value;

          // Tìm hidden selectedReport field
          const selectedReport =
            doc.getElementById('ctl00_mainContent_selectedReport') ||
            doc.querySelector('input[name*="selectedReport"]');

          // Gọi reportTemplateChanged để trigger postback
          if (typeof win.reportTemplateChanged === 'function') {
            win.reportTemplateChanged(
              templateSelect,
              selectedReport || { value: '' },
            );
            return {
              triggered: 'reportTemplateChanged',
              value: balancesOption.value,
            };
          }

          templateSelect.dispatchEvent(new Event('change', { bubbles: true }));
          return { triggered: 'change event', value: balancesOption.value };
        });

        this.logger.log(
          `Template selection result: ${JSON.stringify(selectResult)}`,
        );

        if (selectResult && !selectResult.error && selectResult.triggered) {
          this.logger.log(
            'Waiting for postback/reload after selecting template...',
          );
          try {
            await dataFrame.waitForNavigation({
              timeout: 15000,
              waitUntil: 'domcontentloaded',
            });
          } catch (e) {
            await page.waitForTimeout(3000);
          }
        }

        // Lấy lại dataFrame sau reload
        dataFrame =
          page
            .frames()
            .find(
              (f) =>
                f.name() === 'dataFrame' || f.url().includes('ReportingTool'),
            ) || dataFrame;
        await page.waitForTimeout(2000);

        // Điền các bộ lọc và click saveButton
        this.logger.log(
          `Injecting filters: FCM=${fcm}, Currency=${currency}, Record Description=${desc}`,
        );
        await dataFrame.evaluate(
          ({ fcmVal, curVal, descVal }) => {
            const win = window as any;
            const doc = document;
            const $ = win.jQuery;

            // Polyfill / Mock cho biến global cblist$ của ASP.NET WebForms
            doc.querySelectorAll('select[onchange]').forEach((sel) => {
              const onchangeAttr = sel.getAttribute('onchange') || '';
              const match = onchangeAttr.match(/cblist\$\d+/);
              if (match) {
                const varName = match[0];
                if (!(varName in win)) {
                  const row = sel.closest('tr');
                  const cbContainer = row
                    ? row.querySelector('[data-js="dictionary-checkboxes"]')
                    : null;
                  win[varName] = cbContainer || {};
                  console.log(
                    `[FILTER-PATCH] Defined dummy global for ${varName}`,
                  );
                }
              }
            });

            // Helper to set select value
            const setSelectValue = (row: any, value: string) => {
              const select = row.querySelector(
                '[data-js="filter-operation"] select',
              );
              if (select) {
                select.value = value;
                select.dispatchEvent(new Event('change', { bubbles: true }));
              }
            };

            // 1. FCM -> MXV
            const fcmRow = Array.from(
              doc.querySelectorAll('tr#reportDetailName'),
            ).find((tr) => {
              const nameEl = tr.querySelector('[data-js="name"]');
              return nameEl && nameEl.textContent.trim() === 'FCM';
            });
            if (fcmRow) {
              const mxvCheckbox = Array.from(
                fcmRow.querySelectorAll('input[type="checkbox"]'),
              ).find((cb) => {
                const label = cb.closest('label') || cb.parentElement;
                return (
                  label &&
                  label.textContent.trim().toUpperCase() ===
                  fcmVal.toUpperCase()
                );
              }) as HTMLInputElement;

              if (mxvCheckbox) {
                mxvCheckbox.checked = true;
                mxvCheckbox.dispatchEvent(
                  new Event('change', { bubbles: true }),
                );

                try {
                  const select2El = fcmRow.querySelector(
                    'select[data-js="dictionary"]',
                  );
                  if (select2El && $) {
                    const val = mxvCheckbox.id;
                    let opt = Array.from(
                      (select2El as HTMLSelectElement).options,
                    ).find((o) => o.value === val);
                    if (!opt) {
                      opt = doc.createElement('option');
                      opt.value = val;
                      opt.text = fcmVal;
                      select2El.appendChild(opt);
                    }
                    opt.selected = true;
                    $(select2El).val([val]).trigger('change');
                  }
                } catch (e) { }
              }
              setSelectValue(fcmRow, '2'); // Equals (2)
            }

            // 2. Currency -> USD
            const currencyRow = Array.from(
              doc.querySelectorAll('tr#reportDetailName'),
            ).find((tr) => {
              const nameEl = tr.querySelector('[data-js="name"]');
              return nameEl && nameEl.textContent.trim() === 'Currency';
            });
            if (currencyRow) {
              const input = currencyRow.querySelector(
                '[data-js="value"] input[type="text"]',
              ) as HTMLInputElement;
              if (input) {
                input.value = curVal;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
              setSelectValue(currencyRow, '1'); // Like (1)
            }

            // 3. Record Description -> current
            const rdRow = Array.from(
              doc.querySelectorAll('tr#reportDetailName'),
            ).find((tr) => {
              const nameEl = tr.querySelector('[data-js="name"]');
              return (
                nameEl && nameEl.textContent.trim() === 'Record Description'
              );
            });
            if (rdRow) {
              const input = rdRow.querySelector(
                '[data-js="value"] input[type="text"]',
              ) as HTMLInputElement;
              if (input) {
                input.value = descVal;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
              setSelectValue(rdRow, '1'); // Like (1)
            }

            // Override checkPage to bypass validations and trigger report generation
            win.checkPage = function () {
              const rows = document.getElementsByName('reportDetailName');
              let hasSelected = false;
              for (let i = 0; i < rows.length; i++) {
                const cb = rows[i].children[1]
                  ?.firstElementChild as HTMLInputElement;
                if (cb && cb.checked) {
                  hasSelected = true;
                  break;
                }
              }
              if (!hasSelected) {
                alert('No selected fields');
                return false;
              }
              try {
                if (typeof win.removeHiddenSortOrderDDLs === 'function')
                  win.removeHiddenSortOrderDDLs();
                if (typeof win.unformatAllLocalFilterValues === 'function')
                  win.unformatAllLocalFilterValues(rows);
                if (typeof win.startWaitingForDownload === 'function')
                  win.startWaitingForDownload();
              } catch (e) { }
              return true;
            };
          },
          { fcmVal: fcm, curVal: currency, descVal: desc },
        );

        await page.waitForTimeout(1000);

        // Click saveButton (Create Report) and wait for download
        this.logger.log('Clicking saveButton and waiting for download...');
        const downloadPromise = page.waitForEvent('download', {
          timeout: 120000,
        });
        await dataFrame.locator('#saveButton').click({ timeout: 10000 });

        const download = await downloadPromise;
        const parentDir = path.dirname(destFile);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }

        await download.saveAs(destFile);
        this.logger.log(`Tải file CAST thành công về: ${destFile}`);
        if (onLog) onLog(`Tải file CAST thành công về: ${destFile}`);
        return destFile;
      } else {
        throw new Error('Không tìm thấy frame Reporting Tool/dataFrame trên giao diện CAST.');
      }
    } catch (err: any) {
      this.logger.error(`Lỗi tải báo cáo CQG CAST: ${err.message}`);
      // Capture screenshot for debug
      try {
        const debugDir = path.join(process.cwd(), 'temp', 'debug', 'cast');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        await page
          .screenshot({
            path: path.join(debugDir, `error-${ts}.png`),
            fullPage: true,
          })
          .catch(() => { });
      } catch { }
      throw err;
    } finally {
      await browser.close().catch(() => {});
    }
  }

  /**
   * Tải báo cáo số dư CQG CAST và sao chép ra cả hai tên file:
   * 1. Accounts_Balances.xlsx (chuẩn Core / SOD Reconciliation)
   * 2. AS.xlsx (chuẩn Checklist Hub UI / Auditor)
   */
  public async downloadAndSaveCastBalanceFiles(
    destDir: string,
    downloaded: string[],
    errors: string[],
    onLog?: (msg: string) => Promise<void> | void,
  ): Promise<void> {
    try {
      this.logger.log('[CQG-CAST] Bắt đầu tải file AS (Accounts_Balances.xlsx) qua CQG CAST...');
      if (onLog) await onLog('Bắt đầu tải file AS (Accounts_Balances.xlsx) qua CQG CAST...');

      const castTempDir = path.join(process.cwd(), 'temp', 'cast-downloads');
      if (!fs.existsSync(castTempDir)) fs.mkdirSync(castTempDir, { recursive: true });

      const dateStr = new Date(Date.now() + 7 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0]
        .replace(/-/g, '');
      const tempAs = path.join(castTempDir, `Accounts_Balances_${dateStr}_${Date.now()}.xlsx`);

      await this.downloadCastBalances(tempAs, undefined, onLog ? (msg) => onLog(msg) : undefined);

      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      const targetAccountsBalances = path.join(destDir, 'Accounts_Balances.xlsx');
      const targetAs = path.join(destDir, 'AS.xlsx');

      fs.copyFileSync(tempAs, targetAccountsBalances);
      fs.copyFileSync(tempAs, targetAs);

      downloaded.push('Accounts_Balances.xlsx', 'AS.xlsx');
      this.logger.log(`[CQG-CAST] Đã sao chép file AS thành công sang thư mục backup: ${targetAccountsBalances} & ${targetAs}`);
      if (onLog) await onLog('Đã tải và lưu thành công file AS: Accounts_Balances.xlsx & AS.xlsx');
    } catch (castErr: any) {
      this.logger.error(`[CQG-CAST] Lỗi tải file AS (CQG CAST): ${castErr.message}`);
      errors.push(`AS (CAST): ${castErr.message}`);
      if (onLog) await onLog(`Lỗi tải file AS (CQG CAST): ${castErr.message}`);
    }
  }

  /**
   * Kiểm tra kết nối thử nghiệm tài khoản CQG CAST
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    const tempDir = path.join(process.cwd(), 'temp', 'test-connection-cast');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const testFile = path.join(tempDir, `test_cast_${Date.now()}.xlsx`);

    try {
      await this.downloadCastBalances(testFile);
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
      return {
        success: true,
        message: 'Kết nối thử nghiệm CQG CAST thành công! Robot đăng nhập và tải file thử nghiệm hoàn tất.',
      };
    } catch (err: any) {
      throw new Error(`Kết nối thử nghiệm CQG CAST thất bại: ${err.message || 'Lỗi không xác định'}`);
    }
  }
}
