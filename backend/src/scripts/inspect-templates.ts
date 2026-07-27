/**
 * Script tạm thời để kiểm tra cấu trúc template hiện có trong DB
 * Chạy: npx ts-node -r tsconfig-paths/register src/scripts/inspect-templates.ts
 */
import * as mongoose from 'mongoose';

const MONGO_URI =
  'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected!\n');

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection failed');
  }

  // 1. Departments
  const depts = await db.collection('departments').find({}).toArray();
  console.log('=== DEPARTMENTS ===');
  depts.forEach((d) => console.log(`  _id: ${d._id}  name: ${d.name}`));

  // 2. Templates
  const templates = await db
    .collection('checklist_templates')
    .find({})
    .toArray();
  console.log(`\n=== CHECKLIST TEMPLATES (${templates.length} docs) ===`);
  templates.forEach((t) => {
    console.log(`\n--- Template: "${t.title}" ---`);
    console.log(`  _id: ${t._id}`);
    console.log(`  sessionType: ${t.sessionType}`);
    console.log(`  departmentId: ${t.departmentId}`);
    console.log(`  isActive: ${t.isActive}`);
    console.log(`  tasks count: ${(t.tasks || []).length}`);
    (t.tasks || []).forEach((task: any) => {
      const hasParent = task.parentTaskId
        ? ` [child of ${task.parentTaskId}]`
        : '';
      const isBot = task.isBotCheck ? ' [BOT]' : '';
      const botType = task.botCheckType ? ` (${task.botCheckType})` : '';
      console.log(
        `    - [${task.taskId}] ${task.taskName}${hasParent}${isBot}${botType}`,
      );
    });
  });

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
