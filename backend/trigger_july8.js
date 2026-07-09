const mongoose = require('mongoose');

const MONGODB_URI = "mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const JobSchema = new mongoose.Schema({
    jobType: String,
    status: String,
    attempts: Number,
    maxAttempts: Number,
    payload: Map,
    logs: [String],
    createdAt: Date,
    updatedAt: Date
  }, { collection: 'bot_jobs' });

  const BotJob = mongoose.model('BotJob', JobSchema);

  // Get current active config
  const SettingsSchema = new mongoose.Schema({
    key: String,
    value: String
  }, { collection: 'settings' });
  const Setting = mongoose.model('Setting', SettingsSchema);

  const macroPathSetting = await Setting.findOne({ key: 'bot_macro_lot_path' });
  const backupMsSetting = await Setting.findOne({ key: 'bot_backup_path_ms' });
  const backupCqgSetting = await Setting.findOne({ key: 'bot_backup_path_cqg' });
  const pythonPathSetting = await Setting.findOne({ key: 'bot_python_path' });

  const defaultMacroPath = "C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke so lot giao dich có ACM\\Macro thong ke so lot giao dich có ACM.xlsm";

  const payload = {
    targetDate: '2026-07-08',
    macroPath: macroPathSetting ? macroPathSetting.value : defaultMacroPath,
    backupPathMs: backupMsSetting ? backupMsSetting.value : 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    backupPathCqg: backupCqgSetting ? backupCqgSetting.value : 'C:\\Users\\hiepth\\Downloads\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
    pythonExe: pythonPathSetting ? pythonPathSetting.value : 'python'
  };

  const job = new BotJob({
    jobType: 'RUN_LOT_MACRO',
    status: 'PENDING',
    attempts: 0,
    maxAttempts: 1,
    payload: new Map(Object.entries(payload)),
    logs: [`[${new Date().toISOString()}] Job enqueued manually for 2026-07-08 (fixed path)`],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await job.save();
  console.log(`Successfully enqueued job with ID: ${job._id}`);

  await mongoose.disconnect();
}

main().catch(console.error);
