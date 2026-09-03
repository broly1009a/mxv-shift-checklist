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
  ngayCap?: Date;
  noiCap?: string;
  ngayThamGia?: Date;
  loaiHinhTaiKhoan?: string;
  diaChi?: string;
  trangThai?: string;
  chuKy?: string;
  isFoundOnMS: boolean;
}

function parseDateDDMMYYYY(dateStr: string | null | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const y = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    if (!isNaN(dateObj.getTime())) return dateObj;
  }
  return undefined;
}


export async function scrapeInvestorDetailFromMSystem(
  page: Page,
  investorCode: string,
  baseUrl: string = 'https://msadmin.mxv.com.vn',
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
      await page.waitForTimeout(1000);
    }

    // 3. Trích xuất chính xác theo cấu trúc DOM thực tế của M-System
    // A. Họ và tên
    let hoVaTen = await page
      .locator('input[placeholder="Họ và tên"]')
      .first()
      .inputValue()
      .catch(() => '');
    if (!hoVaTen) {
      hoVaTen = (await page.locator('.form-group:has-text("Họ và tên") input').first().getAttribute('value').catch(() => '')) || '';
    }

    // B. Số CMT / Hộ chiếu
    let soCMND = await page
      .locator('input[placeholder="Số CMT/ Hộ chiếu"], input[placeholder*="CMT"]')
      .first()
      .inputValue()
      .catch(() => '');
    if (!soCMND) {
      soCMND = (await page.locator('.form-group:has-text("Số CMT") input').first().getAttribute('value').catch(() => '')) || '';
    }

    // C. Ngày sinh (ant-picker input bên trong form-group "Ngày sinh")
    let ngaySinhStr = await page
      .locator('.form-group:has-text("Ngày sinh") .ant-picker input')
      .first()
      .getAttribute('value')
      .catch(() => '');
    if (!ngaySinhStr) {
      ngaySinhStr = await page
        .locator('.form-group:has-text("Ngày sinh") input')
        .first()
        .inputValue()
        .catch(() => '');
    }

    // D. Ngày cấp (ant-picker input bên trong form-group "Ngày cấp")
    let ngayCapStr = await page
      .locator('.form-group:has-text("Ngày cấp") .ant-picker input')
      .first()
      .getAttribute('value')
      .catch(() => '');
    if (!ngayCapStr) {
      ngayCapStr = await page
        .locator('.form-group:has-text("Ngày cấp") input')
        .first()
        .inputValue()
        .catch(() => '');
    }

    // E. Nơi cấp
    let noiCap = await page
      .locator('input[placeholder="Nơi cấp"]')
      .first()
      .inputValue()
      .catch(() => '');
    if (!noiCap) {
      noiCap = (await page.locator('.form-group:has-text("Nơi cấp") input').first().getAttribute('value').catch(() => '')) || '';
    }

    // F. Địa chỉ
    let diaChi = await page
      .locator('textarea[placeholder="Địa chỉ"], input[placeholder="Địa chỉ"]')
      .first()
      .inputValue()
      .catch(() => '');
    if (!diaChi) {
      diaChi = await page
        .locator('.form-group:has-text("Địa chỉ") textarea')
        .first()
        .innerText()
        .catch(() => '');
    }

    // G. Tên TKGD & Mã TKGD & Trạng thái từ phần trên
    let tenTKGD = await page
      .locator('input[placeholder="Tên TKGD"], .form-group:has-text("Tên TKGD") input')
      .first()
      .inputValue()
      .catch(() => '');
    if (!tenTKGD) {
      tenTKGD = hoVaTen; // Mặc định tên TKGD = họ tên khách hàng cá nhân
    }

    let trangThai = await page
      .locator('.form-group:has-text("Trạng thái") input, .form-group:has-text("Trạng thái") .ant-select-selection-item')
      .first()
      .innerText()
      .catch(() => 'Hoạt động');

    let loaiHinh = await page
      .locator('.form-group:has-text("Loại hình") input, .form-group:has-text("Loại hình") .ant-select-selection-item')
      .first()
      .innerText()
      .catch(() => 'Cá nhân');

    let ngayThamGiaStr = await page
      .locator('.form-group:has-text("Ngày tham gia") input')
      .first()
      .getAttribute('value')
      .catch(() => '');

    // Kiểm tra có ảnh chữ ký không
    const hasSignature = await page
      .locator('div.form-group:has-text("Chữ ký") img')
      .count()
      .then((c) => c > 0)
      .catch(() => false);

    if (hoVaTen || soCMND || tenTKGD) {
      result.isFoundOnMS = true;
      result.tenTKGD = (tenTKGD || hoVaTen).trim();
      result.hoVaTen = hoVaTen.trim();
      result.soCMND_HoChieu = soCMND.trim();
      result.ngaySinh = parseDateDDMMYYYY(ngaySinhStr);
      result.ngayCap = parseDateDDMMYYYY(ngayCapStr);
      result.noiCap = noiCap.trim() || undefined;
      result.ngayThamGia = parseDateDDMMYYYY(ngayThamGiaStr);
      result.loaiHinhTaiKhoan = loaiHinh.trim() || 'Cá nhân';
      result.trangThai = trangThai.trim() || 'Hoạt động';
      result.diaChi = diaChi.trim() || undefined;
      result.chuKy = hasSignature ? 'Đã ký' : 'Chưa ký';

      console.log(`  ✅ Đã cào thành công từ M-System:`);
      console.log(`     - Tên TKGD:  ${result.tenTKGD}`);
      console.log(`     - Họ và tên: ${result.hoVaTen}`);
      console.log(`     - Số CMT:    ${result.soCMND_HoChieu}`);
      console.log(`     - Ngày sinh: ${ngaySinhStr || '---'}`);
      console.log(`     - Ngày cấp:  ${ngayCapStr || '---'}`);
      console.log(`     - Nơi cấp:   ${result.noiCap || '---'}`);
      console.log(`     - Địa chỉ:   ${result.diaChi || '---'}`);
      console.log(`     - Trạng thái:${result.trangThai || '---'}`);
    } else {
      console.log(`  ⚠️ Không đọc được các trường dữ liệu của ${investorCode}.`);
    }

    return result;

  } catch (err: any) {
    console.error(`  ❌ Lỗi khi scrape investor ${investorCode}: ${err.message}`);
    return result;
  }
}
