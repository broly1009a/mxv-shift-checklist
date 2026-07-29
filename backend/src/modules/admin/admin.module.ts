import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DepartmentsController } from './departments.controller';
import { UsersController } from './users.controller';
import { TemplatesController } from './templates.controller';
import { Department, DepartmentSchema } from '../../schemas/department.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import {
  ChecklistTemplate,
  ChecklistTemplateSchema,
} from '../../schemas/template.schema';
import { ShiftLog, ShiftLogSchema } from '../../schemas/shift-log.schema';
import { Incident, IncidentSchema } from '../../schemas/incident.schema';
import { Role, RoleSchema } from '../../schemas/role.schema';
import { AuthModule } from '../auth/auth.module';

import { RolesController } from './roles.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Department.name, schema: DepartmentSchema },
      { name: User.name, schema: UserSchema },
      { name: ChecklistTemplate.name, schema: ChecklistTemplateSchema },
      { name: ShiftLog.name, schema: ShiftLogSchema },
      { name: Incident.name, schema: IncidentSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    AuthModule,
  ],

  controllers: [
    DepartmentsController,
    UsersController,
    TemplatesController,
    RolesController,
  ],
})
export class AdminModule {}
