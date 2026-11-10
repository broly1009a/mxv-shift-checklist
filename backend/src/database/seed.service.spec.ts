import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { SeedService } from './seed.service';
import { Department } from '../schemas/department.schema';
import { User } from '../schemas/user.schema';
import { ChecklistTemplate } from '../schemas/template.schema';
import { ShiftSlot } from '../schemas/shift-slot.schema';
import { WorkingCalendar } from '../schemas/working-calendar.schema';
import { Role } from '../schemas/role.schema';
import { Exchange } from '../schemas/exchange.schema';
import { ExchangeHoliday } from '../schemas/exchange-holiday.schema';

describe('SeedService (Task 2 Security Gate)', () => {
  let service: SeedService;
  const originalEnv = process.env;

  const mockModel = {
    find: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    updateOne: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    process.env = { ...originalEnv };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        { provide: getModelToken(Department.name), useValue: mockModel },
        { provide: getModelToken(User.name), useValue: mockModel },
        { provide: getModelToken(ChecklistTemplate.name), useValue: mockModel },
        { provide: getModelToken(ShiftSlot.name), useValue: mockModel },
        { provide: getModelToken(WorkingCalendar.name), useValue: mockModel },
        { provide: getModelToken(Role.name), useValue: mockModel },
        { provide: getModelToken(Exchange.name), useValue: mockModel },
        { provide: getModelToken(ExchangeHoliday.name), useValue: mockModel },
      ],
    }).compile();

    service = module.get<SeedService>(SeedService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('TC-SEED-01: Bỏ qua hoàn toàn Seeding khi ALLOW_DB_SEED không được bật', async () => {
    delete process.env.ALLOW_DB_SEED;
    const seedRolesSpy = jest.spyOn<any, any>(service, 'seedRoles');

    await service.onApplicationBootstrap();
    expect(seedRolesSpy).not.toHaveBeenCalled();
  });

  it('TC-SEED-02: Bỏ qua Seeding khi đang ở môi trường production kể cả khi ALLOW_DB_SEED=true', async () => {
    process.env.ALLOW_DB_SEED = 'true';
    process.env.NODE_ENV = 'production';
    const seedRolesSpy = jest.spyOn<any, any>(service, 'seedRoles');

    await service.onApplicationBootstrap();
    expect(seedRolesSpy).not.toHaveBeenCalled();
  });

  it('TC-SEED-03: Dừng an toàn (Fail-Fast) khi thiếu INITIAL_ADMIN_PASSWORD', async () => {
    process.env.ALLOW_DB_SEED = 'true';
    process.env.NODE_ENV = 'development';
    delete process.env.INITIAL_ADMIN_PASSWORD;
    const seedRolesSpy = jest.spyOn<any, any>(service, 'seedRoles');

    await service.onApplicationBootstrap();
    expect(seedRolesSpy).not.toHaveBeenCalled();
  });

  it('TC-SEED-04: Cho phép seed khi thỏa mãn đủ điều kiện an toàn và truyền dynamic password', async () => {
    process.env.ALLOW_DB_SEED = 'true';
    process.env.NODE_ENV = 'development';
    process.env.INITIAL_ADMIN_PASSWORD = 'SecureDynamicPass2026!';

    const seedRolesSpy = jest.spyOn<any, any>(service, 'seedRoles').mockResolvedValue(undefined);
    const seedHolidaysSpy = jest.spyOn<any, any>(service, 'seedExchangesAndHolidays').mockResolvedValue(undefined);
    const seedDeptsSpy = jest.spyOn<any, any>(service, 'seedDepartments').mockResolvedValue({});
    const seedUsersSpy = jest.spyOn<any, any>(service, 'seedUsers').mockResolvedValue(undefined);
    const seedSlotsSpy = jest.spyOn<any, any>(service, 'seedShiftSlots').mockResolvedValue([]);
    const seedCalendarSpy = jest.spyOn<any, any>(service, 'seedWorkingCalendar').mockResolvedValue(undefined);
    const seedTemplatesSpy = jest.spyOn<any, any>(service, 'seedTemplates').mockResolvedValue(undefined);

    await service.onApplicationBootstrap();

    expect(seedRolesSpy).toHaveBeenCalled();
    expect(seedUsersSpy).toHaveBeenCalledWith({}, 'SecureDynamicPass2026!');
  });
});

