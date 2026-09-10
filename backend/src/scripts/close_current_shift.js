const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function closeCurrentShift() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ Khong tim thay MONGODB_URI trong file .env');
    process.exit(1);
  }

  try {
    console.log('🔄 Dang ket noi MongoDB de kiem tra ca truc...');
    await mongoose.connect(mongoUri);

    const shiftLogsCol = mongoose.connection.collection('shift_logs');

    // Tim tat ca ca truc dang o trang thai PENDING
    const openShifts = await shiftLogsCol.find({ status: 'PENDING' }).toArray();

    if (openShifts.length === 0) {
      console.log('ℹ️ Hien tai KHONG CO ca truc nao dang mo (status: PENDING).');
      await mongoose.disconnect();
      return;
    }

    console.log(`📌 Tim thay ${openShifts.length} ca truc dang mo:`);
    openShifts.forEach((s) => {
      console.log(`   - ID: ${s._id} | Ngay: ${s.shiftDate} | Tien do: ${s.progressPercentage || 0}%`);
    });

    const now = new Date();
    const updateResult = await shiftLogsCol.updateMany(
      { status: 'PENDING' },
      {
        $set: {
          status: 'COMPLETED',
          closedAt: now,
          handoverNote: 'Dong ca truc qua script Git Bash local',
        },
      }
    );

    console.log(`✅ DA DONG THANH CONG ${updateResult.modifiedCount} ca truc (status -> COMPLETED) luc ${now.toLocaleString('vi-VN')}!`);
  } catch (err) {
    console.error('❌ Loi khi dong ca truc:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Da ngat ket noi database.');
  }
}

closeCurrentShift();
