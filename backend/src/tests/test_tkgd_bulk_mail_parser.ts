import {
  htmlToPlainText,
  extractBaseAccountCode,
  detectAccountType,
  TkgdAccountType,
} from '../modules/bot-engine/helpers/tkgd-mail-parser.helper';

export interface ParsedAccountGroup {
  maTKGDFutures: string | null;
  maTKGDACM: string | null;
  maTKGDLME: string | null;
  maTKGDSpread: string | null;
  maTKGDBase: string;
  maTVKD: string;
  tenTaiKhoan: string;
  tenTK: string;
  hasACMRequest: boolean;
  hasLMERequest: boolean;
  hasSpreadRequest: boolean;
  hasPL01Mention: boolean;
  allAccountCodes: Array<{
    code: string;
    baseCode: string;
    type: TkgdAccountType;
  }>;
}

function cleanPersonName(name?: string): string {
  if (!name) return '';
  let s = name.split(/[\r\n]/)[0].trim();
  s = s.replace(/\s+(TVKD|đã đính kèm|đề nghị|cam kết|kính gửi|Bản scan|HĐ|CCCD|CMND)[\s\S]*$/i, '').trim();
  s = s.replace(/^[ -:]+/, '').replace(/[;,.\-:]+$/, '').trim();
  return s;
}

export function parseAccountOpeningEmailMulti(bodyContent: string): ParsedAccountGroup[] {
  let text = bodyContent || '';
  if (/<[a-z][\s\S]*>/i.test(text)) {
    text = htmlToPlainText(text);
  }

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const groupsMap = new Map<string, ParsedAccountGroup>();

  // Regex nhận diện mã TKGD: 3 số + 1 chữ cái hoa + 7 số (có thể có hậu tố -A, -L, -S)
  const codeRegex = /\b([0-9]{3}[A-Z][0-9]{7}(?:-[ALS])?)\b/i;

  for (const line of lines) {
    const match = line.match(codeRegex);
    if (!match) continue;

    const rawCode = match[1].toUpperCase().trim();
    const baseCode = extractBaseAccountCode(rawCode);
    const maTVKD = baseCode.substring(0, 3);
    const accType = detectAccountType(rawCode);

    // Trích xuất tên đi kèm trên cùng dòng (phần nằm sau mã TKGD)
    const afterCode = line.substring(match.index! + match[0].length);
    const candidateName = cleanPersonName(afterCode);

    let existing = groupsMap.get(baseCode);
    if (!existing) {
      existing = {
        maTKGDFutures: accType === 'FUTURES' ? rawCode : baseCode,
        maTKGDACM: accType === 'ACM' ? rawCode : null,
        maTKGDLME: accType === 'LME' ? rawCode : null,
        maTKGDSpread: accType === 'SPREAD' ? rawCode : null,
        maTKGDBase: baseCode,
        maTVKD,
        tenTaiKhoan: candidateName || '',
        tenTK: candidateName || '',
        hasACMRequest: accType === 'ACM',
        hasLMERequest: accType === 'LME',
        hasSpreadRequest: accType === 'SPREAD',
        hasPL01Mention: accType === 'ACM',
        allAccountCodes: [{ code: rawCode, baseCode, type: accType }],
      };
      groupsMap.set(baseCode, existing);
    } else {
      if (accType === 'FUTURES') existing.maTKGDFutures = rawCode;
      if (accType === 'ACM') {
        existing.maTKGDACM = rawCode;
        existing.hasACMRequest = true;
        existing.hasPL01Mention = true;
      }
      if (accType === 'LME') {
        existing.maTKGDLME = rawCode;
        existing.hasLMERequest = true;
      }
      if (accType === 'SPREAD') {
        existing.maTKGDSpread = rawCode;
        existing.hasSpreadRequest = true;
      }
      if (!existing.tenTaiKhoan && candidateName) {
        existing.tenTaiKhoan = candidateName;
        existing.tenTK = candidateName;
      }
      if (!existing.allAccountCodes.some(c => c.code === rawCode)) {
        existing.allAccountCodes.push({ code: rawCode, baseCode, type: accType });
      }
    }
  }

  return Array.from(groupsMap.values());
}

// TEST VỚI EMAIL THỰC TẾ TRONG ẢNH CỦA USER
const sampleEmailFromUser = `
Kính gửi: Trung tâm Thanh toán bù trừ - Sở Giao dịch Hàng Hóa Việt Nam,

1. Xuất phát từ yêu cầu mở TKGD của Khách hàng, TVKD 036 đề nghị Sở Giao dịch Hàng Hóa Việt Nam hỗ trợ mở TKGD mới cho Khách hàng. Chi tiết như sau:
036C8253769    Nguyễn Thị Tuyền
036C8253769-A  Nguyễn Thị Tuyền

036C0141369-Võ Thị Minh Huyền
036C0141369-A-Võ Thị Minh Huyền
036C8888871 Hoàng Thị Lan
036C8888871 Hoàng Thị Lan

TVKD 036 đã đính kèm hồ sơ đầy đủ trong email này, bao gồm:
- Bản scan trang 01 của Hợp đồng mở TKGD (đầy đủ chữ ký, con dấu của TVKD và KH);
- Bản scan CMND/CCCD/Hộ chiếu (bản gốc) của KH cá nhân;
`;

console.log('=== KẾT QUẢ PARSE EMAIL GOM ===');
const result = parseAccountOpeningEmailMulti(sampleEmailFromUser);
console.log(`Tìm thấy ${result.length} khách hàng:`);
result.forEach((g, idx) => {
  console.log(`\n[Khách ${idx + 1}] Mã Base: ${g.maTKGDBase} | TVKD: ${g.maTVKD} | Tên: ${g.tenTaiKhoan}`);
  console.log(`  Futures: ${g.maTKGDFutures} | ACM: ${g.maTKGDACM} | hasACM: ${g.hasACMRequest}`);
  console.log(`  SubAccounts:`, g.allAccountCodes);
});
