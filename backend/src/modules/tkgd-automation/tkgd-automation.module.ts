import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TkgdAutomationController } from './tkgd-automation.controller';
import { TkgdAutomationService } from './tkgd-automation.service';
import { TkgdDevRemediationService } from './services/tkgd-dev-remediation.service';
import { TkgdUserConfig, TkgdUserConfigSchema } from '../../schemas/tkgd-user-config.schema';
import { RawAccountMail, RawAccountMailSchema } from '../../schemas/raw-account-mail.schema';
import { CleanAccountRecord, CleanAccountRecordSchema } from '../../schemas/clean-account-record.schema';
import { TkgdActivityLog, TkgdActivityLogSchema } from '../../schemas/tkgd-activity-log.schema';
import { SystemSettingsModule } from '../system-settings/system-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TkgdUserConfig.name, schema: TkgdUserConfigSchema },
      { name: RawAccountMail.name, schema: RawAccountMailSchema },
      { name: CleanAccountRecord.name, schema: CleanAccountRecordSchema },
      { name: TkgdActivityLog.name, schema: TkgdActivityLogSchema },
    ]),
  ],
  controllers: [TkgdAutomationController],
  providers: [TkgdAutomationService, TkgdDevRemediationService],
  exports: [TkgdAutomationService, TkgdDevRemediationService],
})
export class TkgdAutomationModule {}
