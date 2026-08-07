const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';

async function main() {
  console.log(`Connecting to MongoDB at: ${URI.split('@').pop()}`);
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  console.log('Successfully connected to DB.');

  // 1. Seed or find the default Notification Channels
  const channelsCol = db.collection('notification_channels');
  
  // Email Channel
  let emailChannel = await channelsCol.findOne({ code: 'EMAIL_ALERT_ON_FAIL' });
  if (!emailChannel) {
    const res = await channelsCol.insertOne({
      code: 'EMAIL_ALERT_ON_FAIL',
      name: 'Cảnh báo qua Email',
      type: 'EMAIL',
      config: {
        host: 'smtp.office365.com',
        port: 587,
        user: 'it.support@mxv.vn',
        pass: 'OFmng239',
        senderEmail: 'it.support@mxv.vn',
        senderName: 'MXV IT Support'
      },
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    emailChannel = { _id: res.insertedId };
    console.log('Created default Email notification channel.');
  } else {
    console.log('Email notification channel already exists.');
  }

  // Telegram Channel
  let telegramChannel = await channelsCol.findOne({ code: 'TL_QLGD' });
  if (!telegramChannel) {
    const res = await channelsCol.insertOne({
      code: 'TL_QLGD',
      name: 'Cảnh báo qua Telegram',
      type: 'TELEGRAM',
      config: {
        chatId: process.env.TELEGRAM_CHAT_ID || '1943617789',
        botToken: process.env.TELEGRAM_BOT_TOKEN || '8735678688:AAFrjG6iEe6IZJBetEV_pxbUBGge0bVjaBE'
      },
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date()
    });
    telegramChannel = { _id: res.insertedId };
    console.log('Created default Telegram notification channel.');
  } else {
    console.log('Telegram notification channel already exists.');
  }

  // 2. Seed Default Notification Rules for Bot alerts
  const rulesCol = db.collection('notification_rules');

  const defaultRules = [
    {
      code: 'MARGIN_ON_ORDER',
      name: 'Cảnh báo ký quỹ trên giá trị lệnh (On-Order)',
      eventType: 'MARGIN_ON_ORDER',
      block: 'QLGD',
      recipient: 'it.support@mxv.vn, hieptruong@mxv.vn',
      telegramChatId: '',
      isSendWarning: true,
      channelIds: [emailChannel._id]
    },
    {
      code: 'MARGIN_CHANGE',
      name: 'Cảnh báo thay đổi mức ký quỹ (Exchanges)',
      eventType: 'MARGIN_CHANGE',
      block: 'QLGD',
      recipient: 'it.support@mxv.vn, hieptruong@mxv.vn',
      telegramChatId: '',
      isSendWarning: true,
      channelIds: [emailChannel._id]
    },
    {
      code: 'SOD_CHECK',
      name: 'Đối chiếu số dư đầu ngày (SOD)',
      eventType: 'SOD_CHECK',
      block: 'QLGD',
      recipient: 'it.support@mxv.vn, hieptruong@mxv.vn',
      telegramChatId: '',
      isSendWarning: true,
      channelIds: [emailChannel._id]
    },
    {
      code: 'PRE_EOD_CHECK',
      name: 'Đối chiếu trước EOD (Pre-EOD Check)',
      eventType: 'PRE_EOD_CHECK',
      block: 'QLGD',
      recipient: 'it.support@mxv.vn, hieptruong@mxv.vn',
      telegramChatId: '',
      isSendWarning: true,
      channelIds: [emailChannel._id]
    },
    {
      code: 'EOD_CHECK',
      name: 'Đối chiếu sau EOD (EOD Check)',
      eventType: 'EOD_CHECK',
      block: 'QLGD',
      recipient: 'it.support@mxv.vn, hieptruong@mxv.vn',
      telegramChatId: '',
      isSendWarning: true,
      channelIds: [emailChannel._id]
    },
    {
      code: 'NEGATIVE_MARGIN',
      name: 'Báo cáo Âm ký quỹ đầu ngày (Negative Margin Report)',
      eventType: 'NEGATIVE_MARGIN',
      block: 'QLGD',
      recipient: 'it.support@mxv.vn, hieptruong@mxv.vn',
      telegramChatId: '',
      isSendWarning: true,
      channelIds: [emailChannel._id]
    },
    {
      code: 'BOT_FAILURE',
      name: 'Cảnh báo Lỗi vận hành Bot ngầm (Bot Failure Alert)',
      eventType: 'BOT_FAILURE',
      block: 'IT',
      recipient: 'it.support@mxv.vn, hieptruong@mxv.vn',
      telegramChatId: '',
      isSendWarning: true,
      channelIds: [emailChannel._id]
    },
    {
      code: 'SHIFT_HANDOVER',
      name: 'Báo cáo Bàn giao ca trực (Shift Handover Report)',
      eventType: 'SHIFT_HANDOVER',
      block: 'QLGD',
      recipient: 'it.support@mxv.vn, hieptruong@mxv.vn',
      telegramChatId: '',
      isSendWarning: true,
      channelIds: [emailChannel._id]
    },
    {
      code: 'SECURITY_AUDIT',
      name: 'Cảnh báo Thay đổi Cấu hình (Security/Config Change Audit)',
      eventType: 'SECURITY_AUDIT',
      block: 'IT',
      recipient: 'it.support@mxv.vn, hieptruong@mxv.vn',
      telegramChatId: '',
      isSendWarning: true,
      channelIds: [emailChannel._id]
    }
  ];

  for (const rule of defaultRules) {
    const existing = await rulesCol.findOne({ code: rule.code });
    if (!existing) {
      await rulesCol.insertOne({
        ...rule,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Seeded notification rule: ${rule.code}`);
    } else {
      console.log(`Notification rule ${rule.code} already exists.`);
    }
  }

  await client.close();
  console.log('Seeding notification rules complete!');
}

main().catch(console.error);
