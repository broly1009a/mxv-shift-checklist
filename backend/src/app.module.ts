import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ShiftsModule } from './modules/shifts/shifts.module';
import { DatabaseModule } from './database/database.module';
import { AdminModule } from './modules/admin/admin.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { ActivityLogInterceptor } from './interceptors/activity-log.interceptor';
import { ShiftSlotsModule } from './modules/shift-slots/shift-slots.module';
import { WorkingCalendarModule } from './modules/working-calendar/working-calendar.module';
import { ShiftJobsModule } from './modules/shift-jobs/shift-jobs.module';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { SystemLogsModule } from './modules/system-logs/system-logs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { MarginChangeRequestsModule } from './modules/margin-change-requests/margin-change-requests.module';
import { BotEngineModule } from './modules/bot-engine/bot-engine.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trading_mxv',
    ),
    ScheduleModule.forRoot(),
    AuthModule,
    ShiftsModule,
    DatabaseModule,
    AdminModule,
    ActivityLogModule,
    ShiftSlotsModule,
    WorkingCalendarModule,
    ShiftJobsModule,
    SystemSettingsModule,
    SystemLogsModule,
    NotificationsModule,
    DashboardModule,
    IncidentsModule,
    MarginChangeRequestsModule,
    BotEngineModule,
    ReconciliationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
