import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Department } from '../schemas/department.schema';
import { User } from '../schemas/user.schema';
import { ChecklistTemplate } from '../schemas/template.schema';
import { Division } from '../schemas/division.schema';
import { ShiftSlot } from '../schemas/shift-slot.schema';
import { WorkingCalendar } from '../schemas/working-calendar.schema';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ChecklistTemplate.name)
    private readonly templateModel: Model<ChecklistTemplate>,
    @InjectModel(Division.name) private readonly divisionModel: Model<Division>,
    @InjectModel(ShiftSlot.name)
    private readonly shiftSlotModel: Model<ShiftSlot>,
    @InjectModel(WorkingCalendar.name)
    private readonly workingCalendarModel: Model<WorkingCalendar>,
  ) {}

  async onApplicationBootstrap() {
    this.logger.log('Starting database seeding...');
    try {
      const divs = await this.seedDivisions();
      const depts = await this.seedDepartments(divs);
      await this.seedUsers(divs, depts);
      const slots = await this.seedShiftSlots();
      await this.seedWorkingCalendar();
      await this.seedTemplates(depts, slots);
      this.logger.log('Database seeding completed successfully.');
    } catch (error) {
      this.logger.error('Error seeding database', error);
    }
  }

  private async seedDivisions(): Promise<Record<string, string>> {
    const divisions = [
      { name: 'Khối Công nghệ thông tin', code: 'IT_DIVISION' },
      { name: 'Khối Quản lý Giao dịch', code: 'TRADE_DIVISION' },
      { name: 'Khối Hành chính Nhân sự', code: 'HR_DIVISION' },
    ];

    const mapping: Record<string, string> = {};
    for (const div of divisions) {
      let doc = await this.divisionModel.findOne({ code: div.code }).exec();
      if (!doc) {
        doc = new this.divisionModel(div);
        await doc.save();
        this.logger.log(`Seeded division: ${div.name}`);
      }
      mapping[div.code] = doc._id.toString();
    }
    return mapping;
  }

  private async seedDepartments(
    divs: Record<string, string>,
  ): Promise<Record<string, string>> {
    // Delete legacy departments to clean up old codes
    await this.departmentModel
      .deleteMany({ code: { $in: ['RE_OPS', 'MARKET_SURV'] } })
      .exec();

    const departments = [
      {
        name: 'IT Core Operations',
        code: 'IT_CORE',
        divisionId: divs['IT_DIVISION'],
      },
      {
        name: 'Nghiên cứu và Phát triển Công nghệ',
        code: 'IT_RND',
        divisionId: divs['IT_DIVISION'],
      },
      {
        name: 'Trading Operations',
        code: 'QLGD_OPS',
        divisionId: divs['TRADE_DIVISION'],
      },
      {
        name: 'Risk Management',
        code: 'QLRR_RISK',
        divisionId: divs['TRADE_DIVISION'],
      },
    ];

    const mapping: Record<string, string> = {};
    for (const dept of departments) {
      let doc = await this.departmentModel.findOne({ code: dept.code }).exec();
      if (!doc) {
        doc = new this.departmentModel(dept);
        await doc.save();
        this.logger.log(`Seeded department: ${dept.name}`);
      } else {
        doc.name = dept.name;
        doc.divisionId = dept.divisionId as any;
        await doc.save();
      }
      mapping[dept.code] = doc._id.toString();
    }
    return mapping;
  }

  private async seedUsers(
    divs: Record<string, string>,
    depts: Record<string, string>,
  ) {
    const passwordHashAdmin = await bcrypt.hash('Admin@MXV123', 10);
    const passwordHashStaff = await bcrypt.hash('Staff@MXV123', 10);
    const passwordHashLeader = await bcrypt.hash('Lead@MXV123', 10);
    const passwordHashDirector = await bcrypt.hash('Director@MXV123', 10);
    const passwordHashCeo = await bcrypt.hash('Ceo@MXV123', 10);
    const passwordHashChairman = await bcrypt.hash('Chairman@MXV123', 10);

    const users = [
      {
        username: 'admin',
        passwordHash: passwordHashAdmin,
        fullName: 'System Administrator',
        divisionId: null,
        departmentId: null,
        role: 'ADMIN',
        isActive: true,
      },
      {
        username: 'chairman',
        passwordHash: passwordHashChairman,
        fullName: 'Chủ tịch Hội đồng',
        divisionId: null,
        departmentId: null,
        role: 'CHAIRMAN',
        isActive: true,
      },
      {
        username: 'ceo',
        passwordHash: passwordHashCeo,
        fullName: 'Tổng Giám đốc',
        divisionId: null,
        departmentId: null,
        role: 'CEO',
        isActive: true,
      },
      {
        username: 'dir_it',
        passwordHash: passwordHashDirector,
        fullName: 'Giám đốc Khối CNTT',
        divisionId: divs['IT_DIVISION'],
        departmentId: null,
        role: 'DIVISION_DIRECTOR',
        isActive: true,
      },
      {
        username: 'lead_it_ops',
        passwordHash: passwordHashLeader,
        fullName: 'Trưởng bộ phận Vận hành',
        divisionId: divs['IT_DIVISION'],
        departmentId: depts['IT_CORE'],
        role: 'DEPARTMENT_HEAD',
        isActive: true,
      },
      {
        username: 'sonhh',
        passwordHash: passwordHashStaff,
        fullName: 'Hồ Huy Sơn',
        divisionId: divs['IT_DIVISION'],
        departmentId: depts['IT_CORE'],
        role: 'STAFF',
        isActive: true,
      },
      {
        username: 'ops_staff',
        passwordHash: passwordHashStaff,
        fullName: 'Nhân viên Giao nhận',
        divisionId: divs['TRADE_DIVISION'],
        departmentId: depts['QLGD_OPS'],
        role: 'STAFF',
        isActive: true,
      },
      {
        username: 'surv_staff',
        passwordHash: passwordHashStaff,
        fullName: 'Nhân viên Giám sát',
        divisionId: divs['TRADE_DIVISION'],
        departmentId: depts['QLRR_RISK'],
        role: 'STAFF',
        isActive: true,
      },
    ];

    for (const user of users) {
      const existing = await this.userModel
        .findOne({ username: user.username })
        .exec();
      if (!existing) {
        const doc = new this.userModel(user);
        await doc.save();
        this.logger.log(`Seeded user: ${user.username}`);
      } else {
        existing.isActive = true;
        existing.role = user.role;
        existing.fullName = user.fullName;
        existing.divisionId = user.divisionId as any;
        existing.departmentId = user.departmentId as any;
        await existing.save();
      }
    }
  }

  private async seedShiftSlots(): Promise<Record<string, string>> {
    const shiftSlots = [
      {
        code: 'SHIFT_1',
        name: 'Ca 1',
        startTime: '14:00',
        endTime: '22:00',
        isOvernight: false,
        isActive: true,
        sortOrder: 1,
      },
      {
        code: 'SHIFT_2',
        name: 'Ca 2 (Qua đêm)',
        startTime: '22:00',
        endTime: '06:00',
        isOvernight: true,
        isActive: true,
        sortOrder: 2,
      },
      {
        code: 'SHIFT_3',
        name: 'Ca 3',
        startTime: '06:00',
        endTime: '14:00',
        isOvernight: false,
        isActive: true,
        sortOrder: 3,
      },
      {
        code: 'OFFICE_SHIFT',
        name: 'Ca hành chính',
        startTime: '08:00',
        endTime: '17:30',
        isOvernight: false,
        isActive: true,
        sortOrder: 4,
      },
    ];

    const mapping: Record<string, string> = {};
    for (const slot of shiftSlots) {
      let doc = await this.shiftSlotModel.findOne({ code: slot.code }).exec();
      if (!doc) {
        doc = new this.shiftSlotModel(slot);
        await doc.save();
        this.logger.log(`Seeded shift slot: ${slot.code}`);
      } else {
        doc.name = slot.name;
        doc.startTime = slot.startTime;
        doc.endTime = slot.endTime;
        doc.isOvernight = slot.isOvernight;
        doc.isActive = slot.isActive;
        doc.sortOrder = slot.sortOrder;
        await doc.save();
      }
      mapping[slot.code] = doc._id.toString();
    }
    return mapping;
  }

  private async seedWorkingCalendar() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Saigon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

    // Construct a Date object representing Saigon timezone components locally
    const saigonTime = new Date(
      Number(partMap.year),
      Number(partMap.month) - 1,
      Number(partMap.day),
      Number(partMap.hour),
      Number(partMap.minute),
      Number(partMap.second),
    );

    const format = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    const dates = [];
    // Seed today
    dates.push({
      date: format(saigonTime),
      isTradingDay: true,
      isHoliday: false,
      note: 'Ngày giao dịch bình thường',
    });

    // Seed next 5 days
    for (let i = 1; i <= 5; i++) {
      const nextDay = new Date(saigonTime.getTime() + i * 24 * 60 * 60 * 1000);
      const dayOfWeek = nextDay.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      dates.push({
        date: format(nextDay),
        isTradingDay: !isWeekend,
        isHoliday: false,
        note: isWeekend ? 'Cuối tuần' : 'Ngày giao dịch bình thường',
      });
    }

    for (const d of dates) {
      const existing = await this.workingCalendarModel
        .findOne({ date: d.date })
        .exec();
      if (!existing) {
        const [year, month, day] = d.date.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const doc = new this.workingCalendarModel({
          date: d.date,
          isTradingDay: d.isTradingDay,
          isHoliday: d.isHoliday,
          isWeekend,
          note: d.note,
        });
        await doc.save();
        this.logger.log(`Seeded working calendar: ${d.date}`);
      }
    }
  }

  private async seedTemplates(
    depts: Record<string, string>,
    slots: Record<string, string>,
  ) {
    // Delete legacy templates using old department IDs or references
    await this.templateModel
      .deleteMany({
        title: {
          $in: [
            'Checklist Mở Cửa - Phòng Nghiệp Vụ Giao Nhận',
            'Checklist Trong Phiên - Phòng Nghiệp Vụ Giao Nhận',
            'Checklist Đóng Cửa - Phòng Nghiệp Vụ Giao Nhận',
            'Checklist Mở Cửa - Phòng Giám Sát Thị Trường',
            'Checklist Trong Phiên - Phòng Giám Sát Thị Trường',
            'Checklist Đóng Cửa - Phòng Giám Sát Thị Trường',
          ],
        },
      })
      .exec();

    const templatesData = [
      // ==================== IT CORE ====================
      {
        title: 'Checklist Mở Cửa - IT Vận Hành Core',
        departmentCode: 'IT_CORE',
        sessionType: 'OPEN',
        shiftSlotCode: 'SHIFT_3',
        tasks: [
          {
            taskId: 'it_open_01',
            taskName:
              'Kiểm tra kết nối hệ thống mạng nội bộ (Intranet) và kết nối VPN sang các đầu mối Thành viên kinh doanh',
            priority: 'HIGH',
            sortOrder: 1,
            functionUrl: 'http://intranet.mxv.vn/ping',
            urdReference: 'URD-NET-001',
          },
          {
            taskId: 'it_open_02',
            taskName:
              'Kiểm tra ping và trạng thái kết nối cổng FIX Gateway sang hệ thống bù trừ của ngân hàng liên kết (MSB UAT/Production)',
            priority: 'CRITICAL',
            sortOrder: 2,
            functionUrl: 'http://gateway.mxv.vn/fix',
            urdReference: 'URD-FIX-002',
          },
          {
            taskId: 'it_open_03',
            taskName:
              'Khởi động dịch vụ BroadcastServer và kiểm tra log kết nối luồng giá Realtime qua giao thức WebSocket thuần (ws)',
            priority: 'CRITICAL',
            sortOrder: 3,
            isBotCheck: true,
            botTriggerTime: '06:05',
          },
          {
            taskId: 'it_open_04',
            taskName:
              'Kiểm tra dung lượng ổ đĩa cứng (Disk Storage) và mức độ tiêu thụ RAM/CPU của cụm máy chủ cơ sở dữ liệu MongoDB',
            priority: 'HIGH',
            sortOrder: 4,
            dependsOnTaskIds: ['it_open_01'],
          },
          {
            taskId: 'it_open_05',
            taskName:
              'Xác nhận đồng bộ thành công dữ liệu giá mở cửa đầu ngày (Snapshot Full Refresh) từ các sàn quốc tế liên thông',
            priority: 'CRITICAL',
            sortOrder: 5,
            dependsOnTaskIds: ['it_open_02'],
          },
        ],
      },
      {
        title: 'Checklist Trong Phiên - IT Vận Hành Core',
        departmentCode: 'IT_CORE',
        sessionType: 'DURING',
        shiftSlotCode: 'SHIFT_1',
        tasks: [
          {
            taskId: 'it_during_01',
            taskName:
              'Giám sát luồng tin nhắn cập nhật giá biến động (Incremental Refresh) tránh tình trạng nghẽn/trễ hàng tin (Message Queue)',
            priority: 'HIGH',
            sortOrder: 1,
          },
          {
            taskId: 'it_during_02',
            taskName:
              'Kiểm tra và bóc tách log tập trung trên Grafana Loki để phát hiện sớm các mã lỗi kết nối mạng từ phía máy Client của Thành viên',
            priority: 'MEDIUM',
            sortOrder: 2,
          },
          {
            taskId: 'it_during_03',
            taskName:
              'Theo dõi trạng thái xử lý lỗi Buffer.isBuffer(data) khi hệ thống tiếp nhận các chuỗi dữ liệu thô nhị phân từ cổng mạng',
            priority: 'HIGH',
            sortOrder: 3,
          },
        ],
      },
      {
        title: 'Checklist Đóng Cửa - IT Vận Hành Core',
        departmentCode: 'IT_CORE',
        sessionType: 'CLOSE',
        shiftSlotCode: 'SHIFT_2',
        tasks: [
          {
            taskId: 'it_close_01',
            taskName:
              'Thực hiện tiến trình sao lưu cơ sở dữ liệu tự động (Auto-backup Database Snapshot) cuối ngày của phân hệ ca trực',
            priority: 'HIGH',
            sortOrder: 1,
            isBotCheck: true,
            botTriggerTime: '23:30',
          },
          {
            taskId: 'it_close_02',
            taskName:
              'Kiểm tra trạng thái đóng cổng kết nối API và ngắt các phiên kết nối Realtime (Socket Session) của Client an toàn',
            priority: 'MEDIUM',
            sortOrder: 2,
          },
          {
            taskId: 'it_close_03',
            taskName:
              'Xuất file báo cáo Log lỗi hệ thống trong ngày bàn giao cho ca trực tiếp theo xử lý kỹ thuật',
            priority: 'LOW',
            sortOrder: 3,
          },
        ],
      },

      // ==================== TRADING OPERATIONS ====================
      {
        title: 'Checklist Mở Cửa - Trading Operations',
        departmentCode: 'QLGD_OPS',
        sessionType: 'OPEN',
        shiftSlotCode: 'SHIFT_3',
        tasks: [
          {
            taskId: 'ops_open_01',
            taskName:
              'Kiểm tra danh sách các mã hợp đồng hàng hóa đến kỳ hạn giao nhận vật chất trong ngày (Xác định khung ngày FND và LND)',
            priority: 'HIGH',
            sortOrder: 1,
          },
          {
            taskId: 'ops_open_02',
            taskName:
              'Cập nhật biểu phí giao nhận, phí lưu kho vật chất mới nhất áp dụng cho các mặt hàng kim loại (Bạc, Đồng) và năng lượng',
            priority: 'MEDIUM',
            sortOrder: 2,
          },
          {
            taskId: 'ops_open_03',
            taskName:
              'Đối chiếu số dư tài khoản tiền mặt (LND - Lọc Nộp Dòng) đầu ngày của danh sách Nhà đầu tư đăng ký nhận hàng',
            priority: 'CRITICAL',
            sortOrder: 3,
            dependsOnTaskIds: ['ops_open_02'],
          },
        ],
      },
      {
        title: 'Checklist Trong Phiên - Trading Operations',
        departmentCode: 'QLGD_OPS',
        sessionType: 'DURING',
        shiftSlotCode: 'SHIFT_1',
        tasks: [
          {
            taskId: 'ops_during_01',
            taskName:
              'Tiếp nhận và phê duyệt các yêu cầu đăng ký lưu ký vật chất (DELIVERY_DEPOSIT) của bên Bán gửi lên từ UI',
            priority: 'HIGH',
            sortOrder: 1,
          },
          {
            taskId: 'ops_during_02',
            taskName:
              'Xử lý phê duyệt hoặc từ chối các yêu cầu Hủy lưu ký (CANCEL_DEPOSIT) dựa trên điều kiện kiểm tra trạng thái tài khoản MSB',
            priority: 'HIGH',
            sortOrder: 2,
          },
          {
            taskId: 'ops_during_03',
            taskName:
              'Kiểm tra tính hợp lệ của các yêu cầu rút ký quỹ (MARGIN_WITHDRAW), đối chiếu sức mua TTM trước khi duyệt chuyển tiền sang VCB',
            priority: 'CRITICAL',
            sortOrder: 3,
          },
          {
            taskId: 'ops_during_04',
            taskName:
              'Giám sát luồng dữ liệu phản hồi MSB_STATUS từ phía ngân hàng để cập nhật trạng thái "Người bán đã giao Bạc" sang mã "S"',
            priority: 'HIGH',
            sortOrder: 4,
          },
          {
            taskId: 'ops_during_05',
            taskName:
              'Tiếp nhận yêu cầu Đăng ký nhận hàng vật chất (DELIVERY_PHYSICAL_REGIS), kiểm tra ràng buộc vị thế Mua mở (Long Position)',
            priority: 'CRITICAL',
            sortOrder: 5,
          },
          {
            taskId: 'ops_during_06',
            taskName:
              'Xử lý hồ sơ đăng ký nhận hàng chỉ định (RECEIVE_DESIGNATED), đối chiếu mã phiếu ghép cặp (pairingCode) phát hành bởi CCP',
            priority: 'HIGH',
            sortOrder: 6,
          },
        ],
      },
      {
        title: 'Checklist Đóng Cửa - Trading Operations',
        departmentCode: 'QLGD_OPS',
        sessionType: 'CLOSE',
        shiftSlotCode: 'SHIFT_2',
        tasks: [
          {
            taskId: 'ops_close_01',
            taskName:
              'Thực hiện xử lý EOD vật chất (End-of-Day): Quét trừ tiền phí giao nhận của các tài khoản (chấp nhận trừ âm nếu thiếu tiền)',
            priority: 'CRITICAL',
            sortOrder: 1,
          },
          {
            taskId: 'ops_close_02',
            taskName:
              'Kết xuất file đối chiếu tổng hợp dữ liệu giao nhận an toàn sang ngân hàng MSB chi nhánh Đống Đa và TP.HCM',
            priority: 'HIGH',
            sortOrder: 2,
          },
          {
            taskId: 'ops_close_03',
            taskName:
              'Hủy toàn bộ các yêu cầu đăng ký giao nhận vật chất còn tồn đọng ở trạng thái PENDING chưa được duyệt tính đến cuối ngày',
            priority: 'MEDIUM',
            sortOrder: 3,
          },
        ],
      },

      // ==================== RISK MANAGEMENT ====================
      {
        title: 'Checklist Mở Cửa - Risk Management',
        departmentCode: 'QLRR_RISK',
        sessionType: 'OPEN',
        shiftSlotCode: 'SHIFT_3',
        tasks: [
          {
            taskId: 'surv_open_01',
            taskName:
              'Kiểm tra biên độ dao động giá trần/giá sàn (Price Limit) của toàn bộ các mặt hàng giao dịch trước giờ mở cửa',
            priority: 'CRITICAL',
            sortOrder: 1,
          },
          {
            taskId: 'surv_open_02',
            taskName:
              'Xác nhận trạng thái hoạt động (Active) của tài khoản các Thành viên kinh doanh lớn trên hệ thống lõi',
            priority: 'HIGH',
            sortOrder: 2,
          },
          {
            taskId: 'surv_open_03',
            taskName:
              'Kiểm tra cấu hình cảnh báo tỷ lệ ký quỹ rủi ro tự động trên hệ thống giám sát tập trung',
            priority: 'HIGH',
            sortOrder: 3,
          },
        ],
      },
      {
        title: 'Checklist Trong Phiên - Risk Management',
        departmentCode: 'QLRR_RISK',
        sessionType: 'DURING',
        shiftSlotCode: 'SHIFT_1',
        tasks: [
          {
            taskId: 'surv_during_01',
            taskName:
              'Giám sát các lệnh giao dịch có khối lượng lớn bất thường (Big Trades) nhằm phát hiện hành vi thao túng thị trường',
            priority: 'HIGH',
            sortOrder: 1,
          },
          {
            taskId: 'surv_during_02',
            taskName:
              'Theo dõi tổng số lượng vị thế mở (Open Interest - OI) của các kỳ hạn lệnh, cảnh báo nếu vượt hạn mức quy định của Sở',
            priority: 'HIGH',
            sortOrder: 2,
          },
          {
            taskId: 'surv_during_03',
            taskName:
              'Phát lệnh cảnh báo (Margin Call) hoặc tạm khóa vị thế đối với các tài khoản NĐT sụt giảm tỷ lệ ký quỹ xuống mức rủi ro',
            priority: 'CRITICAL',
            sortOrder: 3,
          },
          {
            taskId: 'surv_during_04',
            taskName:
              'Xử lý tạm ngừng giao dịch đối với các mã hợp đồng xảy ra hiện tượng chạm giá trần hoặc giá sàn liên tục',
            priority: 'CRITICAL',
            sortOrder: 4,
          },
        ],
      },
      {
        title: 'Checklist Đóng Cửa - Risk Management',
        departmentCode: 'QLRR_RISK',
        sessionType: 'CLOSE',
        shiftSlotCode: 'SHIFT_2',
        tasks: [
          {
            taskId: 'surv_close_01',
            taskName:
              'Chốt mức giá quyết toán cuối ngày (Settlement Price) cho toàn bộ các mặt hàng để làm căn cứ tính toán lãi/lỗ vị thế',
            priority: 'CRITICAL',
            sortOrder: 1,
          },
          {
            taskId: 'surv_close_02',
            taskName:
              'Kích hoạt luồng chỉ định giao hàng bắt buộc từ CCP (DELIVERY_DESIGNATED) đối với các vị thế Bán mở còn giữ lại đến ngày LTD',
            priority: 'CRITICAL',
            sortOrder: 2,
          },
          {
            taskId: 'surv_close_03',
            taskName:
              'Tổng hợp danh sách các tài khoản vi phạm quy chế giao dịch hoặc để trạng thái tài khoản bị âm tiền sau phiên EOD',
            priority: 'HIGH',
            sortOrder: 3,
          },
          {
            taskId: 'surv_close_04',
            taskName:
              'Xuất báo cáo tổng kết phiên giao dịch (Daily Market Report) gửi Hội đồng ban giám đốc Sở',
            priority: 'MEDIUM',
            sortOrder: 4,
          },
        ],
      },
    ];

    for (const tpl of templatesData) {
      const deptId = depts[tpl.departmentCode];
      if (!deptId) continue;

      const slotId = slots[tpl.shiftSlotCode];
      if (!slotId) continue;

      const existing = await this.templateModel
        .findOne({ departmentId: deptId, sessionType: tpl.sessionType })
        .exec();

      if (!existing) {
        const doc = new this.templateModel({
          title: tpl.title,
          departmentId: deptId,
          sessionType: tpl.sessionType,
          shiftSlotId: slotId,
          isActive: true,
          tasks: tpl.tasks,
        });
        await doc.save();
        this.logger.log(`Seeded checklist template: ${tpl.title}`);
      } else {
        existing.title = tpl.title;
        existing.shiftSlotId = slotId as any;
        existing.isActive = true;
        existing.tasks = tpl.tasks;
        existing.markModified('tasks');
        await existing.save();
        this.logger.log(`Updated checklist template: ${tpl.title}`);
      }
    }
  }
}
