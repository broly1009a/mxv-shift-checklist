/**
 * Helper cào thông tin chi tiết tài khoản giao dịch (TKGD) từ M-System
 * URL mục tiêu: https://msadmin.mxv.com.vn/#/clientManagement/investorManagement/{investorCode}
 */

import { Page } from 'playwright-core';

export interface MSystemInvestorScrapedData {
  maTKGD: string;
  tenTKGD?: string;
  hoVaTen?: string;
  soCMND_HoChieu?: string;
  ngaySinh?: Date;
  rawNgaySinh?: string;
  ngayCap?: Date;
  rawNgayCap?: string;
  noiCap?: string;
  gioiTinh?: string;
  ngayThamGia?: Date;
  loaiHinhTaiKhoan?: string;
  diaChi?: string;
  trangThai?: string;
  chuKy?: string;
  cccdMatTruocUrl?: string;
  cccdMatSauUrl?: string;
  chuKyUrl?: string;
  cccdMatTruocLocalPath?: string;
  cccdMatSauLocalPath?: string;
  chuKyLocalPath?: string;
  isFoundOnMS: boolean;
}

function parseDateDDMMYYYY(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    // Sử dụng Date.UTC để đảm bảo mốc thời gian lưu trong MongoDB luôn là UTC 00:00:00 của đúng ngày đó (không bị lùi 1 ngày do múi giờ)
    const dateObj = new Date(Date.UTC(y, m, d, 0, 0, 0));
    if (!isNaN(dateObj.getTime())) return dateObj;
  }
  return undefined;
}


async function extractAndSaveImage(
  page: Page,
  containerLabel: string,
  outFilePath?: string,
): Promise<{ url?: string; localPath?: string; exists: boolean }> {
  try {
    const locators = [
      page.locator(`.form-group:has-text("${containerLabel}") img`).first(),
      page.locator(`div:has-text("${containerLabel}") >> img.ant-image-img`).first(),
      page.locator(`div:has-text("${containerLabel}") >> img`).first(),
    ];

    let targetImg = null;
    for (const loc of locators) {
      if ((await loc.count().catch(() => 0)) > 0) {
        targetImg = loc;
        break;
      }
    }

    if (!targetImg) {
      return { exists: false };
    }

    const src = (await targetImg.getAttribute('src').catch(() => '')) || '';
    let localPath: string | undefined = undefined;

    if (outFilePath) {
      const fs = await import('fs');
      const path = await import('path');
      const dir = path.dirname(outFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (src.startsWith('data:image/')) {
        const base64Data = src.split(',')[1];
        if (base64Data) {
          fs.writeFileSync(outFilePath, Buffer.from(base64Data, 'base64'));
          localPath = outFilePath;
        }
      } else if (src.startsWith('http') || src.startsWith('/')) {
        // Tải qua evaluate để kế thừa session cookies/tokens từ browser context
        const base64Data = await page.evaluate(async (imgSrc) => {
          try {
            const resp = await fetch(imgSrc);
            const blob = await resp.blob();
            return new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } catch {
            return null;
          }
        }, src).catch(() => null);

        if (base64Data && base64Data.includes(',')) {
          fs.writeFileSync(outFilePath, Buffer.from(base64Data.split(',')[1], 'base64'));
          localPath = outFilePath;
        } else {
          // Fallback: Chụp ảnh trực tiếp element
          await targetImg.screenshot({ path: outFilePath }).catch(() => {});
          if (fs.existsSync(outFilePath)) {
            localPath = outFilePath;
          }
        }
      } else {
        // Fallback: Chụp ảnh trực tiếp element
        await targetImg.screenshot({ path: outFilePath }).catch(() => {});
        if (fs.existsSync(outFilePath)) {
          localPath = outFilePath;
        }
      }
    }

    return {
      exists: true,
      url: src.length > 200 ? src.slice(0, 60) + '...[base64]' : src,
      localPath,
    };
  } catch (err: any) {
    return { exists: false };
  }
}

export async function scrapeInvestorDetailFromMSystem(
  page: Page,
  investorCode: string,
  baseUrl: string = 'https://msadmin.mxv.com.vn',
  saveImagesDir?: string,
): Promise<MSystemInvestorScrapedData> {
  const detailUrl = `${baseUrl}/#/clientManagement/investorManagement/${investorCode}`;
  console.log(`\n  🌐 Điều hướng đến: ${detailUrl}`);

  const result: MSystemInvestorScrapedData = {
    maTKGD: investorCode,
    isFoundOnMS: false,
  };

  try {
    // 1. Điều hướng SPA Hash Router an toàn:
    // Trên Single Page Application (SPA), thay đổi hash khi đang ở cùng domain cần trigger window.location.href
    console.log(`  🔄 Đang chuyển router tới chi tiết: ${investorCode}...`);
    await page.evaluate((targetUrl) => {
      window.location.href = targetUrl;
    }, detailUrl).catch(() => {});
    await page.waitForTimeout(2500);

    // Nếu URL chưa đổi (vẫn ở dashboard hoặc khác), dùng page.goto với commit
    if (!page.url().includes(investorCode)) {
      console.log(`  🌐 Thử goto trực tiếp với domcontentloaded...`);
      await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // Nếu vẫn bị kẹt ở Dashboard, mở menu QL khách hàng
    if (page.url().includes('dashboard') || !page.url().includes(investorCode)) {
      console.log(`  📂 Mở menu 'QL khách hàng' trên sidebar...`);
      const menuKh = page.locator('.ant-menu-submenu-title:has-text("QL khách hàng"), div:has-text("QL khách hàng")').first();
      if (await menuKh.isVisible({ timeout: 2000 }).catch(() => false)) {
        await menuKh.click();
        await page.waitForTimeout(1000);
      }
      await page.evaluate((targetUrl) => {
        window.location.href = targetUrl;
        window.location.reload();
      }, detailUrl).catch(() => {});
      await page.waitForTimeout(3000);
    }

    console.log(`  📍 URL hiện tại sau điều hướng: ${page.url()}`);

    // 1. Kiểm tra nếu tài khoản không tồn tại (trang rỗng / thông báo lỗi)
    const notFound = await page
      .locator('.ant-empty, .ant-result-404, .ant-alert-error')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (notFound) {
      console.log(`  ⚠️ Không tìm thấy tài khoản ${investorCode} trên M-System.`);
      return result;
    }

    // 2. Đảm bảo đang mở tab "THÔNG TIN"
    const tabThongTin = page.locator('.ant-tabs-tab:has-text("THÔNG TIN")').first();
    if (await tabThongTin.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tabThongTin.click();
      // Chờ React hydrate xong: đợi đến khi input "Họ và tên" có giá trị thực sự
      // (không dùng waitForTimeout cố định vì React set .value qua JS sau render)
      await page.waitForFunction(
        () => {
          const inp = document.querySelector('input[placeholder="Họ và tên"]') as HTMLInputElement | null;
          return inp !== null && inp.value.trim().length > 0;
        },
        { timeout: 8000 },
      ).catch(() => {
        // Nếu timeout thì vẫn tiếp tục (tài khoản có thể chưa nhập tên)
      });
    }

    // 3. Trích xuất chính xác theo cấu trúc DOM thực tế của M-System
    // Dùng page.evaluate() để đọc .value DOM property trực tiếp — tránh vấn đề
    // React controlled disabled input chưa kịp sync attribute "value" với DOM property.
    const formValues = await page.evaluate(() => {
      function readInput(selector: string): string {
        const el = document.querySelector(selector) as HTMLInputElement | null;
        return el ? (el.value || el.getAttribute('value') || '') : '';
      }
      function readAntPicker(labelText: string): string {
        // Tìm form-group chứa text label rồi lấy input bên trong ant-picker
        const groups = Array.from(document.querySelectorAll('.form-group'));
        for (const g of groups) {
          if (g.textContent?.includes(labelText)) {
            const inp = g.querySelector('.ant-picker input, input') as HTMLInputElement | null;
            if (inp) return inp.value || inp.getAttribute('value') || inp.getAttribute('title') || '';
          }
        }
        return '';
      }
      function readInputByLabel(labelText: string): string {
        const groups = Array.from(document.querySelectorAll('.form-group'));
        for (const g of groups) {
          if (g.textContent?.includes(labelText)) {
            const inp = g.querySelector('input') as HTMLInputElement | null;
            if (inp) return inp.value || inp.getAttribute('value') || '';
          }
        }
        return '';
      }

      return {
        hoVaTen: readInput('input[placeholder="Họ và tên"]') || readInputByLabel('Họ và tên'),
        soCMND: readInput('input[placeholder="Số CMT/ Hộ chiếu"]')
          || readInput('input[placeholder*="CMT"]')
          || readInput('input[placeholder*="CCCD"]')
          || readInputByLabel('Số CMT'),
        ngaySinhStr: readAntPicker('Ngày sinh'),
        ngayCapStr: readAntPicker('Ngày cấp'),
        noiCap: readInput('input[placeholder="Nơi cấp"]') || readInputByLabel('Nơi cấp'),
        diaChi: (() => {
          const el = document.querySelector('textarea[placeholder="Địa chỉ"], input[placeholder="Địa chỉ"]') as HTMLInputElement | HTMLTextAreaElement | null;
          return el ? (el.value || el.getAttribute('value') || '') : '';
        })(),
        tenTKGD: readInput('input[placeholder="Tên TKGD"]') || readInputByLabel('Tên TKGD'),
        maTKGD: readInput('input[placeholder="Mã TKGD"]') || readInputByLabel('Mã TKGD'),
        trangThai: (() => {
          const groups = Array.from(document.querySelectorAll('.form-group'));
          for (const g of groups) {
            if (g.textContent?.includes('Trạng thái')) {
              const sel = g.querySelector('.ant-select-selection-item') as HTMLElement | null;
              const inp = g.querySelector('input') as HTMLInputElement | null;
              return sel?.innerText?.trim() || inp?.value || '';
            }
          }
          return '';
        })(),
        loaiHinh: (() => {
          const groups = Array.from(document.querySelectorAll('.form-group'));
          for (const g of groups) {
            if (g.textContent?.includes('Loại hình')) {
              const sel = g.querySelector('.ant-select-selection-item') as HTMLElement | null;
              const inp = g.querySelector('input') as HTMLInputElement | null;
              return sel?.innerText?.trim() || inp?.value || '';
            }
          }
          return '';
        })(),
        ngayThamGiaStr: readAntPicker('Ngày tham gia'),
      };
    });

    // Destructure kết quả
    let hoVaTen = formValues.hoVaTen.trim();
    let soCMND = formValues.soCMND.trim();
    let ngaySinhStr = formValues.ngaySinhStr.trim();
    let ngayCapStr = formValues.ngayCapStr.trim();
    let noiCap = formValues.noiCap.trim();
    let diaChi = formValues.diaChi.trim();
    let tenTKGD = formValues.tenTKGD.trim();
    let trangThai = formValues.trangThai.trim();
    let loaiHinh = formValues.loaiHinh.trim();
    let ngayThamGiaStr = formValues.ngayThamGiaStr.trim();

    console.log(`  📋 page.evaluate() đọc được: hoVaTen="${hoVaTen}", soCMND="${soCMND}", ngaySinh="${ngaySinhStr}", ngayCap="${ngayCapStr}"`);

    // Fallback: nếu tenTKGD không đọc được thì dùng hoVaTen
    if (!tenTKGD) {
      tenTKGD = hoVaTen;
    }


    // 4. Trích xuất ảnh CMT/CCCD mặt trước, mặt sau và Chữ ký
    console.log(`  📸 Đang kiểm tra & bóc tách ảnh CCCD / Chữ ký trên M-System...`);
    const path = await import('path');

    const frontPath = saveImagesDir
      ? path.join(saveImagesDir, `${investorCode}_MS_CCCD_truoc.jpg`)
      : undefined;
    const backPath = saveImagesDir
      ? path.join(saveImagesDir, `${investorCode}_MS_CCCD_sau.jpg`)
      : undefined;
    const signPath = saveImagesDir
      ? path.join(saveImagesDir, `${investorCode}_MS_ChuKy.png`)
      : undefined;

    const [frontImg, backImg, signImg] = await Promise.all([
      extractAndSaveImage(page, 'mặt trước', frontPath),
      extractAndSaveImage(page, 'mặt sau', backPath),
      extractAndSaveImage(page, 'Chữ ký', signPath),
    ]);

    const hasSignature = signImg.exists;

    if (hoVaTen || soCMND || tenTKGD) {
      result.isFoundOnMS = true;
      result.tenTKGD = (tenTKGD || hoVaTen).trim();
      result.hoVaTen = hoVaTen.trim();
      result.soCMND_HoChieu = soCMND.trim();
      result.ngaySinh = parseDateDDMMYYYY(ngaySinhStr);
      result.rawNgaySinh = ngaySinhStr ? ngaySinhStr.trim() : undefined;
      result.ngayCap = parseDateDDMMYYYY(ngayCapStr);
      result.rawNgayCap = ngayCapStr ? ngayCapStr.trim() : undefined;
      result.noiCap = noiCap.trim() || undefined;

      // Giới tính: Suy luận toán học chuẩn từ số CCCD 12 số
      if (result.soCMND_HoChieu && result.soCMND_HoChieu.length === 12) {
        const centuryGender = result.soCMND_HoChieu.charAt(3);
        if (['0', '2', '4', '6', '8'].includes(centuryGender)) {
          result.gioiTinh = 'Nam';
        } else if (['1', '3', '5', '7', '9'].includes(centuryGender)) {
          result.gioiTinh = 'Nữ';
        }
      }
      result.ngayThamGia = parseDateDDMMYYYY(ngayThamGiaStr);
      result.loaiHinhTaiKhoan = loaiHinh.trim() || 'Cá nhân';
      result.trangThai = trangThai.trim() || 'Hoạt động';
      result.diaChi = diaChi.trim() || undefined;
      result.chuKy = hasSignature ? 'Đã ký' : 'Chưa ký';

      // Lưu kết quả ảnh
      result.cccdMatTruocUrl = frontImg.url;
      result.cccdMatSauUrl = backImg.url;
      result.chuKyUrl = signImg.url;
      result.cccdMatTruocLocalPath = frontImg.localPath;
      result.cccdMatSauLocalPath = backImg.localPath;
      result.chuKyLocalPath = signImg.localPath;

      console.log(`  ✅ Đã cào thành công từ M-System:`);
      console.log(`     - Tên TKGD:  ${result.tenTKGD}`);
      console.log(`     - Họ và tên: ${result.hoVaTen}`);
      console.log(`     - Số CMT:    ${result.soCMND_HoChieu}`);
      console.log(`     - Ngày sinh: ${ngaySinhStr || '---'}`);
      console.log(`     - Ngày cấp:  ${ngayCapStr || '---'}`);
      console.log(`     - Nơi cấp:   ${result.noiCap || '---'}`);
      console.log(`     - Địa chỉ:   ${result.diaChi || '---'}`);
      console.log(`     - Trạng thái:${result.trangThai || '---'}`);
      console.log(`     - CCCD Trước:${frontImg.exists ? (frontImg.localPath ? ` Đã lưu (${frontImg.localPath})` : ' Có ảnh') : ' Không có'}`);
      console.log(`     - CCCD Sau:  ${backImg.exists ? (backImg.localPath ? ` Đã lưu (${backImg.localPath})` : ' Có ảnh') : ' Không có'}`);
      console.log(`     - Chữ ký:    ${signImg.exists ? (signImg.localPath ? ` Đã lưu (${signImg.localPath})` : ' Có ảnh') : ' Không có'}`);
    } else {
      console.log(`  ⚠️ Không đọc được các trường dữ liệu của ${investorCode}.`);
    }

    return result;

  } catch (err: any) {
    console.error(`  ❌ Lỗi khi scrape investor ${investorCode}: ${err.message}`);
    return result;
  }
}
