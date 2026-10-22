/**
 * seed_ccp_exchange_templates.js
 * 
 * Script nạp tự động (Seed Script) chuẩn hóa 100% NGUYÊN VĂN (GROUND TRUTH) từ:
 * "Checklist trực vận hành.docx"
 * (Tài liệu tham chiếu: docs/moi/QUY_TRINH_VA_CHECKLIST_TRUC_VAN_HANH_CCP_EXCHANGE.md)
 * 
 * Quy chuẩn thiết kế:
 * - Tên Task (taskName) và Mốc thời gian: BẢO TOÀN NGUYÊN VĂN 100% TỪNG CÂU CHỮ TRONG FILE WORD GỐC.
 * - Điểm kiểm tra / xác nhận: Đưa vào actionDescription.
 * - Ghi chú xử lý trong Word: Đưa vào exceptionCode / actionDescription.
 * - Tích hợp hệ thống số hóa: Tự động gắn functionUrl dẫn tới các màn hình tool vận hành tương ứng.
 * 
 * Danh mục Mẫu Checklist được nạp:
 *   1. "CCP - Checklist Vận Hành Chi Tiết" (15 task theo đúng mốc giờ 04:00, 04:15, 04:35, 05:30, Trong phiên)
 *   2. "CCP - Checklist Vận Hành Đầu Ngày & Hạ Tầng" (10 mục kiểm tra máy chủ, DB, NTP, kết nối...)
 *   3. "EXCHANGE - Checklist Vận Hành Đầu Ngày" (10 mục kiểm tra hạ tầng máy chủ, ứng dụng trọng yếu, log tập trung...)
 * 
 * Cách chạy:
 *   cd backend
 *   node src/scripts/seed_ccp_exchange_templates.js
 */

let MongoClient;
try {
  MongoClient = require('mongodb').MongoClient;
} catch (e) {
  MongoClient = require('mongoose').mongo.MongoClient;
}
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function seedCcpExchangeTemplates() {
  console.log('=======================================================================');
  console.log(' BẮT ĐẦU NẠP MẪU CHECKLIST CHUẨN 100% NGUYÊN VĂN TỪ DOCX GỐC');
  console.log('   Tài liệu: "Checklist trực vận hành.docx"');
  console.log('=======================================================================');
  console.log(`📡 Kết nối MongoDB: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();

    // 1. Xác thực phòng ban (IT_CORE hoặc QLGD_OPS)
    const itDept = await db.collection('departments').findOne({ code: 'IT_CORE' });
    const opsDept = await db.collection('departments').findOne({ code: 'QLGD_OPS' });
    const defaultDept = itDept || opsDept || (await db.collection('departments').findOne({}));

    if (!defaultDept) {
      throw new Error(' Không tìm thấy phòng ban nào trong CSDL! Vui lòng kiểm tra lại bảng departments.');
    }
    console.log(`🏢 Phòng ban áp dụng: ${defaultDept.name} (Mã: ${defaultDept.code}, ID: ${defaultDept._id})`);

    // 2. Tìm ca làm việc (ShiftSlot: SHIFT_2 cho ca đêm/chốt ngày, SHIFT_3 cho ca sáng)
    const slotNight = await db.collection('shift_slots').findOne({ code: 'SHIFT_2' });
    const slotMorning = await db.collection('shift_slots').findOne({ code: 'SHIFT_3' });
    const defaultSlot = slotNight || slotMorning || (await db.collection('shift_slots').findOne({}));

    console.log(` Ca làm việc mặc định: ${defaultSlot ? defaultSlot.name : 'Không gán ca cụ thể'}`);

    // =========================================================================
    // TEMPLATE 1: CCP - CHECKLIST VẬN HÀNH CHI TIẾT (15 MỤC THEO MỐC GIỜ WORD)
    // =========================================================================
    const ccpDetailedTasks = [
      {
        taskId: 'TASK_CCP_03_CLOSE',
        taskName: 'CCP giải tỏa lệnh theo Exchange',
        priority: 'HIGH',
        sortOrder: 1,
        timetable: '04:00 (CLOSE)',
        functionUrl: '/trading-manager/session-open/klgd-phien-cu',
        urdReference: 'STT-03',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '04:15',
        actionDescription: 'Điểm kiểm tra/xác nhận: Kiểm tra danh sách lệnh tại CCP sau đồng bộ Exchange. Xác nhận các lệnh chờ đã giải tỏa thành công.'
      },
      {
        taskId: 'TASK_CCP_04_RECON_AUTO',
        taskName: 'Reconcile tự động',
        priority: 'CRITICAL',
        sortOrder: 2,
        timetable: '04:15 (Reconcile Orders)',
        functionUrl: '/trading-manager/reconciliation',
        urdReference: 'STT-04',
        isBotCheck: true,
        botCheckType: 'CHECK_DSGD_BEFORE_EOD',
        slaType: 'FIXED_TIME',
        slaDeadline: '04:30',
        actionDescription: 'Điểm kiểm tra/xác nhận: Có thông báo chạy reconcile thành công giữa CoreEX và CoreCCP.'
      },
      {
        taskId: 'TASK_CCP_05_ORDER_RECON',
        taskName: 'Đối chiếu lệnh khớp và lệnh còn hiệu lực',
        priority: 'CRITICAL',
        sortOrder: 3,
        timetable: '04:15 (Reconcile Orders)',
        functionUrl: '/trading-manager/session-open/klgd-phien-cu',
        urdReference: 'STT-05',
        isBotCheck: true,
        botCheckType: 'CHECK_DSGD_BEFORE_EOD',
        slaType: 'FIXED_TIME',
        slaDeadline: '04:35',
        actionDescription: 'Điểm kiểm tra/xác nhận: Kiểm tra màn hình tra cứu đối chiếu lệnh.'
      },
      {
        taskId: 'TASK_CCP_06_GTT',
        taskName: 'Cập nhật giá thanh toán mới',
        priority: 'CRITICAL',
        sortOrder: 4,
        timetable: '04:15 (Reconcile Orders)',
        functionUrl: '/trading-manager/session-open/gtt',
        urdReference: 'STT-06',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '04:45',
        actionDescription: 'Điểm kiểm tra/xác nhận: Kiểm tra tại cửa sổ giá thanh toán. So khớp bảng giá thanh toán CoreEX vs CoreCCP (GTT ACM.xlsx vs GTT CCP.xlsx).'
      },
      {
        taskId: 'TASK_CCP_07_COMMODITY',
        taskName: 'Cập nhật hàng hóa, hợp đồng mới theo Exchange',
        priority: 'HIGH',
        sortOrder: 5,
        timetable: '04:15 (Reconcile Orders)',
        functionUrl: '/trading-manager/session-open/sync-ce-ccp-tt',
        urdReference: 'STT-07',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '04:45',
        actionDescription: 'Điểm kiểm tra/xác nhận: Kiểm tra cửa sổ hàng hóa/hợp đồng. Xác nhận danh mục hợp đồng phiên mới đồng bộ đầy đủ.'
      },
      {
        taskId: 'TASK_CCP_08_MATCH_MORE',
        taskName: 'Trường hợp CCP khớp nhiều hơn Exchange',
        priority: 'CRITICAL',
        sortOrder: 6,
        timetable: '04:15 (Reconcile Orders)',
        functionUrl: '/trading-manager/session-open/klgd-phien-cu',
        urdReference: 'STT-08',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '04:50',
        actionDescription: 'Điểm kiểm tra/xác nhận: Xác định và ghi nhận nếu phải xử lý hủy khớp thủ công. Ghi chú/Xử lý: Phối hợp với IT, đối tác công nghệ để kiểm tra nếu cần.'
      },
      {
        taskId: 'TASK_CCP_09_MATCH_LESS',
        taskName: 'Trường hợp CCP khớp ít hơn Exchange',
        priority: 'CRITICAL',
        sortOrder: 7,
        timetable: '04:15 (Reconcile Orders)',
        functionUrl: '/trading-manager/session-open/klgd-phien-cu',
        urdReference: 'STT-09',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '04:50',
        actionDescription: 'Điểm kiểm tra/xác nhận: Xác nhận đã khớp bù tự động trong tiến trình reconcile. Ghi chú/Xử lý: Phối hợp với IT, đối tác công nghệ để kiểm tra nếu cần.'
      },
      {
        taskId: 'TASK_CCP_10_SFTP_CSV',
        taskName: 'Gửi csv về thành viên',
        priority: 'HIGH',
        sortOrder: 8,
        timetable: '04:15 (Reconcile Orders)',
        functionUrl: '/trading-manager/ccp-ce',
        urdReference: 'STT-10',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '04:55',
        actionDescription: 'Điểm kiểm tra/xác nhận: Kiểm tra các file csv trên SFTP (Danh mục 10 loại file CSV tiêu chuẩn của CoreCCP).'
      },
      {
        taskId: 'TASK_CCP_11_SOD_AUTO',
        taskName: 'SOD hệ thống tự động',
        priority: 'CRITICAL',
        sortOrder: 9,
        timetable: '04:35 (SOD)',
        functionUrl: '/trading-manager/session-open',
        urdReference: 'STT-11',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '05:00',
        actionDescription: 'Điểm kiểm tra/xác nhận: Có thông báo snapshot dữ liệu ngày T thành công.'
      },
      {
        taskId: 'TASK_CCP_14_SWITCH_T1',
        taskName: 'Chuyển phiên làm việc T+1',
        priority: 'HIGH',
        sortOrder: 10,
        timetable: '04:35 (SOD)',
        functionUrl: '',
        urdReference: 'STT-14',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '05:00',
        actionDescription: 'Điểm kiểm tra/xác nhận: Có thông báo đổi ngày phiên T+1 thành công.'
      },
      {
        taskId: 'TASK_CCP_15_BACKUP_HIST',
        taskName: 'Backup dữ liệu sang lịch sử',
        priority: 'MEDIUM',
        sortOrder: 11,
        timetable: '04:35 (SOD)',
        functionUrl: '/admin/bot-config',
        urdReference: 'STT-15',
        isBotCheck: true,
        botCheckType: 'FILE_AUDIT_ACM',
        slaType: 'FIXED_TIME',
        slaDeadline: '05:15',
        actionDescription: 'Điểm kiểm tra/xác nhận: Xác nhận job backup dữ liệu lịch sử hoàn thành.'
      },
      {
        taskId: 'TASK_CCP_16_EOD_AUTO',
        taskName: 'EOD hệ thống tự động',
        priority: 'CRITICAL',
        sortOrder: 12,
        timetable: '05:30 (EOD)',
        functionUrl: '/trading-manager/session-open/eod-result',
        urdReference: 'STT-16',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:00',
        actionDescription: 'Điểm kiểm tra/xác nhận: Tự động thanh toán lãi lỗ T-1 thành công.'
      },
      {
        taskId: 'TASK_CCP_17_CSV_CASH',
        taskName: 'Tự động sinh file csv nộp/rút tiền',
        priority: 'HIGH',
        sortOrder: 13,
        timetable: '05:30 (EOD)',
        functionUrl: '',
        urdReference: 'STT-17',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:00',
        actionDescription: 'Điểm kiểm tra/xác nhận: Kiểm tra file trên SFTP.'
      },
      {
        taskId: 'TASK_CCP_18_GENERAL_OPS',
        taskName: 'Các tác vụ, thiết lập tại CCP hoạt động bình thường',
        priority: 'MEDIUM',
        sortOrder: 14,
        timetable: 'Trong phiên 05:00–04:00',
        functionUrl: '/dashboard',
        urdReference: 'STT-18',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '04:00',
        actionDescription: 'Điểm kiểm tra/xác nhận: Thực hiện giao dịch bình thường trên toàn bộ Core CCP.'
      },
      {
        taskId: 'TASK_CCP_20_MONITOR_MANUAL',
        taskName: 'Monitor thủ công lệnh giữa CCP và Exchange',
        priority: 'HIGH',
        sortOrder: 15,
        timetable: 'Trong phiên 05:00–04:00',
        functionUrl: '/trading-manager/reconciliation',
        urdReference: 'STT-20',
        isBotCheck: true,
        botCheckType: 'CHECK_KLGD',
        slaType: 'DYNAMIC_AFTER_TASK',
        slaDeadline: '60',
        actionDescription: 'Điểm kiểm tra/xác nhận: Kiểm tra đối chiếu thủ công tại các mốc 09:00, 11:30, 14:00, 17:30 hoặc định kỳ 02h một lần.'
      }
    ];

    // =========================================================================
    // TEMPLATE 2: CCP - CHECKLIST VẬN HÀNH ĐẦU NGÀY (10 MỤC NGUYÊN VĂN WORD)
    // =========================================================================
    const ccpOpenTasks = [
      {
        taskId: 'TASK_CCP_OPEN_01',
        taskName: 'Kiểm tra trạng thái máy chủ/hạ tầng',
        priority: 'HIGH',
        sortOrder: 1,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'CCP-OPEN-01',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra trạng thái máy chủ/hạ tầng CCP hoạt động bình thường.'
      },
      {
        taskId: 'TASK_CCP_OPEN_02',
        taskName: 'Kiểm tra tài nguyên CPU/RAM/Disk',
        priority: 'HIGH',
        sortOrder: 2,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'CCP-OPEN-02',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra tài nguyên CPU/RAM/Disk máy chủ CCP.'
      },
      {
        taskId: 'TASK_CCP_OPEN_03',
        taskName: 'Kiểm tra dịch vụ ứng dụng trọng yếu',
        priority: 'CRITICAL',
        sortOrder: 3,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'CCP-OPEN-03',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra dịch vụ ứng dụng trọng yếu của CoreCCP.'
      },
      {
        taskId: 'TASK_CCP_OPEN_04',
        taskName: 'Kiểm tra cơ sở dữ liệu/replication',
        priority: 'CRITICAL',
        sortOrder: 4,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'CCP-OPEN-04',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra cơ sở dữ liệu và cụm đồng bộ replication CCP.'
      },
      {
        taskId: 'TASK_CCP_OPEN_05',
        taskName: 'Kiểm tra monitoring và alerting',
        priority: 'HIGH',
        sortOrder: 5,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'CCP-OPEN-05',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra hệ thống monitoring và alerting cảnh báo sự cố.'
      },
      {
        taskId: 'TASK_CCP_OPEN_06',
        taskName: 'Kiểm tra log tập trung',
        priority: 'MEDIUM',
        sortOrder: 6,
        timetable: 'Đầu ngày',
        functionUrl: '/admin/system-logs',
        urdReference: 'CCP-OPEN-06',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra log tập trung của hệ thống CCP.'
      },
      {
        taskId: 'TASK_CCP_OPEN_07',
        taskName: 'Kiểm tra đồng bộ thời gian',
        priority: 'HIGH',
        sortOrder: 7,
        timetable: 'Đầu ngày',
        functionUrl: '',
        urdReference: 'CCP-OPEN-07',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra đồng bộ thời gian NTP hệ thống CCP.'
      },
      {
        taskId: 'TASK_CCP_OPEN_08',
        taskName: 'Kiểm tra kết nối với đối tác/hệ thống ngoài',
        priority: 'CRITICAL',
        sortOrder: 8,
        timetable: 'Đầu ngày',
        functionUrl: '/trading-manager/session-open',
        urdReference: 'CCP-OPEN-08',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra kết nối với đối tác và hệ thống bên ngoài.'
      },
      {
        taskId: 'TASK_CCP_OPEN_09',
        taskName: 'Kiểm tra batch/job đầu ngày',
        priority: 'HIGH',
        sortOrder: 9,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'CCP-OPEN-09',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra kết quả chạy các batch/job đầu ngày của CoreCCP.'
      },
      {
        taskId: 'TASK_CCP_OPEN_10',
        taskName: 'Kiểm tra tồn đọng sự cố/cảnh báo từ ca trước',
        priority: 'HIGH',
        sortOrder: 10,
        timetable: 'Đầu ngày',
        functionUrl: '/checklist',
        urdReference: 'CCP-OPEN-10',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra các sự cố tồn đọng và cảnh báo bàn giao từ ca trước.'
      }
    ];

    // =========================================================================
    // TEMPLATE 3: EXCHANGE - CHECKLIST VẬN HÀNH ĐẦU NGÀY (10 MỤC NGUYÊN VĂN WORD)
    // =========================================================================
    const exchangeOpenTasks = [
      {
        taskId: 'TASK_EX_OPEN_01',
        taskName: 'Kiểm tra trạng thái máy chủ/hạ tầng',
        priority: 'CRITICAL',
        sortOrder: 1,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'EX-OPEN-01',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra trạng thái máy chủ/hạ tầng sàn Exchange.'
      },
      {
        taskId: 'TASK_EX_OPEN_02',
        taskName: 'Kiểm tra tài nguyên CPU/RAM/Disk',
        priority: 'HIGH',
        sortOrder: 2,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'EX-OPEN-02',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra tài nguyên CPU/RAM/Disk các máy chủ sàn Exchange.'
      },
      {
        taskId: 'TASK_EX_OPEN_03',
        taskName: 'Kiểm tra dịch vụ ứng dụng trọng yếu',
        priority: 'CRITICAL',
        sortOrder: 3,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'EX-OPEN-03',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra dịch vụ ứng dụng trọng yếu (Matching Engine, FIX Gateway, OMS).'
      },
      {
        taskId: 'TASK_EX_OPEN_04',
        taskName: 'Kiểm tra cơ sở dữ liệu/replication',
        priority: 'CRITICAL',
        sortOrder: 4,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'EX-OPEN-04',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra cơ sở dữ liệu và đồng bộ replication sàn Exchange.'
      },
      {
        taskId: 'TASK_EX_OPEN_05',
        taskName: 'Kiểm tra monitoring và alerting',
        priority: 'HIGH',
        sortOrder: 5,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'EX-OPEN-05',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra hệ thống monitoring và alerting cảnh báo sàn Exchange.'
      },
      {
        taskId: 'TASK_EX_OPEN_06',
        taskName: 'Kiểm tra log tập trung',
        priority: 'MEDIUM',
        sortOrder: 6,
        timetable: 'Đầu ngày',
        functionUrl: '/admin/system-logs',
        urdReference: 'EX-OPEN-06',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra luồng thu thập log tập trung sàn Exchange.'
      },
      {
        taskId: 'TASK_EX_OPEN_07',
        taskName: 'Kiểm tra đồng bộ thời gian',
        priority: 'HIGH',
        sortOrder: 7,
        timetable: 'Đầu ngày',
        functionUrl: '',
        urdReference: 'EX-OPEN-07',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra đồng bộ thời gian NTP sàn Exchange.'
      },
      {
        taskId: 'TASK_EX_OPEN_08',
        taskName: 'Kiểm tra kết nối với đối tác/hệ thống ngoài',
        priority: 'CRITICAL',
        sortOrder: 8,
        timetable: 'Đầu ngày',
        functionUrl: '/trading-manager/session-open',
        urdReference: 'EX-OPEN-08',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra kết nối với các đối tác và cổng giao dịch quốc tế (CQG, Straits/ACM, CME, LSEG).'
      },
      {
        taskId: 'TASK_EX_OPEN_09',
        taskName: 'Kiểm tra batch/job đầu ngày',
        priority: 'HIGH',
        sortOrder: 9,
        timetable: 'Đầu ngày',
        functionUrl: '/dashboard',
        urdReference: 'EX-OPEN-09',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra kết quả thực thi các batch/job đầu ngày của sàn Exchange.'
      },
      {
        taskId: 'TASK_EX_OPEN_10',
        taskName: 'Kiểm tra tồn đọng sự cố/cảnh báo từ ca trước',
        priority: 'HIGH',
        sortOrder: 10,
        timetable: 'Đầu ngày',
        functionUrl: '/checklist',
        urdReference: 'EX-OPEN-10',
        isBotCheck: false,
        botCheckType: '',
        slaType: 'FIXED_TIME',
        slaDeadline: '06:30',
        actionDescription: 'Kiểm tra tồn đọng sự cố và cảnh báo bàn giao từ phiên trực trước.'
      }
    ];

    // 3. Thực thi Upsert Mẫu 1: CCP - Vận Hành Chi Tiết
    const tpl1Title = 'CCP - Checklist Vận Hành Chi Tiết';
    const tpl1Doc = {
      title: tpl1Title,
      departmentId: defaultDept._id,
      shiftSlotId: slotNight ? slotNight._id : (defaultSlot ? defaultSlot._id : null),
      sessionType: 'CLOSE',
      isActive: true,
      tasks: ccpDetailedTasks,
      updatedAt: new Date()
    };
    const res1 = await db.collection('checklist_templates').updateOne(
      { title: tpl1Title },
      { $set: tpl1Doc },
      { upsert: true }
    );
    console.log(` [1/3] Đã nạp thành công Mẫu: "${tpl1Title}" (${ccpDetailedTasks.length} nhiệm vụ theo mốc giờ)`);
    console.log(`     - Upsert: Matched=${res1.matchedCount}, Upserted=${res1.upsertedCount}, Modified=${res1.modifiedCount}`);

    // 4. Thực thi Upsert Mẫu 2: CCP - Vận Hành Đầu Ngày
    const tpl2Title = 'CCP - Checklist Vận Hành Đầu Ngày';
    const tpl2Doc = {
      title: tpl2Title,
      departmentId: defaultDept._id,
      shiftSlotId: slotMorning ? slotMorning._id : (defaultSlot ? defaultSlot._id : null),
      sessionType: 'OPEN',
      isActive: true,
      tasks: ccpOpenTasks,
      updatedAt: new Date()
    };
    const res2 = await db.collection('checklist_templates').updateOne(
      { title: tpl2Title },
      { $set: tpl2Doc },
      { upsert: true }
    );
    console.log(` [2/3] Đã nạp thành công Mẫu: "${tpl2Title}" (${ccpOpenTasks.length} nhiệm vụ hạ tầng)`);
    console.log(`     - Upsert: Matched=${res2.matchedCount}, Upserted=${res2.upsertedCount}, Modified=${res2.modifiedCount}`);

    // 5. Thực thi Upsert Mẫu 3: Exchange - Vận Hành Đầu Ngày
    const tpl3Title = 'EXCHANGE - Checklist Vận Hành Đầu Ngày';
    const tpl3Doc = {
      title: tpl3Title,
      departmentId: defaultDept._id,
      shiftSlotId: slotMorning ? slotMorning._id : (defaultSlot ? defaultSlot._id : null),
      sessionType: 'OPEN',
      isActive: true,
      tasks: exchangeOpenTasks,
      updatedAt: new Date()
    };
    const res3 = await db.collection('checklist_templates').updateOne(
      { title: tpl3Title },
      { $set: tpl3Doc },
      { upsert: true }
    );
    console.log(` [3/3] Đã nạp thành công Mẫu: "${tpl3Title}" (${exchangeOpenTasks.length} nhiệm vụ Exchange)`);
    console.log(`     - Upsert: Matched=${res3.matchedCount}, Upserted=${res3.upsertedCount}, Modified=${res3.modifiedCount}`);

    console.log('=======================================================================');
    console.log('🎉 HOÀN TẤT NẠP TOÀN BỘ 3 MẪU CHECKLIST CHUẨN 100% VÀO DATABASE!');
    console.log('   - Kiểm tra trên Web: http://localhost:3000/admin/templates');
    console.log('   - Khởi tạo ca trực: http://localhost:3000/dashboard');
    console.log('=======================================================================');

  } catch (err) {
    console.error(' Lỗi khi nạp templates:', err);
  } finally {
    await client.close();
  }
}

seedCcpExchangeTemplates();
