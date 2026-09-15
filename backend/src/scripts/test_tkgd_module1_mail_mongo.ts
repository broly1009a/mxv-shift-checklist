/**
 * TEST SCRIPT: MODULE 1 — Đọc Mail & Lưu Trữ Raw + Clean Data (NoiDungMail) vào MongoDB
 * 
 * Cách chạy:
 * npx ts-node src/scripts/test_tkgd_module1_mail_mongo.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import mongoose from 'mongoose';
import {
  RawAccountMailSchema,
  RawAccountMail,
} from '../schemas/raw-account-mail.schema';
import {
  CleanAccountRecordSchema,
  CleanAccountRecord,
} from '../schemas/clean-account-record.schema';
import {
  parseAccountOpeningEmailBody,
  classifyAttachmentType,
} from '../modules/bot-engine/helpers/tkgd-mail-parser.helper';

// 1. Nạp biến môi trường
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function runModule1Test() {
  console.log('='.repeat(70));
  console.log(' KIỂM THỬ MODULE 1: ĐỌC MAIL & LƯU MONGODB (RAW + CLEAN NOIDUNGMAIL)');
  console.log('='.repeat(70));

  // 2. Kết nối MongoDB
  console.log('\n[1] Đang kết nối tới MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log(' Kết nối MongoDB thành công!');

  const RawMailModel = mongoose.model('RawAccountMail', RawAccountMailSchema);
  const CleanRecordModel = mongoose.model(
    'CleanAccountRecord',
    CleanAccountRecordSchema,
  );

  // 3. Đọc dữ liệu mẫu từ thư mục POC
  const mailSamplesDir = path.resolve(
    __dirname,
    '../../../POC/TKGD-Automation/inputs/mail-outlook',
  );
  console.log(`\n[2] Đang quét mail mẫu từ: ${mailSamplesDir}`);

  if (!fs.existsSync(mailSamplesDir)) {
    throw new Error(`Không tìm thấy thư mục mail mẫu tại: ${mailSamplesDir}`);
  }

  const sampleDirs = fs
    .readdirSync(mailSamplesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(mailSamplesDir, d.name));

  console.log(`Tìm thấy ${sampleDirs.length} mẫu mail thực tế.`);

  const todayStr = new Date().toISOString().split('T')[0];

  for (const dir of sampleDirs) {
    const dirName = path.basename(dir);
    console.log(`\n${'-'.repeat(50)}`);
    console.log(`📂 Đang xử lý: ${dirName}`);

    const contentFile = path.join(dir, 'content.md');
    if (!fs.existsSync(contentFile)) {
      console.warn(`Bỏ qua ${dirName}: Không có file content.md`);
      continue;
    }

    const bodyText = fs.readFileSync(contentFile, 'utf8');

    let senderEmail = 'dautuhanghoa@giacatloi.vn';
    const senderFile = path.join(dir, 'sender.md');
    if (fs.existsSync(senderFile)) {
      senderEmail = fs.readFileSync(senderFile, 'utf8').trim();
    }

    let subject = 'Yêu cầu mở TKGD';
    const subjectFile = path.join(dir, 'subject.md');
    if (fs.existsSync(subjectFile)) {
      subject = fs.readFileSync(subjectFile, 'utf8').trim();
    }

    // Thu thập attachments
    const files = fs.readdirSync(dir);
    const attachmentsMeta = files
      .filter((f) => /\.(pdf|jpg|jpeg|png)$/i.test(f))
      .map((f) => {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        return {
          name: f,
          size: stat.size,
          storagePath: fullPath,
          fileType: classifyAttachmentType(f),
        };
      });

    // Tạo messageId giả lập duy nhất cho mẫu test
    const messageId = `TEST_MSG_${dirName.toUpperCase().replace(/\s+/g, '_')}_${Date.now()}`;

    // A. LƯU RAW MAIL VÀO MONGODB
    console.log(`  💾 [RAW] Đang lưu raw email vào collection 'raw_account_mails'...`);
    const rawMailDoc = await RawMailModel.create({
      messageId,
      subject,
      senderEmail,
      senderName: 'CÔNG TY CỔ PHẦN GIAO DỊCH HÀNG HÓA GIA CÁT LỢI',
      receivedDateTime: new Date(),
      bodyRawText: bodyText,
      attachments: attachmentsMeta,
      status: 'PARSED',
    });
    console.log(`   [RAW] Đã lưu thành công! ID: ${rawMailDoc._id}`);

    // B. BÓC TÁCH DỮ LIỆU SẠCH (Clean Data)
    console.log(`  🔍 [CLEAN] Đang bóc tách thông tin body mail...`);
    const parsed = parseAccountOpeningEmailBody(bodyText);
    console.log(`     - Mã Futures: ${parsed.maTKGDFutures}`);
    console.log(`     - Mã ACM:     ${parsed.maTKGDACM || '(Không có)'}`);
    console.log(`     - Tên TK:     ${parsed.tenTK}`);
    console.log(`     - Mã TVKD:    ${parsed.maTVKD}`);
    console.log(`     - Yêu cầu ACM:${parsed.hasACMRequest}`);

    // C. LƯU CLEAN DATA VÀO MONGODB (Khối noiDungMail tương ứng Sheet NoiDungMail của Excel)
    console.log(`  💾 [CLEAN] Đang lưu record sạch vào collection 'clean_account_records'...`);
    const cleanRecordDoc = await CleanRecordModel.create({
      rawMailId: (rawMailDoc as any)._id,
      batchDate: todayStr,
      maTVKD: parsed.maTVKD || '003',
      noiDungMail: {
        maTKGD_Futures: parsed.maTKGDFutures || undefined,
        maTKGD_ACM: parsed.maTKGDACM || undefined,
        tenTaiKhoan: parsed.tenTK || undefined,
        hasACMRequest: parsed.hasACMRequest,
        ghiChuSoSanh: 'Đã bóc tách từ mail Outlook, sẵn sàng đối soát với M-System',
      },
      ketLuan: {
        trangThai: 'CHUA_XU_LY',
        danhSachLoi: [],
      },
    });
    console.log(`   [CLEAN] Đã lưu thành công! ID: ${(cleanRecordDoc as any)._id}`);
  }


  // 4. TRUY VẤN LẠI TỪ MONGODB ĐỂ KIỂM CHỨNG (VERIFICATION)
  console.log('\n' + '='.repeat(70));
  console.log(' KIỂM CHỨNG DỮ LIỆU THỰC TẾ TRONG MONGODB ATLAS:');
  console.log('='.repeat(70));

  const cleanRecords = await CleanRecordModel.find({ batchDate: todayStr })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  console.log(`\nTìm thấy ${cleanRecords.length} records vừa lưu trong ngày hôm nay:`);
  console.table(
    cleanRecords.map((r: any, idx: number) => ({
      STT: idx + 1,
      ID: r._id.toString().slice(-6),
      'Mã Futures': r.noiDungMail?.maTKGD_Futures || '---',
      'Mã ACM': r.noiDungMail?.maTKGD_ACM || '---',
      'Tên Tài Khoản': r.noiDungMail?.tenTaiKhoan || '---',
      'Mở ACM?': r.noiDungMail?.hasACMRequest ? 'Có' : 'Không',
      'Trạng Thái': r.ketLuan?.trangThai,
    })),
  );

  // Ngắt kết nối MongoDB
  await mongoose.disconnect();
  console.log('\n ĐÃ HOÀN TẤT KIỂM THỬ MODULE 1 THÀNH CÔNG 100%!');
}

runModule1Test().catch((err) => {
  console.error(' Lỗi khi chạy Module 1 Test:', err);
  process.exit(1);
});
