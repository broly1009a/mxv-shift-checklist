const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to database.');

    const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false, collection: 'departments' }));
    const ShiftLog = mongoose.model('ShiftLog', new mongoose.Schema({}, { strict: false, collection: 'shift_logs' }));

    // 1. Get QLGD_OPS department ID
    const qlgdDept = await Department.findOne({ code: 'QLGD_OPS' });
    if (!qlgdDept) {
      console.error('ERROR: Department QLGD_OPS not found in database.');
      return;
    }
    const qlgdDeptIdStr = qlgdDept._id.toString();
    console.log(`Found QLGD_OPS department ID: ${qlgdDeptIdStr} (${qlgdDept.name || 'QLGD'})`);

    // 2. Get today's date string in GMT+7
    const tzOffset = 7 * 60; // GMT+7 in minutes
    const localTime = new Date(Date.now() + tzOffset * 60 * 1000);
    const todayStr = localTime.toISOString().split('T')[0]; // "YYYY-MM-DD"
    console.log(`Today's date (GMT+7): ${todayStr}`);

    // 3. Find all PENDING shift logs
    const pendingShifts = await ShiftLog.find({ status: 'PENDING' });
    console.log(`Found ${pendingShifts.length} PENDING shifts.`);

    let closedCount = 0;
    for (const shift of pendingShifts) {
      const shiftDate = shift.shiftDate;
      const deptId = shift.departmentId ? shift.departmentId.toString() : null;

      // Rule: Keep QLGD shifts of today open. Close all others.
      const isTodayQlgd = (shiftDate === todayStr && deptId === qlgdDeptIdStr);

      if (!isTodayQlgd) {
        // Close it using updateOne to bypass Mongoose change tracking issue on dynamic schemas
        await ShiftLog.updateOne(
          { _id: shift._id },
          {
            $set: {
              status: 'COMPLETED',
              closedAt: new Date(),
              closedBy: null,
              handoverNote: 'Đóng ca trực cũ tự động qua CLI script'
            }
          }
        );
        console.log(`[CLOSED SUCCESS] Shift ID: ${shift._id} | Date: ${shiftDate} | Dept ID: ${deptId}`);
        closedCount++;
      } else {
        console.log(`[KEPT OPEN] Shift ID: ${shift._id} | Date: ${shiftDate} | Dept ID: ${deptId} (Today's QLGD)`);
      }
    }

    console.log(`\nDone! Closed ${closedCount} old/non-QLGD shifts.`);
  } catch (error) {
    console.error('Error running script:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

main();
