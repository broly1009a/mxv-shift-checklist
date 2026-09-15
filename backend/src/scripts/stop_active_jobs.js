const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function stopActiveJobs() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error(' Khong tim thay MONGODB_URI');
    process.exit(1);
  }

  try {
    console.log('🔄 Dang ket noi MongoDB...');
    await mongoose.connect(mongoUri);

    const botJobsCol = mongoose.connection.collection('bot_jobs');

    // Tim cac bot jobs dang o trang thai PROCESSING hoac PENDING
    const runningJobs = await botJobsCol.find({
      status: { $in: ['PROCESSING', 'PENDING', 'RUNNING', 'WAITING_FILES'] }
    }).toArray();

    console.log(`📌 So luong bot job dang chay/cho: ${runningJobs.length}`);
    runningJobs.forEach(j => {
      console.log(`   - ID: ${j._id} | Loai: ${j.jobType} | Trang thai: ${j.status} | Tao luc: ${j.createdAt}`);
    });

    if (runningJobs.length > 0) {
      const res = await botJobsCol.updateMany(
        { status: { $in: ['PROCESSING', 'PENDING', 'RUNNING', 'WAITING_FILES'] } },
        {
          $set: {
            status: 'CANCELLED',
            error: 'Nguoi dung chu dong dong/huy job qua script Git Bash',
            completedAt: new Date()
          }
        }
      );
      console.log(`✅ Da cap nhat CANCELLED cho ${res.modifiedCount} bot job!`);
    } else {
      console.log('ℹ️ Khong co bot job nao dang chay ngam can huy.');
    }

  } catch (err) {
    console.error(' Loi:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Da ngat ket noi DB.');
  }
}

stopActiveJobs();
