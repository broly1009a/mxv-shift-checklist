const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
require('dotenv').config();

const URI = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

const personnelList = [
  {
    username: 'quyetvx',
    fullName: 'Vũ Xuân Quyết',
    title: 'Trưởng Bộ phận',
    role: 'DEPARTMENT_HEAD',
    phoneNumber: '0903479316',
    dateOfBirth: '02/10/1990',
    status: 'Đang công tác',
  },
  {
    username: 'anhdao',
    fullName: 'Đào Quốc Anh',
    title: 'Nhân viên',
    role: 'STAFF',
    phoneNumber: '0981234196',
    dateOfBirth: '23/01/1996',
    status: 'Đang công tác',
  },
  {
    username: 'hoangvm',
    fullName: 'Văn Minh Hoàng',
    title: 'Nhân viên',
    role: 'STAFF',
    phoneNumber: '0984907097',
    dateOfBirth: '16/12/1997',
    status: 'Đang công tác',
  },
  {
    username: 'giangdt',
    fullName: 'Đoàn Thị Giang',
    title: 'Nhân viên',
    role: 'STAFF',
    phoneNumber: '0912291097',
    dateOfBirth: '29/10/1997',
    status: 'Đang công tác',
  },
  {
    username: 'haitt',
    fullName: 'Tạ Thiên Hải',
    title: 'Nhân viên',
    role: 'STAFF',
    phoneNumber: '0903295228',
    dateOfBirth: '02/02/2002',
    status: 'Đang công tác',
  },
  {
    username: 'hoangldv',
    fullName: 'Lê Doãn Việt Hoàng',
    title: 'Nhân viên',
    role: 'STAFF',
    phoneNumber: '0981692265',
    dateOfBirth: '07/11/2001',
    status: 'Đang công tác',
  },
  {
    username: 'hapvs',
    fullName: 'Phạm Vũ Sơn Hà',
    title: 'Nhân viên',
    role: 'STAFF',
    phoneNumber: '0365392897',
    dateOfBirth: '12/02/2003',
    status: 'Đang công tác',
  },
  {
    username: 'minhldb',
    fullName: 'Lê Đăng Bình Minh',
    title: 'Nhân viên',
    role: 'STAFF',
    phoneNumber: '0352218687',
    dateOfBirth: '29/01/2004',
    status: 'Đang công tác',
  },
];

async function main() {
  const client = new MongoClient(URI);
  try {
    await client.connect();
    console.log('✅ Đã kết nối tới MongoDB.');
    const db = client.db();

    // 1. Tìm phòng ban QLGD_OPS
    const department = await db.collection('departments').findOne({ code: 'QLGD_OPS' });
    if (!department) {
      console.error(' Không tìm thấy phòng ban với mã QLGD_OPS!');
      return;
    }
    console.log(`🏢 Phòng ban: ${department.name} (_id: ${department._id})`);

    const defaultPasswordHash = await bcrypt.hash('Staff@MXV123', 10);

    for (const p of personnelList) {
      const existingUser = await db.collection('users').findOne({ username: p.username });
      const userData = {
        username: p.username,
        fullName: p.fullName,
        title: p.title,
        departmentId: department._id,
        role: p.role,
        isActive: true, // Kích hoạt ngay, bỏ qua bước duyệt
        phoneNumber: p.phoneNumber,
        dateOfBirth: p.dateOfBirth,
        status: p.status,
        settings: {
          theme: 'dark',
          autoRefreshInterval: 30,
          telegramNotifications: true,
          telegramChatId: '',
          alertThresholdMinutes: 15,
        },
        updatedAt: new Date(),
      };

      if (existingUser) {
        await db.collection('users').updateOne(
          { _id: existingUser._id },
          { $set: userData }
        );
        console.log(`🔄 Đã cập nhật tài khoản: ${p.username} (${p.fullName} - ${p.role})`);
      } else {
        userData.passwordHash = defaultPasswordHash;
        userData.createdAt = new Date();
        await db.collection('users').insertOne(userData);
        console.log(`✨ Đã tạo mới tài khoản: ${p.username} (${p.fullName} - ${p.role})`);
      }
    }

    console.log('\n🎉 Hoàn thành chèn/cập nhật 8 tài khoản cán bộ Khối Quản lý Giao dịch!');
  } catch (error) {
    console.error(' Lỗi thực thi:', error);
  } finally {
    await client.close();
  }
}

main();
