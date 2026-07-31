import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeedService } from './seed.service';
import { Department, DepartmentSchema } from '../schemas/department.schema';
import { User, UserSchema } from '../schemas/user.schema';
import {
  ChecklistTemplate,
  ChecklistTemplateSchema,
} from '../schemas/template.schema';
import { ShiftSlot, ShiftSlotSchema } from '../schemas/shift-slot.schema';
import {
  WorkingCalendar,
  WorkingCalendarSchema,
} from '../schemas/working-calendar.schema';
import { Role, RoleSchema } from '../schemas/role.schema';
import { Exchange, ExchangeSchema } from '../schemas/exchange.schema';
import { ExchangeHoliday, ExchangeHolidaySchema } from '../schemas/exchange-holiday.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Department.name, schema: DepartmentSchema },
      { name: User.name, schema: UserSchema },
      { name: ChecklistTemplate.name, schema: ChecklistTemplateSchema },
      { name: ShiftSlot.name, schema: ShiftSlotSchema },
      { name: WorkingCalendar.name, schema: WorkingCalendarSchema },
      { name: Role.name, schema: RoleSchema },
      { name: Exchange.name, schema: ExchangeSchema },
      { name: ExchangeHoliday.name, schema: ExchangeHolidaySchema },
    ]),
  ],
  providers: [SeedService],
  exports: [MongooseModule, SeedService],
})
export class DatabaseModule {}

