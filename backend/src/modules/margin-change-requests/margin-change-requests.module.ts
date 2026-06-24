import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarginChangeRequest, MarginChangeRequestSchema } from '../../schemas/margin-change-request.schema';
import { MarginChangeRequestsService } from './margin-change-requests.service';
import { MarginChangeRequestsController } from './margin-change-requests.controller';
import { ShiftsModule } from '../shifts/shifts.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarginChangeRequest.name, schema: MarginChangeRequestSchema },
    ]),
    forwardRef(() => ShiftsModule),
    AuthModule,
  ],

  providers: [MarginChangeRequestsService],
  controllers: [MarginChangeRequestsController],
  exports: [MarginChangeRequestsService],
})
export class MarginChangeRequestsModule {}
