const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    const ChecklistTemplate = mongoose.model('ChecklistTemplate', new mongoose.Schema({}, { strict: false, collection: 'checklist_templates' }));
    const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false, collection: 'departments' }));

    const dept = await Department.findOne({ code: 'QLGD_OPS' });
    if (!dept) {
      console.log('Department QLGD_OPS not found.');
      return;
    }

    const templates = await ChecklistTemplate.find({ departmentId: dept._id });
    console.log(`\nFound ${templates.length} templates for QLGD_OPS department.`);
    for (const t of templates) {
      console.log(`\n=========================================`);
      console.log(`Template: "${t.title}" (${t.sessionType})`);
      console.log(`=========================================`);
      t.tasks.forEach(task => {
        console.log(`- [${task.taskId}] ${task.taskName}`);
        if (task.actionDescription) {
          console.log(`  Description: ${task.actionDescription.replace(/\n/g, '\n               ')}`);
        }
        if (task.dependsOnTaskIds && task.dependsOnTaskIds.length > 0) {
          console.log(`  Depends on: ${task.dependsOnTaskIds.join(', ')}`);
        }
      });
    }
  } catch (error) {
    console.error('Error checking DB status:', error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
