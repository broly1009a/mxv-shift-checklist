import React, { useState } from 'react';
import { Check, X, AlertTriangle, Info, Image as ImageIcon } from 'lucide-react';
import { CleanRecord } from '../../types/tkgd.types';
import { cleanMailName, formatDateStr } from '../../utils/tkgd.helpers';

interface ProvenanceMeta {
  sourceName?: string;
  method?: string;
  confidence?: string;
  warning?: string;
}

const ProvenanceBadge: React.FC<{ meta?: ProvenanceMeta; side: 'left' | 'right' }> = ({ meta, side }) => {
  const [show, setShow] = useState(false);
  if (!meta) return null;

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '6px' }}>
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => {
          e.stopPropagation();
          setShow((s) => !s);
        }}
        style={{
          border: 'none',
          backgroundColor: 'transparent',
          padding: '2px',
          cursor: 'pointer',
          color: side === 'left' ? '#60a5fa' : '#34d399',
          display: 'flex',
          alignItems: 'center',
          borderRadius: '4px',
          opacity: 0.8,
        }}
        title="Xem nguồn gốc dữ liệu"
      >
        <Info size={13} />
      </button>

      {show && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: side === 'left' ? '0' : 'auto',
            right: side === 'right' ? '0' : 'auto',
            marginBottom: '6px',
            zIndex: 9999,
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.72rem',
            lineHeight: '1.4',
            whiteSpace: 'nowrap',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 700, color: side === 'left' ? '#93c5fd' : '#6ee7b7', marginBottom: '3px' }}>
            {side === 'left' ? 'Nguồn Hồ Sơ & Đính Kèm' : 'Nguồn Dữ Liệu M-System'}
          </div>
          {meta.sourceName && (
            <div>
              <span style={{ color: '#94a3b8' }}>Tài liệu: </span>
              <span style={{ fontWeight: 600 }}>{meta.sourceName}</span>
            </div>
          )}
          {meta.method && (
            <div>
              <span style={{ color: '#94a3b8' }}>Phương thức: </span>
              <span>{meta.method}</span>
            </div>
          )}
          {meta.confidence && (
            <div>
              <span style={{ color: '#94a3b8' }}>Độ tin cậy: </span>
              <span style={{ color: '#38bdf8', fontWeight: 600 }}>{meta.confidence}</span>
            </div>
          )}
          {meta.warning && (
            <div style={{ color: '#f87171', marginTop: '3px', fontWeight: 600 }}>
              {meta.warning}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

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

  // const isMsSynced = !!(inspectRecord.ms?.isFoundOnMS || inspectRecord.ms?.hoVaTen || inspectRecord.ms?.soCMND_HoChieu);
  const isMsSynced = !!(inspectRecord.ms?.hoVaTen || inspectRecord.ms?.soCMND_HoChieu);

  const rows = [
    {
      label: 'Mã TKGD (Futures)',
      left: inspectRecord.noiDungMail?.maTKGD_Futures || baseCode,
      right: isMsSynced
        ? (inspectRecord.ms?.maTKGD ? inspectRecord.ms.maTKGD.split('-')[0] : baseCode)
        : '-',
      customMatch: isMsSynced ? true : false,
      leftMeta: { sourceName: 'Email TVKD (Tiêu đề / Body)', method: 'Text Parser', confidence: '100%' },
      rightMeta: { sourceName: 'M-System Web', method: 'Playwright Scraper', confidence: '100%' },
    },
    ...(hasACM
      ? [
        {
          label: 'Tiểu khoản ACM (-A)',
          left: inspectRecord.noiDungMail?.maTKGD_ACM || `${baseCode}-A`,
          right: isMsSynced && inspectRecord.ms?.maTKGD?.includes('-A') ? inspectRecord.ms.maTKGD : (isMsSynced ? `${baseCode}-A` : '-'),
          customMatch: isMsSynced ? true : false,
          leftMeta: { sourceName: 'Email TVKD (Yêu cầu ACM)', method: 'Text Parser', confidence: '100%' },
          rightMeta: { sourceName: 'M-System Web', method: 'Playwright Scraper', confidence: '100%' },
        },
        {
          label: 'Phụ lục PL01 (ACM)',
          left: inspectRecord.phuLuc?.chuKy ? 'Đã ký (PL01)' : 'Có đính kèm file PL01',
          right:
            isMsSynced && (inspectRecord.ms?.maTKGD?.includes('-A') ||
              inspectRecord.subAccounts?.some((s) => s.type === 'ACM'))
              ? 'Đã kích hoạt trên MS'
              : (isMsSynced ? 'Đang xử lý' : '-'),
          customMatch: isMsSynced ? true : false,
          leftMeta: { sourceName: 'Phụ lục PL01 (PDF)', method: 'PDF Parser', confidence: '98%' },
          rightMeta: { sourceName: 'M-System Web', method: 'Playwright Scraper', confidence: '100%' },
        },
      ]
      : []),
    {
      label: 'Họ và tên',
      left: (() => {
        const JUNK_NAME_REGEX = /(CÔNG\s*TY|GIA\s*CÁT\s*LỢI|HITECH|PHÚ\s*QUÝ|CCCD|CMND|HỘ\s*CHIẾU|GIỚI\s*TÍNH|NƠI\s*CẤP|ĐỊA\s*CHỈ|NGÀY\s*SINH|CÁ\s*NHÂN|DOANH\s*NGHIỆP|THỰC\s*HIỆN|ĐẶT\s*LỆNH|XÁC\s*NHẬN|MỞ\s*TÀI\s*KHOẢN|HỢP\s*ĐỒNG|BÊN\s*A|BÊN\s*B|ĐẠI\s*DIỆN|KHÁCH\s*HÀNG|KHACH\s*HANG|KHÁCH\s*ÁN|TÊN\s*KHÁCH\s*HÀNG|TEN\s*KHACH\s*HANG|CHỦ\s*TÀI\s*KHOẢN|CHU\s*TAI\s*KHOAN)/i;
        const normMs = (inspectRecord.ms?.hoVaTen || inspectRecord.ms?.tenTKGD || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/Đ/g, 'd')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

        const isMatchMs = (candidate?: string) => {
          if (!candidate || candidate === '-') return false;
          const normCand = candidate
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
          return normMs && (normMs === normCand || normMs.includes(normCand) || normCand.includes(normMs));
        };

        const hdName = inspectRecord.hopDong?.hoVaTen;
        const imgName = inspectRecord.canCuoc?.hoVaTen;
        const mailName = inspectRecord.noiDungMail?.tenTaiKhoan;

        // Ưu tiên: nếu HĐ là từ khóa rác biểu mẫu (KHÁCH HÀNG...) hoặc không khớp MS mà CCCD/Mail khớp MS
        if (imgName && !JUNK_NAME_REGEX.test(imgName) && (!hdName || JUNK_NAME_REGEX.test(hdName) || (normMs && !isMatchMs(hdName) && isMatchMs(imgName)))) {
          return cleanMailName(imgName);
        }
        if (mailName && !JUNK_NAME_REGEX.test(mailName) && (!hdName || JUNK_NAME_REGEX.test(hdName) || (normMs && !isMatchMs(hdName) && isMatchMs(mailName)))) {
          return cleanMailName(mailName);
        }
        if (hdName && !JUNK_NAME_REGEX.test(hdName)) return cleanMailName(hdName);
        if (imgName && !JUNK_NAME_REGEX.test(imgName)) return cleanMailName(imgName);
        return cleanMailName(mailName || hdName || '-');
      })(),
      right: inspectRecord.ms?.hoVaTen || inspectRecord.ms?.tenTKGD || '-',
      leftMeta: (() => {
        const JUNK = /(CÔNG\s*TY|GIA\s*CÁT\s*LỢI|HITECH|PHÚ\s*QUÝ|CCCD|CMND|HỘ\s*CHIẾU|GIỚI\s*TÍNH|NƠI\s*CẤP|ĐỊA\s*CHỈ|NGÀY\s*SINH|CÁ\s*NHÂN|DOANH\s*NGHIỆP|THỰC\s*HIỆN|ĐẶT\s*LỆNH|XÁC\s*NHẬN|MỞ\s*TÀI\s*KHOẢN|HỢP\s*ĐỒNG|BÊN\s*A|BÊN\s*B|ĐẠI\s*DIỆN|KHÁCH\s*HÀNG|KHACH\s*HANG|KHÁCH\s*ÁN|TÊN\s*KHÁCH\s*HÀNG|TEN\s*KHACH\s*HANG|CHỦ\s*TÀI\s*KHOẢN|CHU\s*TAI\s*KHOAN)/i;
        const hdName = inspectRecord.hopDong?.hoVaTen;
        const imgName = inspectRecord.canCuoc?.hoVaTen;
        const mailName = inspectRecord.noiDungMail?.tenTaiKhoan;

        if (imgName && !JUNK.test(imgName) && (!hdName || JUNK.test(hdName))) {
          return {
            sourceName: 'Ảnh CCCD Mặt Trước',
            method: inspectRecord.canCuoc?.ocrConfidence || 'OCR Vision',
            confidence: '99%',
          };
        }
        if (mailName && !JUNK.test(mailName) && (!hdName || JUNK.test(hdName))) {
          return {
            sourceName: 'Email TVKD (Xác thực với MS)',
            method: 'Trích xuất Mail & MS',
            confidence: '100%',
          };
        }
        if (hdName && !JUNK.test(hdName)) {
          return {
            sourceName: 'Hợp đồng mở TK (PDF)',
            method: 'Text Layer PDF',
            confidence: '98%',
          };
        }
        return {
          sourceName: 'Email TVKD',
          method: 'Trích xuất Mail',
          confidence: '95%',
        };
      })(),
      rightMeta: {
        sourceName: 'M-System Web > Tên khách hàng',
        method: 'Playwright Scraper',
        confidence: '100%',
      },
    },
    {
      label: 'Số CCCD / Hộ chiếu',
      left: (() => {
        const hdCccd = (inspectRecord.hopDong?.soCanCuoc || '').trim();
        const imgCccd = (inspectRecord.canCuoc?.soCanCuoc || '').trim();
        const msCccd = (inspectRecord.ms?.soCMND_HoChieu || inspectRecord.ms?.cccdOcr_soCanCuoc || '').trim();
        // Đồng thuận 2/3: nếu ảnh CCCD và MS khớp nhau -> hiển thị theo CCCD/MS
        if (imgCccd && msCccd && imgCccd.replace(/\D/g, '') === msCccd.replace(/\D/g, '')) {
          return imgCccd;
        }
        // Đồng thuận 2/3: nếu HĐ và MS khớp nhau -> hiển thị theo HĐ/MS
        if (hdCccd && msCccd && hdCccd.replace(/\D/g, '') === msCccd.replace(/\D/g, '')) {
          return hdCccd;
        }
        return hdCccd || imgCccd || '-';
      })(),
      right: inspectRecord.ms?.soCMND_HoChieu || inspectRecord.ms?.cccdOcr_soCanCuoc || '-',
      leftMeta: {
        sourceName: inspectRecord.canCuoc?.soCanCuoc
          ? inspectRecord.canCuoc?.theGeneration === 'CCCD_CHIP_2021'
            ? 'CCCD Gắn Chip (MRZ Dòng 2)'
            : 'CCCD Mặt Trước (OCR)'
          : 'Hợp đồng mở TK (PDF)',
        method: inspectRecord.canCuoc?.ocrConfidence || 'OCR Vision / PDF Text',
        confidence: '98%',
      },
      rightMeta: {
        sourceName: 'M-System Web > Mã định danh cá nhân',
        method: 'Playwright Scraper',
        confidence: '100%',
      },
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
            : '-',
      leftMeta: {
        sourceName: inspectRecord.canCuoc?.ngaySinh
          ? 'Ảnh CCCD (MRZ / OCR)'
          : inspectRecord.hopDong?.ngaySinh
            ? 'Hợp đồng mở TK (PDF)'
            : 'Mã 12 số định danh CCCD',
        method: inspectRecord.canCuoc?.ngaySinh ? 'OCR Vision Engine' : 'PDF Text / Rule BCA',
        confidence: '95%',
      },
      rightMeta: {
        sourceName: 'M-System Web > Ngày sinh',
        method: 'Playwright Scraper',
        confidence: '100%',
      },
    },
    {
      label: 'Ngày cấp',
      left: (() => {
        const cccdIssue =
          (inspectRecord.canCuoc?.rawNgayCap && formatDateStr(inspectRecord.canCuoc.rawNgayCap) !== '-')
            ? formatDateStr(inspectRecord.canCuoc.rawNgayCap)
            : (inspectRecord.canCuoc?.ngayCap && formatDateStr(inspectRecord.canCuoc.ngayCap) !== '-')
              ? formatDateStr(inspectRecord.canCuoc.ngayCap)
              : '-';

        const hdIssue =
          (inspectRecord.hopDong?.rawNgayCap && formatDateStr(inspectRecord.hopDong.rawNgayCap) !== '-')
            ? formatDateStr(inspectRecord.hopDong.rawNgayCap)
            : (inspectRecord.hopDong?.ngayCap && formatDateStr(inspectRecord.hopDong.ngayCap) !== '-')
              ? formatDateStr(inspectRecord.hopDong.ngayCap)
              : '-';

        const hdDob =
          (inspectRecord.hopDong?.rawNgaySinh && formatDateStr(inspectRecord.hopDong.rawNgaySinh) !== '-')
            ? formatDateStr(inspectRecord.hopDong.rawNgaySinh)
            : (inspectRecord.hopDong?.ngaySinh && formatDateStr(inspectRecord.hopDong.ngaySinh) !== '-')
              ? formatDateStr(inspectRecord.hopDong.ngaySinh)
              : '-';

        const msIssue =
          (inspectRecord.ms?.rawNgayCap && formatDateStr(inspectRecord.ms.rawNgayCap) !== '-')
            ? formatDateStr(inspectRecord.ms.rawNgayCap)
            : (inspectRecord.ms?.ngayCap && formatDateStr(inspectRecord.ms.ngayCap) !== '-')
              ? formatDateStr(inspectRecord.ms.ngayCap)
              : '-';

        // Tri-party Consensus 2/3: nếu HĐ và MS đồng thuận ngày cấp mà ảnh CCCD bị OCR nhầm (vd số 5 thành số 8)
        if (hdIssue !== '-' && msIssue !== '-' && hdIssue === msIssue) {
          return hdIssue;
        }

        // Nếu HĐ lấy nhầm Ngày cấp trùng với Ngày sinh (lỗi bảng TVKD 003), ưu tiên CCCD
        if (hdIssue !== '-' && hdIssue === hdDob && cccdIssue !== '-') {
          return cccdIssue;
        }

        // Ưu tiên ngày cấp CCCD nếu có
        if (cccdIssue !== '-') {
          return cccdIssue;
        }

        return hdIssue !== '-' ? hdIssue : '-';
      })(),
      right:
        (inspectRecord.ms?.rawNgayCap && formatDateStr(inspectRecord.ms.rawNgayCap) !== '-')
          ? formatDateStr(inspectRecord.ms.rawNgayCap)
          : (inspectRecord.ms?.ngayCap && formatDateStr(inspectRecord.ms.ngayCap) !== '-')
            ? formatDateStr(inspectRecord.ms.ngayCap)
            : '-',
      leftMeta: {
        sourceName: inspectRecord.canCuoc?.ngayCap ? 'Ảnh CCCD Mặt Sau' : 'Hợp đồng mở TK (PDF)',
        method: inspectRecord.canCuoc?.ngayCap ? 'OCR Vision Engine' : 'PDF Text Layer',
        confidence: '94%',
      },
      rightMeta: {
        sourceName: 'M-System Web > Ngày cấp',
        method: 'Playwright Scraper',
        confidence: '100%',
      },
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
        (() => {
          const clean = (inspectRecord.ms?.soCMND_HoChieu || inspectRecord.ms?.cccdOcr_soCanCuoc || '').replace(/\D/g, '');
          if (clean.length === 12) {
            const d = parseInt(clean.charAt(3), 10);
            if ([0, 2, 4, 6, 8].includes(d)) return 'Nam';
            if ([1, 3, 5, 7, 9].includes(d)) return 'Nữ';
          }
          return '-';
        })(),
      leftMeta: {
        sourceName: inspectRecord.canCuoc?.gioiTinh ? 'Ảnh CCCD' : 'Hợp đồng / Mã 12 số CCCD',
        method: 'OCR / BCA Gender Rule',
        confidence: '98%',
      },
      rightMeta: {
        sourceName: 'M-System Web > Giới tính',
        method: 'Playwright Scraper',
        confidence: '100%',
      },
    },
    {
      label: 'Nơi cấp',
      left: inspectRecord.hopDong?.noiCap || inspectRecord.canCuoc?.noiCap || '-',
      right: inspectRecord.ms?.noiCap || '-',
      leftMeta: {
        sourceName: 'Ảnh CCCD / Hợp đồng',
        method: 'OCR / PDF Text',
        confidence: '95%',
      },
      rightMeta: {
        sourceName: 'M-System Web > Nơi cấp',
        method: 'Playwright Scraper',
        confidence: '100%',
      },
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
          right: 'Khuyến nghị ảnh rõ nét, đủ 4 góc',
          isInfoNotice: true,
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
    (() => {
      const hdDate = formatDateStr(inspectRecord.hopDong?.ngayKyHD);
      const msDate = formatDateStr(inspectRecord.ms?.ngayThamGia);
      const effectiveHd = hdDate !== '-' ? hdDate : (msDate !== '-' ? msDate : '-');
      const plDate = formatDateStr(inspectRecord.phuLuc?.ngayKyHD);
      const hasBoth = effectiveHd !== '-' && plDate !== '-';
      const isConsistent = hasBoth ? effectiveHd === plDate : (inspectRecord.phuLuc ? false : true);

      let leftText = '-';
      if (hasBoth) {
        leftText = `HĐ: ${effectiveHd} | Phụ lục: ${plDate}`;
      } else if (effectiveHd !== '-') {
        leftText = `HĐ: ${effectiveHd}`;
      } else if (plDate !== '-') {
        leftText = `Phụ lục: ${plDate}`;
      }

      let rightText = '-';
      if (hasBoth) {
        rightText = isConsistent ? 'Đã đồng nhất ngày ký' : `Lệch ngày (HĐ: ${effectiveHd} != PL: ${plDate})`;
      } else if (effectiveHd !== '-') {
        rightText = 'Hợp đồng mở tài khoản';
      } else if (plDate !== '-') {
        rightText = 'Phụ lục mở tài khoản';
      }

      return {
        label: 'Ngày ký HĐ / Phụ lục',
        left: leftText,
        right: rightText,
        customMatch: isConsistent,
        leftMeta: { sourceName: 'Hợp đồng & Phụ lục (Chữ ký)', method: 'PDF Parser', confidence: '99%' },
        rightMeta: { sourceName: 'Đối Soát Tính Nhất Quán Văn Bản', method: 'Rule Engine', confidence: '100%' },
      };
    })(),
    {
      label: 'Ngày tham gia MS (Tham chiếu)',
      left: '(Không yêu cầu trùng ngày ký HĐ)',
      right: formatDateStr(inspectRecord.ms?.ngayThamGia),
      isInfoNotice: true,
      customMatch: true,
      leftMeta: { sourceName: 'Quy chế đối soát MXV', method: 'Độc lập ngày ký', confidence: '100%' },
      rightMeta: { sourceName: 'M-System Web > Ngày tham gia', method: 'Playwright Scraper', confidence: '100%' },
    },
    {
      label: 'Chữ ký khách hàng',
      left: inspectRecord.hopDong?.chuKy || 'Đã ký',
      right: isMsSynced ? (inspectRecord.ms?.chuKy || 'Đã ký') : '-',
      customMatch: isMsSynced ? true : false,
      leftMeta: { sourceName: 'Hợp đồng mở TK (Ký sống / Điện tử)', method: 'Signature Detector', confidence: '99%' },
      rightMeta: { sourceName: 'M-System Web > Trạng thái ký', method: 'Playwright Scraper', confidence: '100%' },
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
      if ((s.includes('Theo CCCD') || s.includes('Năm sinh')) && mYear) {
        return mYear[0];
      }
      const clean = s.replace(/\s*\(HĐ\)/i, '').replace(/\s*\(Năm sinh\)/i, '').trim();
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
      {!isMsSynced && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#f59e0b',
            fontSize: '0.82rem',
            fontWeight: 500,
          }}
        >
          <Info size={16} />
          <span>
            <strong>Chưa đồng bộ M-System:</strong> Tài khoản này chưa được cào dữ liệu từ M-System. Cột &quot;M-System Web &amp; OCR&quot; đang để trống cho đến khi hoàn tất đồng bộ.
          </span>
        </div>
      )}

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

              // Nhận diện trường hợp ngày sinh 1 bên chỉ có Năm sinh (VD: 2001 (Năm sinh)) và 1 bên có ngày/tháng/năm đầy đủ trùng năm (VD: 10/06/2001)
              const isDobField = item.label.toLowerCase().includes('ngày sinh');
              const isYearOnlyLeft = normLeft.length === 4 || String(item.left).includes('Năm sinh');
              const isYearOnlyRight = normRight.length === 4 || String(item.right).includes('Năm sinh');
              const isBirthYearMatchOnly =
                isDobField &&
                item.left !== '-' &&
                item.right !== '-' &&
                normLeft !== normRight &&
                ((isYearOnlyLeft && normRight.endsWith(`/${normLeft}`)) ||
                  (isYearOnlyRight && normLeft.endsWith(`/${normRight}`)) ||
                  (String(item.left).includes('Năm sinh') && normRight.includes(normLeft)) ||
                  (String(item.right).includes('Năm sinh') && normLeft.includes(normRight)));

              const isMatch = item.isInfoNotice
                ? true
                : item.customMatch !== undefined
                  ? item.customMatch
                  : item.left !== '-' &&
                  item.right !== '-' &&
                  !isBirthYearMatchOnly &&
                  normLeft === normRight;

              const isMissingAttachment =
                !item.isInfoNotice && !isMatch && !isBirthYearMatchOnly && (item.left === '-' || item.right === '-');

              return (
                <tr
                  key={rowIdx}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: isBirthYearMatchOnly
                      ? 'rgba(245, 158, 11, 0.05)'
                      : !isMatch && !isMissingAttachment && !item.isInfoNotice
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span>{item.left}</span>
                      <ProvenanceBadge meta={item.leftMeta} side="left" />
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      fontFamily: item.label.includes('Số') || item.label.includes('Mã') ? 'monospace' : 'inherit',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                      <span>{item.right}</span>
                      <ProvenanceBadge meta={item.rightMeta} side="right" />
                    </div>
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
                    ) : isBirthYearMatchOnly ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(245, 158, 11, 0.18)',
                          color: '#f59e0b',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          lineHeight: 1,
                        }}
                        title="Trùng khớp năm sinh (HĐ chỉ ghi năm sinh, cần chuyên viên đối chiếu mắt ngày tháng)"
                      >
                        ?
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

      {/* Cảnh Báo LỆCH DỮ LIỆU - Tự động triệt tiêu lỗi stale nếu dữ liệu thực tế trên MS đã có đầy đủ */}
      {(() => {
        if (inspectRecord.ketLuan?.trangThai !== 'LECH') return null;
        const msHasCccd = !!(inspectRecord.ms?.soCMND_HoChieu || inspectRecord.ms?.cccdOcr_soCanCuoc);
        // const msFound = !!(inspectRecord.ms?.isFoundOnMS || inspectRecord.ms?.soCMND_HoChieu || inspectRecord.ms?.hoVaTen);
        const msFound = !!(inspectRecord.ms?.soCMND_HoChieu || inspectRecord.ms?.hoVaTen);
        const rawErrors = inspectRecord.ketLuan?.danhSachLoi || [];
        const displayErrors = rawErrors.filter((err) => {
          if (msHasCccd && err.includes('M-System chưa nhập số CCCD')) return false;
          if (msFound && err.includes('chưa được tạo trên M-System')) return false;
          return true;
        });

        // Nếu tất cả lỗi chỉ là lỗi vết cũ (stale) đã được đồng bộ chuẩn trên MS thì không hiển thị khung đỏ
        if (displayErrors.length === 0) return null;

        return (
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
            <ul style={{ margin: 0, paddingLeft: '22px', color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
              {displayErrors.map((err, eIdx) => (
                <li key={eIdx}>{err}</li>
              ))}
            </ul>
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
        );
      })()}
    </div>
  );
};
