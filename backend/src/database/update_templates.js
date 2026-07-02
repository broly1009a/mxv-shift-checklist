const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function main() {
  try {
    console.log('Connecting to database via Mongoose...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!');

    // Define schema inline to avoid importing Nest models
    const Department = mongoose.model('Department', new mongoose.Schema({}, { strict: false, collection: 'departments' }));
    const ShiftSlot = mongoose.model('ShiftSlot', new mongoose.Schema({}, { strict: false, collection: 'shift_slots' }));
    const ChecklistTemplate = mongoose.model('ChecklistTemplate', new mongoose.Schema({}, { strict: false, collection: 'checklist_templates' }));

    // 1. Get QLGD_OPS department
    const dept = await Department.findOne({ code: 'QLGD_OPS' });
    if (!dept) {
      throw new Error('Department with code QLGD_OPS not found in database!');
    }
    console.log(`Found department QLGD_OPS with ID: ${dept._id}`);

    // 2. Get shift slots
    const slotOpen = await ShiftSlot.findOne({ code: 'SHIFT_3' });
    const slotDuring = await ShiftSlot.findOne({ code: 'SHIFT_1' });
    const slotClose = await ShiftSlot.findOne({ code: 'SHIFT_2' });

    if (!slotOpen || !slotDuring || !slotClose) {
      throw new Error('Required shift slots (SHIFT_3, SHIFT_1, SHIFT_2) not found in database!');
    }

    const templates = [
      {
        title: 'Checklist Mở Cửa - Trading Operations',
        departmentId: dept._id,
        sessionType: 'OPEN',
        shiftSlotId: slotOpen._id,
        isActive: true,
        tasks: [
          {
            taskId: 'ops_open_01',
            taskName: 'Kiểm tra Job Snapshot (Email: anhdao@mxv.vn)',
            priority: 'HIGH',
            sortOrder: 1,
            isBotCheck: true,
            botTriggerTime: '05:00',
            botCheckType: 'EMAIL_PARSE',
            botCheckTarget: '{"subject": "Job Snapshot", "sender": "anhdao@mxv.vn"}',
            botSuccessCondition: 'thành công',
            botFailureAction: 'ALERT_TELEGRAM',
            slaDeadline: '05:15',
            actionDescription: 'Kiểm tra email kết quả "Job Snapshot". Nếu không thành công, phối hợp với Newgen xử lý kết chuyển dữ liệu.',
          },
          {
            taskId: 'ops_open_02',
            taskName: 'Kiểm tra EOD OMS & lệnh MM OMS (CQG / CCP Screen)',
            priority: 'HIGH',
            sortOrder: 2,
            isBotCheck: true,
            botTriggerTime: '05:00',
            botCheckType: 'API_STATUS',
            botCheckTarget: 'http://cqg.mxv.vn/api/oms/status',
            botSuccessCondition: '{"status": "EOD_COMPLETED"}',
            botFailureAction: 'ALERT_TELEGRAM',
            slaDeadline: '05:15',
            actionDescription: 'Kiểm tra kết quả EOD của CCP / CE. Kiểm tra lệnh MM đã lên CCP / CE hay chưa.',
          },
          {
            taskId: 'ops_open_03',
            taskName: 'Đối chiếu & Chạy EOD M-System (MS, CQG, ACM, Email)',
            priority: 'HIGH',
            sortOrder: 3,
            isBotCheck: true,
            botTriggerTime: '06:00',
            botCheckType: 'EMAIL_PARSE',
            botCheckTarget: '{"subject": "EOD M-System SUCCESS", "sender": "m-system@mxv.vn"}',
            botSuccessCondition: 'SUCCESS',
            botFailureAction: 'ALERT_TELEGRAM',
            slaDeadline: '07:00',
            actionDescription: 'Kiểm tra đối chiếu dữ liệu phiên T-1 giữa M-System, CQG và ACM; kiểm tra giá thanh toán; thực hiện chạy EOD thủ công.\n⚠️ [KỊCH BẢN PHÁT SINH]: Nếu quá trình xử lý lỗi kết chuyển/đối chiếu kéo dài quá 07h30, thông báo lùi thời gian EOD và gửi Sao kê cho TVKD.',
          },
          {
            taskId: 'ops_open_04',
            taskName: 'Xử lý sau EOD (M-System, Ổ shared QLGD, Email)',
            priority: 'HIGH',
            sortOrder: 4,
            dependsOnTaskIds: ['ops_open_03'],
            actionDescription: 'Backup file kết quả EOD; kiểm tra EOD và thông báo các tài khoản bị âm ký quỹ đầu ngày. Nếu lỗi, phối hợp Newgen chỉnh sửa và chạy lại.\n⚠️ [KỊCH BẢN PHÁT SINH]: Trong vòng 05 phút sau khi EOD thành công, gửi email thông báo kết quả sau khi chạy lại EOD thành công.',
          },
          {
            taskId: 'ops_open_05',
            taskName: 'Thực hiện Start of Day (SOD) (M-System)',
            priority: 'HIGH',
            sortOrder: 5,
            dependsOnTaskIds: ['ops_open_03'],
            actionDescription: 'Cập nhật Start of Day (SOD) cho hệ thống M-System. Nếu lỗi, phối hợp Newgen chỉnh sửa và chạy lại.',
          },
          {
            taskId: 'ops_open_06',
            taskName: 'Đồng bộ CQG (Sync CQG) (CQG Cast, M-System)',
            priority: 'MEDIUM',
            sortOrder: 6,
            dependsOnTaskIds: ['ops_open_05'],
            actionDescription: 'Kiểm tra việc reset dữ liệu trên CQG; sau khi reset xong, thực hiện đồng bộ số dư (Sync CQG) thủ công lên CQG Cast.',
          },
          {
            taskId: 'ops_open_06_1',
            taskName: 'Check sai ký quỹ, check sai lãi lỗ dự kiến (Sử dụng tool và 3 file)',
            priority: 'MEDIUM',
            sortOrder: 7,
            actionDescription: 'Sử dụng công cụ kiểm tra ký quỹ và lãi lỗ dự kiến, import 3 file dữ liệu đối chiếu.',
          },
          {
            taskId: 'ops_open_07',
            taskName: 'Gửi email Sao kê TKGD thủ công (M-System, Email)',
            priority: 'HIGH',
            sortOrder: 8,
            dependsOnTaskIds: ['ops_open_05'],
            actionDescription: 'Gửi email Sao kê TKGD thủ công.\n⚠️ [KỊCH BẢN PHÁT SINH]: Trong vòng 30 phút sau khi kết quả EOD được xác nhận chính xác, thực hiện thao tác gửi email Sao kê TKGD thủ công cho Khách hàng.',
          },
        ]
      },
      {
        title: 'Checklist Trong Phiên - Trading Operations',
        departmentId: dept._id,
        sessionType: 'DURING',
        shiftSlotId: slotDuring._id,
        isActive: true,
        tasks: [
          {
            taskId: 'ops_during_01',
            taskName: 'Thay đổi ký quỹ hàng hóa (M-System, CQG Cast)',
            priority: 'HIGH',
            sortOrder: 1,
            actionDescription: 'Nếu có Quyết định thay đổi ký quỹ có hiệu lực từ phiên T, người trực ca 1 thực hiện tạo bản ghi thay đổi, người trực ca 2 duyệt bản ghi (thực hiện khi có Trưởng bộ phận).',
          },
          {
            taskId: 'ops_during_02',
            taskName: 'Giám sát & Đối chiếu MS vs CQG (M-System, CQG Cast, Email)',
            priority: 'HIGH',
            sortOrder: 2,
            actionDescription: 'Kiểm tra tính cân bằng dữ liệu giữa M-System và CQG. Xử lý các lỗi lệch do thiết lập tham số hoặc mất kết nối API.\n⚠️ [KỊCH BẢN PHÁT SINH]:\n• Trong vòng 30 phút kể từ khi đối chiếu phát hiện không cân bằng: Xác định nguyên nhân và tài khoản bị lệch giao dịch.\n• Sau khi tìm ra nguyên nhân lệch giao dịch: Thông báo cho TVKD (qua room Hỗ trợ nghiệp vụ giao dịch) thực hiện thiết bổ sung các tham số còn thiếu của TKGD và báo cho Newgen kéo lệnh còn thiếu về MS.',
          },
          {
            taskId: 'ops_during_03',
            taskName: 'Mở mới hợp đồng giao dịch (M-System, CQG Cast)',
            priority: 'MEDIUM',
            sortOrder: 3,
            actionDescription: 'Thực hiện mở mới hợp đồng Futures, Spreads, ACM. Lưu ý: Mở tối đa 1 năm tính từ hiện tại.',
          },
          {
            taskId: 'ops_during_04',
            taskName: 'Hỗ trợ & Xử lý sự cố (M-System, CQG, ACM, Teams/Zalo)',
            priority: 'HIGH',
            sortOrder: 4,
            actionDescription: 'Tiếp nhận thắc mắc của TVKD; thông báo lỗi hệ thống; sửa lỗi giao dịch; gán hàng hóa (mặt hàng có điều kiện/API); đình chỉ TVKD.\n⚠️ [KỊCH BẢN PHÁT SINH]:\n• Trong vòng 05 phút kể từ khi phát hiện lỗi: Thông báo lỗi/sự cố hệ thống (mất kết nối, lỗi phần mềm M-System, CQG, ACM...) cho Newgen và Khối CNTT.\n• Trong vòng 10 phút kể từ khi phát hiện lỗi: Gửi email thông báo sự cố cho các ĐVNV và Thành viên Kinh doanh (TVKD).\n• Ngay sau khi hoàn tất kiểm tra hệ thống: Thông báo lỗi/sự cố đã được khắc phục sau khi kiểm tra dữ liệu chính xác giữa các nền tảng.\n• Trong phiên, sau khi hoàn thành xử lý lỗi / sự cố: Cập nhật vào Báo cáo ghi nhận lỗi giao dịch (Mẫu số: 01/QT/TVH).\n• Trong vòng 15 phút kể từ khi tiếp nhận thông tin qua Teams/Email: Tiếp nhận và tìm hiểu nguyên nhân khiếu nại/thắc mắc của TVKD.',
          },
          {
            taskId: 'ops_during_05',
            taskName: 'Giám sát tất toán hợp đồng (M-System, Email)',
            priority: 'HIGH',
            sortOrder: 5,
            actionDescription: 'Gửi thông báo thời hạn tất toán hợp đồng; thực hiện hủy lệnh chờ và đóng vị thế bắt buộc nếu TVKD không tự thực hiện đúng hạn.',
          },
          {
            taskId: 'ops_during_06',
            taskName: 'Báo cáo Ban giám sát (M-System, CQG, ACM, Whatsapp)',
            priority: 'HIGH',
            sortOrder: 6,
            actionDescription: 'Thống kê các dữ liệu giao dịch trong phiên: DSGD, TTM… gửi Ban giám sát qua Whatsapp.',
          },
        ]
      },
      {
        title: 'Checklist Đóng Cửa - Trading Operations',
        departmentId: dept._id,
        sessionType: 'CLOSE',
        shiftSlotId: slotClose._id,
        isActive: true,
        tasks: [
          {
            taskId: 'ops_close_01',
            taskName: 'Backup dữ liệu cuối phiên (M-System, CQG Cast, ACM, CE/CCP, Ổ shared)',
            priority: 'CRITICAL',
            sortOrder: 1,
            actionDescription: 'Sao lưu toàn bộ dữ liệu giao dịch, lệnh, trạng thái, ký quỹ, nộp rút tiền... trên M-System, CQG, ACM, CE / CCP. Lưu ý: CE và ACM ưu tiên backup trước. Tổng hợp dữ liệu thành các báo cáo theo mẫu.',
          },
        ]
      }
    ];

    for (const tpl of templates) {
      console.log(`Upserting template: "${tpl.title}"...`);
      const result = await ChecklistTemplate.updateOne(
        { departmentId: tpl.departmentId, sessionType: tpl.sessionType },
        { $set: tpl },
        { upsert: true }
      );
      console.log(`Result: matchedCount=${result.matchedCount}, modifiedCount=${result.modifiedCount}, upsertedId=${result.upsertedId || 'none'}`);
    }

    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
