const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    const ShiftLog = mongoose.model('ShiftLog', new mongoose.Schema({}, { strict: false, collection: 'shiftlogs' }));
    const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false, collection: 'departments' }));

    const activeShifts = await ShiftLog.find({ status: 'PENDING' });
    console.log(`\nFound ${activeShifts.length} active (PENDING) shift logs in database:`);
    for (const s of activeShifts) {
      console.log(`- Shift ID: ${s._id}`);
      console.log(`  Date: ${s.shiftDate}`);
      
      let deptName = 'None';
      if (s.templateId) {
        // Since templateId might be populated or just an ID, let's print it
        console.log(`  Template ID: ${s.templateId}`);
      }
      
      console.log(`  Progress: ${s.progressPercentage}%`);
      console.log(`  Number of Tasks: ${s.details ? s.details.length : 0}`);
      if (s.details && s.details.length > 0) {
        console.log(`  Tasks list:`);
        s.details.forEach(t => {
          console.log(`    * [${t.taskId}] ${t.taskNameSnapshot} (${t.status})`);
        });
      }
      console.log(`-------------------------------------`);
    }

    const allShifts = await ShiftLog.find({});
    console.log(`\nTotal shift logs in database: ${allShifts.length}`);
    for (const s of allShifts) {
      if (s.status !== 'PENDING') {
        console.log(`- Shift ID: ${s._id} | Date: ${s.shiftDate} | Status: ${s.status} | Progress: ${s.progressPercentage}%`);
      }
    }

  } catch (error) {
    console.error('Error fetching shifts:', error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
