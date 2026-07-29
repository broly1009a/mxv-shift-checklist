import * as fs from 'fs';
import * as path from 'path';
import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Department } from '../schemas/department.schema';
import { User } from '../schemas/user.schema';
import { ChecklistTemplate } from '../schemas/template.schema';
import { ShiftSlot } from '../schemas/shift-slot.schema';
import { WorkingCalendar } from '../schemas/working-calendar.schema';
import { Role } from '../schemas/role.schema';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ChecklistTemplate.name)
    private readonly templateModel: Model<ChecklistTemplate>,
    @InjectModel(ShiftSlot.name)
    private readonly shiftSlotModel: Model<ShiftSlot>,
    @InjectModel(WorkingCalendar.name)
    private readonly workingCalendarModel: Model<WorkingCalendar>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
  ) {}

  async onApplicationBootstrap() {
    const isAutoSeedEnabled = process.env.ENABLE_AUTO_SEED !== 'false';
    if (!isAutoSeedEnabled) {
      this.logger.log(
        'Automatic database seeding is DISABLED via ENABLE_AUTO_SEED=false. Skipping.',
      );
      return;
    }

    this.logger.log('Starting database seeding...');
    try {
      await this.seedRoles();
      const depts = await this.seedDepartments();
      await this.seedUsers(depts);
      const slots = await this.seedShiftSlots();
      await this.seedWorkingCalendar();
      await this.seedTemplates(depts, slots);
      this.logger.log('Database seeding completed successfully.');
    } catch (error) {
      this.logger.error('Error seeding database', error);
    }
  }

  private async seedDepartments(): Promise<Record<string, string>> {
    // Delete legacy departments to clean up old codes
    await this.departmentModel
      .deleteMany({ code: { $in: ['RE_OPS', 'MARKET_SURV'] } })
      .exec();

    const departments = [
      {
        name: 'IT Core Operations',
        code: 'IT_CORE',
      },
      {
        name: 'Nghiên cứu và Phát triển Công nghệ',
        code: 'IT_RND',
      },
      {
        name: 'Trading Operations',
        code: 'QLGD_OPS',
      },
      {
        name: 'Risk Management',
        code: 'QLRR_RISK',
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
        await doc.save();
      }
      mapping[dept.code] = doc._id.toString();
    }
    return mapping;
  }

  private async seedUsers(
    depts: Record<string, string>,
  ) {
    const passwordHashAdmin = await bcrypt.hash('Admin@MXV123', 10);
    const passwordHashStaff = await bcrypt.hash('Staff@MXV123', 10);
    const passwordHashLeader = await bcrypt.hash('Lead@MXV123', 10);
    const passwordHashCeo = await bcrypt.hash('Ceo@MXV123', 10);
    const passwordHashChairman = await bcrypt.hash('Chairman@MXV123', 10);

    const users = [
      {
        username: 'admin',
        passwordHash: passwordHashAdmin,
        fullName: 'System Administrator',
        departmentId: null,
        role: 'ADMIN',
        isActive: true,
      },
      {
        username: 'chairman',
        passwordHash: passwordHashChairman,
        fullName: 'Chủ tịch Hội đồng',
        departmentId: null,
        role: 'CHAIRMAN',
        isActive: true,
      },
      {
        username: 'ceo',
        passwordHash: passwordHashCeo,
        fullName: 'Tổng Giám đốc',
        departmentId: null,
        role: 'CEO',
        isActive: true,
      },
      {
        username: 'lead_it_ops',
        passwordHash: passwordHashLeader,
        fullName: 'Trưởng bộ phận Vận hành',
        departmentId: depts['IT_CORE'],
        role: 'DEPARTMENT_HEAD',
        isActive: true,
      },
      {
        username: 'sonhh',
        passwordHash: passwordHashStaff,
        fullName: 'Hồ Huy Sơn',
        departmentId: depts['IT_CORE'],
        role: 'STAFF',
        isActive: true,
      },
      {
        username: 'ops_staff',
        passwordHash: passwordHashStaff,
        fullName: 'Nhân viên Giao nhận',
        departmentId: depts['QLGD_OPS'],
        role: 'STAFF',
        isActive: true,
      },
      {
        username: 'surv_staff',
        passwordHash: passwordHashStaff,
        fullName: 'Nhân viên Giám sát',
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

    const jsonPath = path.join(__dirname, 'exported_templates.json');
    let templatesData: any[] = [];
    if (fs.existsSync(jsonPath)) {
      templatesData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } else {
      templatesData = [
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
          ],
        },
      ];
    }

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
        const hasSubTasks =
          existing.tasks && existing.tasks.some((t: any) => t.parentTaskId);
        const updateData: any = {
          title: tpl.title,
          shiftSlotId: slotId,
          isActive: true,
        };
        if (!hasSubTasks) {
          updateData.tasks = tpl.tasks;
        }
        await this.templateModel
          .updateOne({ _id: existing._id }, { $set: updateData })
          .exec();
        this.logger.log(`Updated checklist template: ${tpl.title}`);
      }
    }
  }

  private async seedRoles() {
    const roles = [
      {
        code: 'ADMIN',
        name: 'Quản trị viên',
        permissions: [
          'VIEW_CHECKLIST', 'EDIT_CHECKLIST', 'INITIALIZE_SHIFT', 'CLOSE_SHIFT',
          'ACCESS_MARGIN_CHANGE', 'ACCESS_AUTO_SHIFT', 'ACCESS_HEALTH_CHECKS', 'RESOLVE_INCIDENTS',
          'MANAGE_TEMPLATES', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_CALENDAR'
        ]
      },
      {
        code: 'DEPARTMENT_HEAD',
        name: 'Trưởng bộ phận / Trưởng ca',
        permissions: [
          'VIEW_CHECKLIST', 'EDIT_CHECKLIST', 'INITIALIZE_SHIFT', 'CLOSE_SHIFT',
          'RESOLVE_INCIDENTS', 'MANAGE_TEMPLATES', 'ACCESS_MARGIN_CHANGE', 'ACCESS_AUTO_SHIFT', 'ACCESS_HEALTH_CHECKS'
        ]
      },
      {
        code: 'STAFF',
        name: 'Nhân viên vận hành',
        permissions: [
          'VIEW_CHECKLIST', 'EDIT_CHECKLIST', 'RESOLVE_INCIDENTS', 'ACCESS_MARGIN_CHANGE', 'ACCESS_AUTO_SHIFT', 'ACCESS_HEALTH_CHECKS'
        ]
      },
      {
        code: 'CEO',
        name: 'Tổng Giám đốc',
        permissions: [
          'VIEW_CHECKLIST', 'ACCESS_MARGIN_CHANGE'
        ]
      },
      {
        code: 'CHAIRMAN',
        name: 'Chủ tịch Hội đồng',
        permissions: [
          'VIEW_CHECKLIST', 'ACCESS_MARGIN_CHANGE'
        ]
      }
    ];

    for (const r of roles) {
      let doc = await this.roleModel.findOne({ code: r.code }).exec();
      if (!doc) {
        doc = new this.roleModel(r);
        await doc.save();
        this.logger.log(`Seeded role: ${r.name}`);
      } else {
        doc.name = r.name;
        if (!doc.permissions || doc.permissions.length === 0) {
          doc.permissions = r.permissions;
        }
        await doc.save();
      }
    }
  }
}
