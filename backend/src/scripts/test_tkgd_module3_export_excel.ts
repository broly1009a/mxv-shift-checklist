import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';
import { CleanAccountRecordSchema } from '../schemas/clean-account-record.schema';
import { reconcileAndExportToExcel } from '../modules/bot-engine/helpers/tkgd-reconcile-exporter.helper';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  console.log('='.repeat(70));
  console.log(' KIỂM THỬ MODULE 3: ĐỐI SOÁT CHÉO & XUẤT FILE EXCEL TEMPLATE');
  console.log('='.repeat(70));

  // 1. Kết nối MongoDB
  console.log('\n[1] Đang kết nối tới MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI);
  console.log(' Kết nối MongoDB thành công!');

  const CleanRecordModel = mongoose.model(
    'CleanAccountRecord',
    CleanAccountRecordSchema,
  );

  // 2. Lấy dữ liệu từ clean_account_records
  console.log('\n[2] Đang nạp danh sách CleanAccountRecords từ MongoDB...');
  let records = await CleanRecordModel.find().sort({ createdAt: -1 }).limit(10);

  if (records.length === 0) {
    console.log(' Chưa có bản ghi nào trong DB, tạo 2 bản ghi mẫu để test xuất Excel...');
    const sampleRecord1 = await CleanRecordModel.create({
      noiDungMail: {
        maTKGD_Futures: '003C2333888',
        maTKGD_ACM: '003C2333888-A',
        tenTaiKhoan: 'Ngô Đức Hải',
        coDangKyACM: true,
        coFileHopDong: true,
        coFilePhuLuc01: true,
        coFileCCCD: true,
      },
      ms: {
        maTKGD: '003C2333888',
        tenTKGD: 'Ngô Đức Hải',
        hoVaTen: 'Ngô Đức Hải',
        soCMND_HoChieu: '031079015563',
        ngaySinh: new Date(1979, 9, 13),
        ngayCap: new Date(2022, 7, 27),
        noiCap: 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
        ngayThamGia: new Date(2026, 7, 11),
        loaiHinhTaiKhoan: 'Cá nhân',
        diaChi: '186 Miếu Hai Xã, Dư Hàng Kênh, Lê Chân, Hải Phòng',
        trangThai: 'Hoạt động',
        chuKy: 'Đã ký',
        isFoundOnMS: true,
      },
      canCuoc: {
        soCanCuoc: '031079015563',
        hoVaTen: 'Ngô Đức Hải',
        ngaySinh: new Date(1979, 9, 13),
        coGiaTriDen: new Date(2039, 9, 13),
        ngayCap: new Date(2022, 7, 27),
        noiCap: 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
      },
    });

    const sampleRecord2 = await CleanRecordModel.create({
      noiDungMail: {
        maTKGD_Futures: '003C0656625',
        tenTaiKhoan: 'NGUYỄN ANH KHOA',
        coDangKyACM: false,
        coFileHopDong: true,
        coFilePhuLuc01: false,
        coFileCCCD: true,
      },
      ms: {
        maTKGD: '003C0656625',
        tenTKGD: 'NGUYỄN ANH KHOA',
        hoVaTen: 'NGUYỄN ANH KHOA',
        soCMND_HoChieu: '079090001234',
        ngaySinh: new Date(1990, 4, 15),
        ngayCap: new Date(2021, 2, 20),
        noiCap: 'Cục Cảnh sát QLHC về TTXH',
        ngayThamGia: new Date(2026, 7, 12),
        loaiHinhTaiKhoan: 'Cá nhân',
        diaChi: 'Quận 1, TP. Hồ Chí Minh',
        trangThai: 'Hoạt động',
        chuKy: 'Đã ký',
        isFoundOnMS: true,
      },
    });
    records = [sampleRecord1, sampleRecord2];
  }

  console.log(`Tìm thấy ${records.length} records để đối soát và xuất Excel.`);

  // Đảm bảo các record có trường ms mô phỏng nếu chưa cào được từ MS
  for (const r of records) {
    if (!r.ms || !r.ms.isFoundOnMS) {
      r.ms = {
        maTKGD: r.noiDungMail?.maTKGD_Futures || '003C2333888',
        tenTKGD: r.noiDungMail?.tenTaiKhoan || 'Ngô Đức Hải',
        hoVaTen: r.noiDungMail?.tenTaiKhoan || 'Ngô Đức Hải',
        soCMND_HoChieu: '031079015563',
        ngaySinh: new Date(1979, 9, 13),
        ngayCap: new Date(2022, 7, 27),
        noiCap: 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
        ngayThamGia: new Date(2026, 7, 11),
        loaiHinhTaiKhoan: 'Cá nhân',
        diaChi: '186 Miếu Hai Xã, Dư Hàng Kênh, Lê Chân, Hải Phòng',
        trangThai: 'Hoạt động',
        chuKy: 'Đã ký',
        isFoundOnMS: true,
      };
    }
  }

  // 3. Thực hiện đối soát chéo và xuất file Excel
  console.log('\n[3] Thực hiện đối soát chéo và điền vào template Auto Data mail.xlsm...');
  const summary = await reconcileAndExportToExcel(records);

  // 4. In kết quả tổng quan
  console.log('='.repeat(70));
  console.log('🎉 TỔNG KẾT MODULE 3 - XUẤT FILE EXCEL:');
  console.log(`  - File kết quả:      ${summary.outputFilePath}`);
  console.log(`  - Tổng số bản ghi:   ${summary.totalRecords}`);
  console.log(`  - Số bản ghi Khớp:   ${summary.khopCount} (Được tô màu XANH)`);
  console.log(`  - Số bản ghi Lệch:   ${summary.lechCount} (Được tô màu ĐỎ/CAM)`);
  console.log('='.repeat(70));

  await mongoose.disconnect();
}

main().catch(console.error);
