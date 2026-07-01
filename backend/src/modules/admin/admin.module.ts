import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DepartmentsController } from './departments.controller';
import { UsersController } from './users.controller';
import { TemplatesController } from './templates.controller';
import { DivisionsController } from './divisions.controller';
import { Department, DepartmentSchema } from '../../schemas/department.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import {
  ChecklistTemplate,
  ChecklistTemplateSchema,
} from '../../schemas/template.schema';
import { Division, DivisionSchema } from '../../schemas/division.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { Incident, IncidentSchema } from '../../schemas/incident.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Department.name, schema: DepartmentSchema },
      { name: User.name, schema: UserSchema },
      { name: ChecklistTemplate.name, schema: ChecklistTemplateSchema },
      { name: Division.name, schema: DivisionSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: Incident.name, schema: IncidentSchema },
    ]),
    AuthModule,
  ],

  controllers: [
    DepartmentsController,
    UsersController,
    TemplatesController,
    DivisionsController,
  ],
})
export class AdminModule {}
