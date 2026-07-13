const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to database.');

    const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false, collection: 'departments' }));
    const ShiftLog = mongoose.model('ShiftLog', new mongoose.Schema({}, { strict: false, collection: 'shift_logs' }));

    const allShifts = await ShiftLog.find({}).lean();
    console.log(`Total shifts in database: ${allShifts.length}`);

    const pending = allShifts.filter(s => s.status === 'PENDING');
    console.log(`Pending shifts count: ${pending.length}`);
    for (const s of pending) {
      const dept = await Department.findById(s.departmentId);
      console.log(`- Shift ID: ${s._id} | Date: ${s.shiftDate} | Status: ${s.status} | Dept: ${dept ? dept.code : 'UNKNOWN'}`);
    }

    const completed = allShifts.filter(s => s.status === 'COMPLETED');
    console.log(`Completed shifts count: ${completed.length}`);
    if (completed.length > 0) {
      console.log('Sample completed shifts:');
      for (const s of completed.slice(0, 5)) {
        const dept = await Department.findById(s.departmentId);
        console.log(`- Shift ID: ${s._id} | Date: ${s.shiftDate} | Status: ${s.status} | Dept: ${dept ? dept.code : 'UNKNOWN'}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
