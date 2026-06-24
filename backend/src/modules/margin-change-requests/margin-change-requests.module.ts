import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarginChangeRequest, MarginChangeRequestSchema } from '../../schemas/margin-change-request.schema';
import { MarginChangeRequestsService } from './margin-change-requests.service';
import { MarginChangeRequestsController } from './margin-change-requests.controller';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MarginChangeRequest.name, schema: MarginChangeRequestSchema },
    ]),
    forwardRef(() => ShiftsModule),
  ],
  providers: [MarginChangeRequestsService],
  controllers: [MarginChangeRequestsController],
  exports: [MarginChangeRequestsService],
})
export class MarginChangeRequestsModule {}
