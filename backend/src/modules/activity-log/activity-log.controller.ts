import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityLog } from '../../schemas/activity-log.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/activity-logs')
export class ActivityLogController {
  constructor(
    @InjectModel(ActivityLog.name)
    private readonly activityLogModel: Model<ActivityLog>,
  ) {}

  @Permissions('MANAGE_ROLES')
  @Get()
  async getLogs(
    @Query('limit') limitStr?: string,
    @Query('page') pageStr?: string,
    @Query('action') actionQuery?: string,
    @Query('userId') userIdQuery?: string,
    @Query('method') methodQuery?: string,
    @Query('startDate') startDateQuery?: string,
    @Query('endDate') endDateQuery?: string,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const skip = (page - 1) * limit;

    const query: any = {};

    if (userIdQuery && userIdQuery !== 'ALL') {
      query.userId = userIdQuery;
    }

    if (methodQuery && methodQuery !== 'ALL') {
      if (actionQuery) {
        query.action = { $regex: new RegExp('^' + methodQuery + '.*' + actionQuery, 'i') };
      } else {
        query.action = { $regex: new RegExp('^' + methodQuery, 'i') };
      }
    } else if (actionQuery) {
      query.action = { $regex: new RegExp(actionQuery, 'i') };
    }

    if (startDateQuery || endDateQuery) {
      query.createdAt = {};
      if (startDateQuery) {
        query.createdAt.$gte = new Date(startDateQuery + 'T00:00:00.000Z');
      }
      if (endDateQuery) {
        query.createdAt.$lte = new Date(endDateQuery + 'T23:59:59.999Z');
      }
    }

    const [logs, total] = await Promise.all([
      this.activityLogModel
        .find(query)
        .populate('userId', 'fullName username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.activityLogModel.countDocuments(query).exec(),
    ]);

    return {
      logs,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}
