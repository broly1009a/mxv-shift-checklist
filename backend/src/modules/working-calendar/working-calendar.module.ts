import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  WorkingCalendar,
  WorkingCalendarSchema,
} from '../../schemas/working-calendar.schema';
import { WorkingCalendarController } from './working-calendar.controller';
import { WorkingCalendarService } from './working-calendar.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkingCalendar.name, schema: WorkingCalendarSchema },
    ]),
    AuthModule,
  ],
  controllers: [WorkingCalendarController],
  providers: [WorkingCalendarService],
  exports: [WorkingCalendarService, MongooseModule],
})
export class WorkingCalendarModule {}
