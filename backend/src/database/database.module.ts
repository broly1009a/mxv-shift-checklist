import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeedService } from './seed.service';
import { Department, DepartmentSchema } from '../schemas/department.schema';
import { User, UserSchema } from '../schemas/user.schema';
import {
  ChecklistTemplate,
  ChecklistTemplateSchema,
} from '../schemas/template.schema';
import { Division, DivisionSchema } from '../schemas/division.schema';
import { ShiftSlot, ShiftSlotSchema } from '../schemas/shift-slot.schema';
import {
  WorkingCalendar,
  WorkingCalendarSchema,
} from '../schemas/working-calendar.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Department.name, schema: DepartmentSchema },
      { name: User.name, schema: UserSchema },
      { name: ChecklistTemplate.name, schema: ChecklistTemplateSchema },
      { name: Division.name, schema: DivisionSchema },
      { name: ShiftSlot.name, schema: ShiftSlotSchema },
      { name: WorkingCalendar.name, schema: WorkingCalendarSchema },
    ]),
  ],
  providers: [SeedService],
  exports: [MongooseModule, SeedService],
})
export class DatabaseModule {}
