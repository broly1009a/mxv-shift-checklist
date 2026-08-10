const { MongoClient, ObjectId } = require('mongodb');

async function run() {
  const client = new MongoClient('mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority');
  try {
    await client.connect();
    const db = client.db();

    // Admin user IDs
    const admins = [
      { id: new ObjectId('6a2fa0193cd9b0de35d6d498'), name: 'System Administrator (admin)' },
      { id: new ObjectId('6a2fa9a9675c47ef82b18ae9'), name: 'Trương Hoàng Hiệp (hieptruong)' }
    ];

    console.log('--- SCANNING AUDIT_LOGS FOR DUPLICATES BY ADMIN ---');

    for (const admin of admins) {
      console.log(`\nAnalyzing audit logs for admin: ${admin.name} (${admin.id.toString()})...`);
      
      // Aggregate audit logs for this user to find duplicates
      // Duplicate definition: same shiftLogId, taskId, action, details, and within 5 seconds difference in createdAt
      const logs = await db.collection('audit_logs')
        .find({ userId: admin.id })
        .sort({ createdAt: 1 })
        .toArray();

      console.log(`Total logs found for this admin: ${logs.length}`);

      let duplicates = [];
      for (let i = 0; i < logs.length - 1; i++) {
        const current = logs[i];
        const next = logs[i + 1];

        // Check if same shiftLogId, taskId, action, details
        const isSameMeta = 
          current.shiftLogId.toString() === next.shiftLogId.toString() &&
          current.taskId === next.taskId &&
          current.action === next.action &&
          current.details === next.details;

        if (isSameMeta) {
          const timeDiffMs = Math.abs(new Date(current.createdAt) - new Date(next.createdAt));
          if (timeDiffMs <= 5000) { // 5 seconds threshold
            duplicates.push({
              action: current.action,
              taskId: current.taskId,
              taskName: current.taskName,
              details: current.details,
              log1: { id: current._id, createdAt: current.createdAt },
              log2: { id: next._id, createdAt: next.createdAt },
              timeDiffSeconds: timeDiffMs / 1000
            });
            // Skip the next one to avoid counting a triplet twice
            i++;
          }
        }
      }

      console.log(`Duplicates count: ${duplicates.length}`);
      if (duplicates.length > 0) {
        console.log('Sample duplicates:');
        console.log(JSON.stringify(duplicates.slice(0, 5), null, 2));
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
