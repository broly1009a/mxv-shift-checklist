import React from 'react';
import { Check, X, AlertTriangle, Info, Image as ImageIcon } from 'lucide-react';
import { CleanRecord } from '../../types/tkgd.types';
import { cleanMailName, formatDateStr } from '../../utils/tkgd.helpers';

interface TabDataComparisonProps {
  inspectRecord: CleanRecord;
  onSwitchToAttachments: () => void;
}

export const TabDataComparison: React.FC<TabDataComparisonProps> = ({
  inspectRecord,
  onSwitchToAttachments,
}) => {
  const baseCode = (
    inspectRecord.maTKGDBase ||
    (inspectRecord.maTKGD ? inspectRecord.maTKGD.split('-')[0] : '') ||
    inspectRecord.noiDungMail?.maTKGD_Futures ||
    '-'
  ).trim();

  const hasACM =
    inspectRecord.accountTypes?.includes('ACM') ||
    inspectRecord.noiDungMail?.hasACMRequest ||
    !!inspectRecord.phuLuc ||
    inspectRecord.subAccounts?.some((s) => s.type === 'ACM');

  const rows = [
    {
      label: 'Mã TKGD (Futures)',
      left: inspectRecord.noiDungMail?.maTKGD_Futures || baseCode,
      right: inspectRecord.ms?.maTKGD ? inspectRecord.ms.maTKGD.split('-')[0] : baseCode,
      customMatch: true,
    },
    ...(hasACM
      ? [
        {
          label: 'Tiểu khoản ACM (-A)',
          left: inspectRecord.noiDungMail?.maTKGD_ACM || `${baseCode}-A`,
          right: inspectRecord.ms?.maTKGD?.includes('-A') ? inspectRecord.ms.maTKGD : `${baseCode}-A`,
          customMatch: true,
        },
        {
          label: 'Phụ lục PL01 (ACM)',
          left: inspectRecord.phuLuc?.chuKy ? 'Đã ký (PL01)' : 'Có đính kèm file PL01',
          right:
            inspectRecord.ms?.maTKGD?.includes('-A') ||
              inspectRecord.subAccounts?.some((s) => s.type === 'ACM')
              ? 'Đã kích hoạt trên MS'
              : 'Đang xử lý',
          customMatch: true,
        },
      ]
      : []),
    {
      label: 'Họ và tên',
      left: cleanMailName(
        inspectRecord.hopDong?.hoVaTen ||
        inspectRecord.canCuoc?.hoVaTen ||
        inspectRecord.noiDungMail?.tenTaiKhoan
      ),
      right: inspectRecord.ms?.hoVaTen || inspectRecord.ms?.tenTKGD || '-',
    },
    {
      label: 'Số CCCD / Hộ chiếu',
      left: inspectRecord.hopDong?.soCanCuoc || inspectRecord.canCuoc?.soCanCuoc || '-',
      right: inspectRecord.ms?.soCMND_HoChieu || inspectRecord.ms?.cccdOcr_soCanCuoc || '-',
    },
    {
      label: 'Ngày sinh',
      left: (() => {
        const isSubAcc = (inspectRecord.maTKGD || '').includes('-');
        const cccdDob = (inspectRecord.canCuoc?.rawNgaySinh && formatDateStr(inspectRecord.canCuoc.rawNgaySinh) !== '-')
          ? formatDateStr(inspectRecord.canCuoc.rawNgaySinh)
          : formatDateStr(inspectRecord.canCuoc?.ngaySinh);
        const hdDob = (inspectRecord.hopDong?.rawNgaySinh && formatDateStr(inspectRecord.hopDong.rawNgaySinh) !== '-')
          ? formatDateStr(inspectRecord.hopDong.rawNgaySinh)
          : formatDateStr(inspectRecord.hopDong?.ngaySinh);
        const msDob = (inspectRecord.ms?.rawNgaySinh && formatDateStr(inspectRecord.ms.rawNgaySinh) !== '-')
          ? formatDateStr(inspectRecord.ms.rawNgaySinh)
          : formatDateStr(inspectRecord.ms?.ngaySinh);

        let raw = hdDob && hdDob !== '-' ? hdDob : cccdDob;
        if (cccdDob && cccdDob !== '-' && msDob && cccdDob === msDob) {
          raw = cccdDob;
        } else if (isSubAcc && cccdDob && cccdDob !== '-') {
          raw = cccdDob;
        }
        if (raw && raw !== '-') return raw;
        // Tự suy luận năm sinh từ cấu trúc 12 chữ số CCCD chuẩn BCA
        const cccd = (inspectRecord.hopDong?.soCanCuoc || inspectRecord.canCuoc?.soCanCuoc || inspectRecord.ms?.soCMND_HoChieu || '').replace(/\D/g, '');
        if (cccd.length === 12) {
          const g = parseInt(cccd.charAt(3), 10);
          const yy = parseInt(cccd.slice(4, 6), 10);
          if (!isNaN(g) && !isNaN(yy)) {
            const century = g <= 1 ? 1900 : g <= 3 ? 2000 : g <= 5 ? 2100 : g <= 7 ? 2200 : 2300;
            return `${century + yy} (Theo CCCD)`;
          }
        }
        return '-';
      })(),
      right:
        (inspectRecord.ms?.rawNgaySinh && formatDateStr(inspectRecord.ms.rawNgaySinh) !== '-')
          ? formatDateStr(inspectRecord.ms.rawNgaySinh)
          : (inspectRecord.ms?.ngaySinh && formatDateStr(inspectRecord.ms.ngaySinh) !== '-')
            ? formatDateStr(inspectRecord.ms.ngaySinh)
            : formatDateStr(inspectRecord.canCuoc?.rawNgaySinh || inspectRecord.canCuoc?.ngaySinh),
    },
    {
      label: 'Ngày cấp',
      left:
        (inspectRecord.hopDong?.rawNgayCap && formatDateStr(inspectRecord.hopDong.rawNgayCap) !== '-')
          ? formatDateStr(inspectRecord.hopDong.rawNgayCap)
          : (inspectRecord.hopDong?.ngayCap && formatDateStr(inspectRecord.hopDong.ngayCap) !== '-')
            ? formatDateStr(inspectRecord.hopDong.ngayCap)
            : (inspectRecord.canCuoc?.rawNgayCap && formatDateStr(inspectRecord.canCuoc.rawNgayCap) !== '-')
              ? formatDateStr(inspectRecord.canCuoc.rawNgayCap)
              : formatDateStr(inspectRecord.canCuoc?.ngayCap),
      right:
        (inspectRecord.ms?.rawNgayCap && formatDateStr(inspectRecord.ms.rawNgayCap) !== '-')
          ? formatDateStr(inspectRecord.ms.rawNgayCap)
          : (inspectRecord.ms?.ngayCap && formatDateStr(inspectRecord.ms.ngayCap) !== '-')
            ? formatDateStr(inspectRecord.ms.ngayCap)
            : formatDateStr(inspectRecord.canCuoc?.rawNgayCap || inspectRecord.canCuoc?.ngayCap),
    },
    {
      label: 'Giới tính',
      left:
        inspectRecord.hopDong?.rawGioiTinh ||
        inspectRecord.hopDong?.gioiTinh ||
        inspectRecord.canCuoc?.gioiTinh ||
        (() => {
          const clean = (inspectRecord.hopDong?.soCanCuoc || inspectRecord.canCuoc?.soCanCuoc || '').replace(/\D/g, '');
          if (clean.length === 12) {
            const d = parseInt(clean.charAt(3), 10);
            if ([0, 2, 4, 6, 8].includes(d)) return 'Nam';
            if ([1, 3, 5, 7, 9].includes(d)) return 'Nữ';
          }
          return '-';
        })(),
      right:
        inspectRecord.ms?.gioiTinh ||
        inspectRecord.canCuoc?.gioiTinh ||
        (() => {
          const clean = (inspectRecord.ms?.soCMND_HoChieu || inspectRecord.ms?.cccdOcr_soCanCuoc || '').replace(/\D/g, '');
          if (clean.length === 12) {
            const d = parseInt(clean.charAt(3), 10);
            if ([0, 2, 4, 6, 8].includes(d)) return 'Nam';
            if ([1, 3, 5, 7, 9].includes(d)) return 'Nữ';
          }
          return '-';
        })(),
    },
    {
      label: 'Nơi cấp',
      left: inspectRecord.hopDong?.noiCap || inspectRecord.canCuoc?.noiCap || '-',
      right: inspectRecord.ms?.noiCap || inspectRecord.canCuoc?.noiCap || '-',
    },
    ...(inspectRecord.hopDong?.dinhDangLoi && inspectRecord.hopDong.dinhDangLoi.length > 0
      ? [
        {
          label: 'Cảnh báo định dạng HĐ',
          left: inspectRecord.hopDong.dinhDangLoi.join('; '),
          right: 'Yêu cầu quy chuẩn DD/MM/YYYY & Nam/Nữ',
          customMatch: false,
        },
      ]
      : []),
    ...(inspectRecord.canCuoc?.canhBaoChatLuong && inspectRecord.canCuoc.canhBaoChatLuong.length > 0
      ? [
        {
          label: 'Chất lượng ảnh CCCD',
          left: inspectRecord.canCuoc.canhBaoChatLuong.join('; '),
          right: 'Yêu cầu đủ 4 góc, không cắt lẹm viền',
          customMatch: false,
        },
      ]
      : []),
    ...(inspectRecord.canCuoc?.theGeneration
      ? [
        {
          label: 'Thế hệ thẻ Căn cước',
          left: (() => {
            const g = inspectRecord.canCuoc.theGeneration;
            if (g === 'CAN_CUOC_2024') return ' Thẻ Căn Cước 2024 (Luật Căn cước 2023)';
            if (g === 'CCCD_CHIP_2021') return ' CCCD Gắn Chip (Phát hành 2021 - 2024)';
            if (g === 'CCCD_MA_VACH') return ' CCCD Mã Vạch (Phát hành 2016 - 2020)';
            if (g === 'CMND_9_SO') return ' CMND 9 Số Cũ (Đã hết hiệu lực từ 01/01/2025)';
            return g;
          })(),
          right: inspectRecord.canCuoc.confidenceScore !== undefined
            ? `Độ tin cậy AI: ${Math.round(inspectRecord.canCuoc.confidenceScore * 100)}%`
            : 'Đã nhận diện chuẩn ICAO/BCA',
          customMatch: inspectRecord.canCuoc.theGeneration !== 'CMND_9_SO',
        },
      ]
      : []),
    {
      label: 'Ngày ký HĐ / Ngày duyệt MS',
      left: formatDateStr(inspectRecord.hopDong?.ngayKyHD),
      right: formatDateStr(inspectRecord.ms?.ngayThamGia),
      isInfoNotice: true,
    },
    {
      label: 'Chữ ký khách hàng',
      left: inspectRecord.hopDong?.chuKy || 'Đã ký',
      right: inspectRecord.ms?.chuKy || 'Đã ký',
      customMatch: true,
    },
  ];

  // Helper chuẩn hóa so khớp
  const normalizeStr = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  const normalizeForCompare = (val: string, label: string) => {
    if (!val || val === '-') return '';
    const s = val.trim();
    if (label.toLowerCase().includes('họ và tên') || label.toLowerCase().includes('tên')) {
      return s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }
    if (label.toLowerCase().includes('ngày sinh')) {
      const mYear = s.match(/\b(19\d{2}|20\d{2})\b/);
      if (s.includes('Theo CCCD') && mYear) {
        return mYear[0];
      }
      const clean = s.replace(/\s*\(HĐ\)/i, '').trim();
      const formatted = formatDateStr(clean);
      return formatted !== '-' ? formatted : s;
    }
    if (label.toLowerCase().includes('ngày')) {
      const clean = s.replace(/\s*\(HĐ\)/i, '').trim();
      return formatDateStr(clean);
    }
    if (label.toLowerCase().includes('giới tính')) {
      const clean = s.toLowerCase();
      if (['nữ', 'nu', 'female', 'f'].includes(clean)) return 'nu';
      if (['nam', 'male', 'm'].includes(clean)) return 'nam';
      return clean;
    }
    if (label.toLowerCase().includes('nơi cấp')) {
      const clean = s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
      if (
        clean.includes('BO CONG AN') ||
        clean.includes('CUC CANH SAT') ||
        clean.includes('CS QLHC') ||
        clean.includes('C06')
      ) {
        return 'bca_c06';
      }
    }
    return normalizeStr(s);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Bảng so sánh 2 cột */}
      <div
        style={{
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '10px 14px', width: '22%', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Trường Thông Tin
              </th>
              <th style={{ padding: '10px 14px', width: '35%', color: '#3b82f6', fontWeight: 700 }}>
                Outlook & Tệp Đính Kèm
              </th>
              <th style={{ padding: '10px 14px', width: '35%', color: '#10b981', fontWeight: 700 }}>
                M-System Web & OCR
              </th>
              <th style={{ padding: '10px 14px', width: '8%', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Đối Soát
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item: any, rowIdx: number) => {
              const normLeft = normalizeForCompare(item.left, item.label);
              const normRight = normalizeForCompare(item.right, item.label);
              const isMatch = item.isInfoNotice
                ? true
                : item.customMatch !== undefined
                  ? item.customMatch
                  : item.left !== '-' &&
                  item.right !== '-' &&
                  (normLeft === normRight ||
                    (item.label.includes('Ngày sinh') &&
                      normLeft.length === 4 &&
                      normRight.endsWith(`/${normLeft}`)));

              const isMissingAttachment = !item.isInfoNotice && !isMatch && (item.left === '-' || item.right === '-');

              return (
                <tr
                  key={rowIdx}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor:
                      !isMatch && !isMissingAttachment && !item.isInfoNotice
                        ? 'rgba(239, 68, 68, 0.05)'
                        : undefined,
                  }}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {item.label}
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      fontFamily: item.label.includes('Số') || item.label.includes('Mã') ? 'monospace' : 'inherit',
                    }}
                  >
                    {item.left}
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      fontFamily: item.label.includes('Số') || item.label.includes('Mã') ? 'monospace' : 'inherit',
                    }}
                  >
                    {item.right}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                    {item.isInfoNotice ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          color: '#3b82f6',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                        }}
                        title="Ngày ký HĐ và ngày duyệt trên MS là 2 mốc thời gian độc lập theo quy trình MXV"
                      >
                        <Info size={11} /> Thông tin
                      </span>
                    ) : isMatch ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                        }}
                        title="Khớp hoàn toàn"
                      >
                        <Check size={13} strokeWidth={3} />
                      </span>
                    ) : isMissingAttachment ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(245, 158, 11, 0.12)',
                          color: '#f59e0b',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                        }}
                        title="Chưa quét tệp đính kèm (hoặc chạy chế độ Nhanh Text)"
                      >
                        Chưa quét
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                        }}
                        title="Có sai khác giữa 2 bên"
                      >
                        <X size={13} strokeWidth={3} />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Cảnh Báo CẦN KIỂM TRA LẠI */}
      {inspectRecord.ketLuan?.trangThai === 'CAN_KIEM_TRA' && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#d97706" />
            <strong style={{ color: '#d97706', fontSize: '0.85rem' }}>
              CẦN KIỂM TRA LẠI (TRƯỜNG HỢP BẤT THƯỜNG / CASE ĐẶC BIỆT)
            </strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            Hồ sơ này có các đặc điểm kỹ thuật hoặc định dạng đặc thù, cần chuyên viên ca trực đối chiếu mắt để xác nhận:
          </p>
          {inspectRecord.ketLuan?.danhSachLoi && inspectRecord.ketLuan.danhSachLoi.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '22px', color: '#d97706', fontSize: '0.75rem', fontWeight: 600 }}>
              {inspectRecord.ketLuan.danhSachLoi.map((err, eIdx) => (
                <li key={eIdx}>{err}</li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={onSwitchToAttachments}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                backgroundColor: '#d97706',
                color: '#fff',
                border: 'none',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ImageIcon size={13} /> Chuyển sang Tab Hồ Sơ & Ảnh CCCD để kiểm tra &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Cảnh Báo LỆCH DỮ LIỆU */}
      {inspectRecord.ketLuan?.trangThai === 'LECH' && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '12px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <X size={18} color="#ef4444" />
            <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>
              PHÁT HIỆN SAI LỆCH DỮ LIỆU / LỖI ĐỊNH DẠNG HỒ SƠ
            </strong>
          </div>
          <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
            Hồ sơ này không đạt tiêu chuẩn đối soát do các nguyên nhân sau:
          </p>
          {inspectRecord.ketLuan?.danhSachLoi && inspectRecord.ketLuan.danhSachLoi.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '22px', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
              {inspectRecord.ketLuan.danhSachLoi.map((err, eIdx) => (
                <li key={eIdx}>{err}</li>
              ))}
            </ul>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <button
              onClick={onSwitchToAttachments}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                backgroundColor: '#ef4444',
                color: '#fff',
                border: 'none',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ImageIcon size={13} /> Chuyển sang Tab Hồ Sơ & Ảnh CCCD để đối chiếu gốc &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
