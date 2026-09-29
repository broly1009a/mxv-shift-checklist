import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module';
import { TkgdAutomationModule } from './modules/tkgd-automation/tkgd-automation.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI ||
        'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority',
    ),
    ScheduleModule.forRoot(),
    SystemSettingsModule,
    TkgdAutomationModule,
  ],
})
export class AppModule {}
