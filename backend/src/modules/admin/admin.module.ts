import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DepartmentsController } from './departments.controller';
import { UsersController } from './users.controller';
import { TemplatesController } from './templates.controller';
import { DivisionsController } from './divisions.controller';
import { Department, DepartmentSchema } from '../../schemas/department.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { ChecklistTemplate, ChecklistTemplateSchema } from '../../schemas/template.schema';
import { Division, DivisionSchema } from '../../schemas/division.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Department.name, schema: DepartmentSchema },
      { name: User.name, schema: UserSchema },
      { name: ChecklistTemplate.name, schema: ChecklistTemplateSchema },
      { name: Division.name, schema: DivisionSchema },
    ]),
  ],
  controllers: [DepartmentsController, UsersController, TemplatesController, DivisionsController],
})
export class AdminModule {}
