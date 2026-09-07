const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');

dotenv.config({ path: path.join(__dirname, '../../.env') });
const MONGODB_URI = process.env.MONGODB_URI;

async function main() {
  await mongoose.connect(MONGODB_URI);
  const userConfigColl = mongoose.connection.collection('tkgd_user_configs');
  const cleanColl = mongoose.connection.collection('clean_account_records');

  const userConfig = await userConfigColl.findOne({ userEmail: 'hieptruong@mxv.vn' });
  const refreshToken = userConfig?.outlook?.refreshToken;
  const clientId = userConfig?.outlook?.clientId || process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = userConfig?.outlook?.clientSecret || process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = userConfig?.outlook?.tenantId || process.env.MICROSOFT_TENANT_ID || 'common';

  console.log('1. Lấy Access Token từ Microsoft Graph API...');
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    console.error('Lỗi lấy token:', tokenData);
    await mongoose.disconnect();
    return;
  }
  const accessToken = tokenData.access_token;

  const testcases = [
    { code: '003C1399395', msgId: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQhAAA=' },
    { code: '003C8946619', msgId: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQiAAA=' },
    { code: '003C9462626', msgId: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQjAAA=' },
    { code: '003C8669767', msgId: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQgAAA=' },
    { code: '003C2795169', msgId: 'AAMkADg4NzQ3MGEzLThmZDktNDAyOC05MTg1LWI3ZmQ4ZmRiMWJjNABGAAAAAAAKB6_8Ue2cQqTQhAlwC9cUBwCPqzoTO0UbSYcuL7KVsnHLAAAAAAEMAACPqzoTO0UbSYcuL7KVsnHLAABHOoQfAAA=' },
  ];

  for (const item of testcases) {
    const code = item.code;
    console.log('\n' + '='.repeat(80));
    console.log(`🔎 KIỂM TRA TÀI KHOẢN: ${code}`);
    console.log('='.repeat(80));

    // Lấy thông tin từ M-System trong DB
    const cleanDoc = await cleanColl.findOne({
      $or: [{ maTKGD: code }, { maTKGDBase: code }, { 'noiDungMail.maTKGD_Futures': code }]
    });

    console.log('📌 [DỮ LIỆU TRÊN M-SYSTEM (MS)]');
    if (cleanDoc && cleanDoc.ms) {
      console.log(`   - Mã TKGD:        ${cleanDoc.ms.maTKGD}`);
      console.log(`   - Họ và tên:      ${cleanDoc.ms.hoVaTen}`);
      console.log(`   - Số CCCD:        ${cleanDoc.ms.soCMND_HoChieu}`);
      console.log(`   - Ngày sinh:      ${cleanDoc.ms.ngaySinh ? new Date(cleanDoc.ms.ngaySinh).toLocaleDateString('vi-VN') : 'N/A'}`);
      console.log(`   - Ngày cấp:       ${cleanDoc.ms.ngayCap ? new Date(cleanDoc.ms.ngayCap).toLocaleDateString('vi-VN') : 'N/A'}`);
      console.log(`   - Nơi cấp:        ${cleanDoc.ms.noiCap || 'N/A'}`);
      console.log(`   - Loại hình TK:   ${cleanDoc.ms.loaiHinhTaiKhoan || 'N/A'}`);
      console.log(`   - Trạng thái:     ${cleanDoc.ms.trangThai || 'N/A'}`);
      console.log(`   - Ảnh CCCD trước: ${cleanDoc.ms.cccdMatTruocLocalPath ? 'Có' : 'Không'}`);
      console.log(`   - Ảnh CCCD sau:   ${cleanDoc.ms.cccdMatSauLocalPath ? 'Có' : 'Không'}`);
    } else {
      console.log('   ❌ Không tìm thấy thông tin trên M-System!');
    }

    const foundMsg = { id: item.msgId, subject: 'Fw: Yêu cầu mở TKGD' };

    if (!foundMsg) {
      console.log(`\n📌 [OUTLOOK EMAIL]: Không tìm thấy email chứa mã ${code}`);
      continue;
    }

    console.log(`\n📌 [OUTLOOK EMAIL]: Subject: "${foundMsg.subject}" (ID: ${foundMsg.id.slice(0, 20)}...)`);

    // Tải attachments
    const aRes = await fetch(`https://graph.microsoft.com/v1.0/me/messages/${foundMsg.id}/attachments`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const aData = await aRes.json();
    const attachments = aData.value || [];
    console.log(`   Số tệp đính kèm: ${attachments.length}`);

    for (const a of attachments) {
      console.log(`   📎 Tệp: ${a.name} (${a.contentType}, ${a.size} bytes)`);
      if (a.name.toLowerCase().endsWith('.pdf') && a.contentBytes) {
        const buf = Buffer.from(a.contentBytes, 'base64');
        try {
          const pdfModule = require('pdf-parse');
          let text = '';
          if (typeof pdfModule === 'function') {
            text = (await pdfModule(buf)).text || '';
          } else if (pdfModule.PDFParse) {
            const parser = new pdfModule.PDFParse({ data: buf });
            const pRes = await parser.getText();
            text = pRes.text || '';
            await parser.destroy();
          } else if (typeof pdfModule.default === 'function') {
            text = (await pdfModule.default(buf)).text || '';
          } else if (pdfModule.default && pdfModule.default.PDFParse) {
            const parser = new pdfModule.default.PDFParse({ data: buf });
            const pRes = await parser.getText();
            text = pRes.text || '';
            await parser.destroy();
          }
          console.log(`\n   --- 📄 NỘI DUNG BÓC TÁCH TỪ ${a.name} ---`);
          
          // Trích xuất các trường
          const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
          
          // Trích xuất họ tên
          const nameM = text.match(/(?:Họ\s*(?:và\s*)?tên|Tên\s*khách\s*hàng|Khách\s*hàng|Ông\/Bà)[\s:\.\-]+([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]{4,40})(?:\r?\n|,|$)/iu);
          // Trích xuất CCCD
          const cccdM = text.match(/(?:CCCD|CMND|CMT|ĐDCN|Định\s*danh(?:\s*cá\s*nhân)?|Hộ\s*chiếu)[\/\s\w\-–—]*[:\s]+([0-9]{9,12})\b/i);
          // Trích xuất Ngày sinh
          const dobM = text.match(/(?:Ngày(?:\s*tháng\s*năm)?\s*sinh|Sinh\s*ngày|Năm\s*sinh|DOB)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i);
          // Trích xuất Ngày cấp
          const capM = text.match(/(?:Ngày\s*cấp|Cấp\s*ngày|Date\s*of\s*issue)[\s:\.\-]+(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i);
          // Trích xuất Nơi cấp
          const noiCapM = text.match(/(?:Nơi\s*cấp|Place\s*of\s*issue)[\s:\.\-]+([^\r\n;,]+?)(?=(?:\s+ngày|\s+tại|\s+hạn|\s+quốc|\r?\n|$))/i);
          // Trích xuất Giới tính
          const genderM = text.match(/(?:Giới\s*tính|Gender)[\s:\.\-]+(Nam|Nữ|Nu|Male|Female)/i);

          console.log(`      * Họ và tên:   ${nameM ? nameM[1].trim() : 'N/A'}`);
          console.log(`      * Số CCCD:     ${cccdM ? cccdM[1].trim() : 'N/A'}`);
          console.log(`      * Ngày sinh:   ${dobM ? dobM[1].trim() : 'N/A'}`);
          console.log(`      * Ngày cấp:    ${capM ? capM[1].trim() : 'N/A'}`);
          console.log(`      * Nơi cấp:     ${noiCapM ? noiCapM[1].trim() : 'N/A'}`);
          console.log(`      * Giới tính:   ${genderM ? genderM[1].trim() : 'N/A'}`);

          // In trích đoạn chứa thông tin cá nhân trong PDF để đối chiếu chính xác
          console.log('      [Trích đoạn đoạn văn bản cá nhân trong PDF]:');
          const snippet = lines.filter(l => 
            /tên|sinh|căn cước|cccd|cmnd|ngày cấp|nơi cấp|giới tính|địa chỉ|nam|nữ/i.test(l)
          ).slice(0, 15);
          snippet.forEach(s => console.log(`         > ${s}`));

        } catch (err) {
          console.log(`      ❌ Lỗi parse PDF: ${err.message}`);
        }
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
