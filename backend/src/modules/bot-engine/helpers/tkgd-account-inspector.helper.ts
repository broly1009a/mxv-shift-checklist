/**
 * tkgd-account-inspector.helper.ts
 * MODULE CHẨN ĐOÁN & TRA CỨU ĐỐI CHIẾU DỮ LIỆU TKGD (TKGD ACCOUNT INSPECTOR)
 * 
 * Tự động trích xuất, đối soát chéo và phát hiện bất thường giữa:
 * 1. Email gốc từ TVKD (raw_account_mails: Tiêu đề, Body, Tệp đính kèm)
 * 2. Hồ sơ bóc tách pháp lý (clean_account_records: HĐ PDF, Ảnh CCCD OCR, Phụ lục)
 * 3. Dữ liệu M-System (ms: Họ tên, Số CCCD, Ngày sinh, Ngày duyệt)
 * 4. Báo động sai sót TVKD: "Râu ông nọ cắm cằm bà kia" (Entity Mismatch / Cross-Account Mixup)
 */

export interface InspectionReport {
  query: string;
  matchedCount: number;
  records: Array<{
    recordId: string;
    maTKGD: string;
    maTKGDBase: string;
    batchDate: string;
    
    // Tầng 1: Email Outlook Gốc
    mailInfo: {
      found: boolean;
      subject?: string;
      senderEmail?: string;
      receivedDateTime?: string;
      tenTaiKhoanOnMail?: string;
      maTKGD_Futures?: string;
      maTKGD_ACM?: string;
      bodySnippet?: string;
      attachments: string[];
    };

    // Tầng 2: Bóc tách Hợp đồng & CCCD
    docInfo: {
      hopDong: {
        hoVaTen?: string;
        soCanCuoc?: string;
        ngaySinh?: string;
        ngayCap?: string;
        noiCap?: string;
        chuKy?: string;
      };
      canCuoc: {
        hoVaTen?: string;
        soCanCuoc?: string;
        ngaySinh?: string;
        ngayCap?: string;
        theGeneration?: string;
        ocrConfidence?: number;
      };
      phuLuc?: {
        hasACMRequest: boolean;
        hasLMERequest: boolean;
        hasSpreadRequest: boolean;
      };
    };

    // Tầng 3: Dữ liệu M-System
    msInfo: {
      isFoundOnMS: boolean;
      maTKGD?: string;
      hoVaTen?: string;
      soCMND_HoChieu?: string;
      ngaySinh?: string;
      ngayCap?: string;
      noiCap?: string;
      gioiTinh?: string;
      trangThai?: string;
      ngayThamGia?: string;
    };

    // Tầng 4: Kết luận & Chẩn đoán bất thường
    reconcileStatus: {
      officialStatus: string;
      errors: string[];
      isNameMatch: boolean;
      isCccdMatch: boolean;
      isDobMatch: boolean;
      anomalies: string[];
      crossEntityAlert?: string;
    };
  }>;
  relatedAccounts?: Array<{
    maTKGD: string;
    tenTaiKhoan: string;
    msHoVaTen?: string;
    soCCCD?: string;
    note: string;
  }>;
}

/**
 * Hàm tra cứu và phân tích chuyên sâu cho 1 tài khoản hoặc khách hàng
 */
export async function inspectAccountDetails(
  queryInput: string,
  db: any,
): Promise<InspectionReport> {
  const query = (queryInput || '').trim();
  const cleanRegex = new RegExp(query, 'i');

  // 1. Tìm trong clean_account_records
  const cleanRecords = await db.collection('clean_account_records').find({
    $or: [
      { maTKGD: cleanRegex },
      { maTKGDBase: cleanRegex },
      { 'noiDungMail.maTKGD_Futures': cleanRegex },
      { 'noiDungMail.tenTaiKhoan': cleanRegex },
      { 'hopDong.hoVaTen': cleanRegex },
      { 'hopDong.soCanCuoc': query },
      { 'canCuoc.soCanCuoc': query },
      { 'ms.hoVaTen': cleanRegex },
      { 'ms.soCMND_HoChieu': query },
    ],
  }).sort({ createdAt: -1 }).limit(10).toArray();

  const reportRecords: InspectionReport['records'] = [];
  const relatedAccountsMap = new Map<string, any>();

  for (const c of cleanRecords) {
    const baseCode = c.maTKGDBase || c.maTKGD?.split('-')[0] || '';
    const mailName = c.noiDungMail?.tenTaiKhoan || '';
    const hdName = c.hopDong?.hoVaTen || '';
    const msName = c.ms?.hoVaTen || '';
    const hdCccd = c.hopDong?.soCanCuoc || '';
    const msCccd = c.ms?.soCMND_HoChieu || '';
    const imgCccd = c.canCuoc?.soCanCuoc || '';

    // 2. Tra cứu email gốc từ raw_account_mails
    let rawMail: any = null;
    if (c.rawMailId) {
      try {
        rawMail = await db.collection('raw_account_mails').findOne({ _id: c.rawMailId });
      } catch {}
    }
    if (!rawMail && baseCode) {
      rawMail = await db.collection('raw_account_mails').findOne({
        $or: [
          { subject: new RegExp(baseCode, 'i') },
          { bodyRawText: new RegExp(baseCode, 'i') },
        ],
      });
    }

    const attachmentsList: string[] = (rawMail?.attachments || []).map((a: any) => a.name || String(a));

    // 3. Phân tích bất thường nghiệp vụ (Anomaly Detection)
    const anomalies: string[] = [];
    let crossEntityAlert: string | undefined = undefined;

    // Check 1: Tên trên Mail vs Tên trên MS
    const isNameMatch = !!(
      msName &&
      mailName &&
      (msName.toUpperCase().replace(/\s+/g, ' ') === mailName.toUpperCase().replace(/\s+/g, ' ') ||
       msName.toLowerCase().includes(mailName.toLowerCase()) ||
       mailName.toLowerCase().includes(msName.toLowerCase()))
    );

    // Check 2: CCCD trên HĐ vs MS
    const isCccdMatch = !!(msCccd && hdCccd && msCccd === hdCccd);

    // BÁO ĐỘNG ĐẶC BIỆT: "RÂU ÔNG NỌ CẮM CẰM BÀ KIA"
    if (msName && mailName && !isNameMatch) {
      crossEntityAlert = `🚨 PHÁT HIỆN SAI LỆCH ĐỐI TƯỢNG (Râu ông nọ cắm cằm bà kia):\n` +
        `   • Email & Tệp đính kèm của: ${mailName} (CCCD: ${hdCccd || imgCccd || 'Chưa rõ'})\n` +
        `   • Nhưng M-System đang mở cho: ${msName} (CCCD: ${msCccd || 'Chưa rõ'})`;
      anomalies.push(`Họ tên trên Mail (${mailName}) KHÔNG KHỚP với tài khoản M-System (${msName})`);
    }

    if (msCccd && hdCccd && !isCccdMatch) {
      anomalies.push(`Số CCCD trên HĐ (${hdCccd}) KHÔNG KHỚP với M-System (${msCccd})`);
    }

    // Check 3: Tên file đính kèm chứa số hoặc tên khác với mail
    for (const att of attachmentsList) {
      // Nếu tên file có số hiệu khác baseCode
      const codeMatches = att.match(/(\d{3}C\d{7}|\d{7})/g);
      if (codeMatches) {
        for (const m of codeMatches) {
          if (m !== baseCode && !baseCode.includes(m)) {
            anomalies.push(`Tệp đính kèm "${att}" chứa mã số khác (${m}) so với mã tài khoản đang xử lý (${baseCode})`);
          }
        }
      }
    }

    // 4. Tìm kiếm các tài khoản liên quan khác cùng tên khách hàng
    if (mailName) {
      const otherAccounts = await db.collection('clean_account_records').find({
        'noiDungMail.tenTaiKhoan': new RegExp(mailName, 'i'),
        maTKGDBase: { $ne: baseCode },
      }).limit(5).toArray();

      for (const oa of otherAccounts) {
        relatedAccountsMap.set(oa.maTKGD, {
          maTKGD: oa.maTKGD,
          tenTaiKhoan: oa.noiDungMail?.tenTaiKhoan || mailName,
          msHoVaTen: oa.ms?.hoVaTen,
          soCCCD: oa.hopDong?.soCanCuoc || oa.ms?.soCMND_HoChieu,
          note: `Trùng tên khách hàng "${mailName}" đã mở tại mã ${oa.maTKGD}`,
        });
      }
    }

    reportRecords.push({
      recordId: String(c._id),
      maTKGD: c.maTKGD,
      maTKGDBase: baseCode,
      batchDate: c.batchDate || '',
      mailInfo: {
        found: !!rawMail,
        subject: rawMail?.subject,
        senderEmail: rawMail?.senderEmail,
        receivedDateTime: rawMail?.receivedDateTime ? new Date(rawMail.receivedDateTime).toLocaleString('vi-VN') : undefined,
        tenTaiKhoanOnMail: c.noiDungMail?.tenTaiKhoan,
        maTKGD_Futures: c.noiDungMail?.maTKGD_Futures,
        maTKGD_ACM: c.noiDungMail?.maTKGD_ACM,
        bodySnippet: rawMail?.bodyRawText ? rawMail.bodyRawText.slice(0, 300).replace(/\r?\n/g, ' ') + '...' : undefined,
        attachments: attachmentsList,
      },
      docInfo: {
        hopDong: {
          hoVaTen: c.hopDong?.hoVaTen,
          soCanCuoc: c.hopDong?.soCanCuoc,
          ngaySinh: c.hopDong?.rawNgaySinh,
          ngayCap: c.hopDong?.rawNgayCap,
          noiCap: c.hopDong?.noiCap,
          chuKy: c.hopDong?.chuKy,
        },
        canCuoc: {
          hoVaTen: c.canCuoc?.hoVaTen,
          soCanCuoc: c.canCuoc?.soCanCuoc,
          ngaySinh: c.canCuoc?.rawNgaySinh,
          ngayCap: c.canCuoc?.rawNgayCap,
          theGeneration: c.canCuoc?.theGeneration,
          ocrConfidence: c.canCuoc?.confidenceScore,
        },
        phuLuc: {
          hasACMRequest: !!c.noiDungMail?.hasACMRequest,
          hasLMERequest: !!c.noiDungMail?.hasLMERequest,
          hasSpreadRequest: !!c.noiDungMail?.hasSpreadRequest,
        },
      },
      msInfo: {
        isFoundOnMS: !!c.ms?.isFoundOnMS,
        maTKGD: c.ms?.maTKGD,
        hoVaTen: c.ms?.hoVaTen,
        soCMND_HoChieu: c.ms?.soCMND_HoChieu,
        ngaySinh: c.ms?.rawNgaySinh,
        ngayCap: c.ms?.rawNgayCap,
        noiCap: c.ms?.noiCap,
        gioiTinh: c.ms?.gioiTinh,
        trangThai: c.ms?.trangThai,
        ngayThamGia: c.ms?.ngayThamGia ? new Date(c.ms.ngayThamGia).toLocaleDateString('vi-VN') : undefined,
      },
      reconcileStatus: {
        officialStatus: c.ketLuan?.trangThai || c.trangThaiDoiSoat || 'CHUA_XU_LY',
        errors: c.ketLuan?.danhSachLoi || c.lyDoLoi || [],
        isNameMatch,
        isCccdMatch,
        isDobMatch: !anomalies.some((a) => a.includes('ngày sinh')),
        anomalies,
        crossEntityAlert,
      },
    });
  }

  return {
    query,
    matchedCount: reportRecords.length,
    records: reportRecords,
    relatedAccounts: Array.from(relatedAccountsMap.values()),
  };
}

/**
 * Định dạng báo cáo trực quan nhiều màu sắc hiển thị trên Terminal CLI
 */
export function formatReportToConsole(report: InspectionReport): string {
  const lines: string[] = [];
  const bar = '═'.repeat(80);
  const subBar = '─'.repeat(80);

  lines.push('');
  lines.push(`╔${bar}╗`);
  lines.push(`║   BÁO CÁO CHẨN ĐOÁN & TRA CỨU HỒ SƠ TKGD (TKGD ACCOUNT INSPECTOR)           ║`);
  lines.push(`║   Từ khóa tra cứu: ${report.query.padEnd(57)}║`);
  lines.push(`║   Tổng số hồ sơ tìm thấy: ${String(report.matchedCount).padEnd(52)}║`);
  lines.push(`╚${bar}╝`);

  if (report.matchedCount === 0) {
    lines.push('\n❌ KHÔNG TÌM THẤY HỒ SƠ NÀO PHÙ HỢP TRONG CƠ SỞ DỮ LIỆU.');
    return lines.join('\n');
  }

  report.records.forEach((rec, idx) => {
    lines.push(`\n[${idx + 1}/${report.matchedCount}] HỒ SƠ TÀI KHOẢN: ${rec.maTKGD} (Ngày đợt: ${rec.batchDate || 'N/A'})`);
    lines.push(subBar);

    // TẦNG 1: EMAIL GỐC
    lines.push('📧 1. THÔNG TIN EMAIL OUTLOOK GỐC:');
    if (rec.mailInfo.found) {
      lines.push(`   • Tiêu đề (Subject) : ${rec.mailInfo.subject || '(Trống)'}`);
      lines.push(`   • Người gửi (Sender) : ${rec.mailInfo.senderEmail || '(Trống)'}`);
      lines.push(`   • Thời gian nhận     : ${rec.mailInfo.receivedDateTime || '(Trống)'}`);
      lines.push(`   • Tên trên Email     : ${rec.mailInfo.tenTaiKhoanOnMail || '(Trống)'}`);
      lines.push(`   • Tệp đính kèm (${rec.mailInfo.attachments.length}) :`);
      if (rec.mailInfo.attachments.length > 0) {
        rec.mailInfo.attachments.forEach((att) => lines.push(`     📎 ${att}`));
      } else {
        lines.push('     (Không có tệp đính kèm)');
      }
    } else {
      lines.push('   ⚠️ Không tìm thấy bản ghi email thô liên kết (hoặc đã bị xóa).');
    }

    // TẦNG 2: BÓC TÁCH HỢP ĐỒNG & CCCD
    lines.push('\n📄 2. KẾT QUẢ BÓC TÁCH HỒ SƠ PHÁP LÝ:');
    lines.push(`   • Hợp đồng  : Tên: "${rec.docInfo.hopDong.hoVaTen || 'N/A'}" | CCCD: "${rec.docInfo.hopDong.soCanCuoc || 'N/A'}" | Sinh: ${rec.docInfo.hopDong.ngaySinh || 'N/A'}`);
    lines.push(`   • Ảnh CCCD  : Tên: "${rec.docInfo.canCuoc.hoVaTen || 'N/A'}" | Số: "${rec.docInfo.canCuoc.soCanCuoc || 'N/A'}" | Độ tin cậy AI: ${rec.docInfo.canCuoc.ocrConfidence ? rec.docInfo.canCuoc.ocrConfidence + '%' : 'N/A'}`);

    // TẦNG 3: M-SYSTEM
    lines.push('\n🌐 3. DỮ LIỆU TRÊN CỔNG M-SYSTEM:');
    if (rec.msInfo.isFoundOnMS) {
      lines.push(`   • Trạng thái : ĐÃ CÀO THÀNH CÔNG (Mã MS: ${rec.msInfo.maTKGD || rec.maTKGDBase})`);
      lines.push(`   • Họ và tên  : "${rec.msInfo.hoVaTen || 'N/A'}"`);
      lines.push(`   • Số CCCD    : "${rec.msInfo.soCMND_HoChieu || 'N/A'}"`);
      lines.push(`   • Ngày sinh  : ${rec.msInfo.ngaySinh || 'N/A'} | Ngày cấp: ${rec.msInfo.ngayCap || 'N/A'}`);
    } else {
      lines.push('   ⚠️ CHƯA CÀO ĐƯỢC DỮ LIỆU TRÊN M-SYSTEM (hoặc bot chưa đồng bộ).');
    }

    // TẦNG 4: KẾT LUẬN & CHẨN ĐOÁN BẤT THƯỜNG
    lines.push('\n⚖️ 4. KẾT LUẬN ĐỐI SOÁT & CHẨN ĐOÁN:');
    const statusIcon = rec.reconcileStatus.officialStatus === 'KHOP' ? '✅' : rec.reconcileStatus.officialStatus === 'CAN_KIEM_TRA' ? '⚠️' : '❌';
    lines.push(`   • Kết luận chính thống : ${statusIcon} ${rec.reconcileStatus.officialStatus}`);

    if (rec.reconcileStatus.errors.length > 0) {
      lines.push('   • Danh sách lỗi phát hiện:');
      rec.reconcileStatus.errors.forEach((err) => lines.push(`     - ${err}`));
    }

    if (rec.reconcileStatus.crossEntityAlert) {
      lines.push(`\n${rec.reconcileStatus.crossEntityAlert}`);
    }

    if (rec.reconcileStatus.anomalies.length > 0) {
      lines.push('\n   ⚠️ Các dấu hiệu bất thường khác:');
      rec.reconcileStatus.anomalies.forEach((ano) => lines.push(`     ! ${ano}`));
    }
  });

  // TÀI KHOẢN LIÊN QUAN (NẾU CÓ)
  if (report.relatedAccounts && report.relatedAccounts.length > 0) {
    lines.push('\n' + subBar);
    lines.push('🔗 CÁC TÀI KHOẢN LIÊN QUAN TRONG HỆ THỐNG:');
    report.relatedAccounts.forEach((rel) => {
      lines.push(`   • Mã: ${rel.maTKGD} | Tên Mail: ${rel.tenTaiKhoan} | MS: ${rel.msHoVaTen || 'N/A'} | CCCD: ${rel.soCCCD || 'N/A'}`);
      lines.push(`     -> ${rel.note}`);
    });
  }

  lines.push('\n' + `═`.repeat(80));
  return lines.join('\n');
}
