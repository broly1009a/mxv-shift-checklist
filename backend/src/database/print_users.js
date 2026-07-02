const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false, collection: 'users' }));
    const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false, collection: 'departments' }));
    const Division = mongoose.model('Division', new mongoose.Schema({}, { strict: false, collection: 'divisions' }));

    const users = await User.find({});
    console.log(`\nFound ${users.length} users in database:`);
    for (const u of users) {
      let deptName = 'None';
      let divName = 'None';
      if (u.departmentId) {
        const dept = await Department.findById(u.departmentId);
        if (dept) deptName = `${dept.name} (${dept.code})`;
      }
      if (u.divisionId) {
        const div = await Division.findById(u.divisionId);
        if (div) divName = `${div.name} (${div.code})`;
      }
      console.log(`- Username: ${u.username}`);
      console.log(`  Full Name: ${u.fullName}`);
      console.log(`  Role: ${u.role}`);
      console.log(`  Division: ${divName}`);
      console.log(`  Department: ${deptName}`);
      console.log(`-------------------------------------`);
    }
  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
