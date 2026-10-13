const { MongoClient, ObjectId } = require('mongodb');

async function run() {
  const client = new MongoClient('mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority');
  try {
    await client.connect();
    const db = client.db();

    const adminId = new ObjectId('6a2fa9a9675c47ef82b18ae9'); // Trương Hoàng Hiệp

    console.log('--- SCANNING SYSTEM_LOGS BY ADMIN ---');
    const systemLogs = await db.collection('system_logs')
      .find({ actorUserId: adminId })
      .sort({ createdAt: 1 })
      .toArray();

    console.log(`Total system logs for admin: ${systemLogs.length}`);
    
    let duplicates = [];
    for (let i = 0; i < systemLogs.length - 1; i++) {
      const current = systemLogs[i];
      const next = systemLogs[i + 1];

      const isSameMeta = 
        current.eventType === next.eventType &&
        current.status === next.status &&
        current.message === next.message;

      if (isSameMeta) {
        const timeDiffMs = Math.abs(new Date(current.createdAt) - new Date(next.createdAt));
        if (timeDiffMs <= 5000) {
          duplicates.push({
            eventType: current.eventType,
            message: current.message,
            log1: { id: current._id, createdAt: current.createdAt },
            log2: { id: next._id, createdAt: next.createdAt },
            timeDiffSeconds: timeDiffMs / 1000
          });
          i++;
        }
      }
    }
    console.log(`Duplicate system logs found: ${duplicates.length}`);
    if (duplicates.length > 0) {
      console.log('Sample duplicate system logs:');
      console.log(JSON.stringify(duplicates.slice(0, 5), null, 2));
    }

    console.log('\n--- SCANNING ACTIVITY_LOGS BY ADMIN ---');
    const activityLogs = await db.collection('activity_logs')
      .find({ userId: adminId })
      .sort({ createdAt: 1 })
      .toArray();

    console.log(`Total activity logs for admin: ${activityLogs.length}`);
    
    let actDuplicates = [];
    for (let i = 0; i < activityLogs.length - 1; i++) {
      const current = activityLogs[i];
      const next = activityLogs[i + 1];

      const isSameMeta = 
        current.action === next.action &&
        current.details === next.details;

      if (isSameMeta) {
        const timeDiffMs = Math.abs(new Date(current.createdAt) - new Date(next.createdAt));
        if (timeDiffMs <= 5000) {
          actDuplicates.push({
            action: current.action,
            details: current.details,
            log1: { id: current._id, createdAt: current.createdAt },
            log2: { id: next._id, createdAt: next.createdAt },
            timeDiffSeconds: timeDiffMs / 1000
          });
          i++;
        }
      }
    }
    console.log(`Duplicate activity logs found: ${actDuplicates.length}`);
    if (actDuplicates.length > 0) {
      console.log('Sample duplicate activity logs:');
      console.log(JSON.stringify(actDuplicates.slice(0, 5), null, 2));
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
