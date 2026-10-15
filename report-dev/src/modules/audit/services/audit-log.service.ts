import { AuditLogModel } from "../models/audit-log.model";
import { Audit, HandlerError } from "@svl/share";
import { GetAuditLogsDto } from "../dto/audit-log.dto";
import dayjs from "dayjs";

/**
 * Retries the MongoDB operation once on duplicate key errors (code 11000).
 * Prevents race condition exceptions when concurrent updates perform a findAndModify/updateOne with upsert.
 */
const upsertRetryOnDup = async <T>(op: () => Promise<T>): Promise<T> => {
  try {
    return await op();
  } catch (error: any) {
    if (error?.code === 11000) {
      return await op();
    }
    throw error;
  }
};

/**
 * Idempotently writes audit logs. Using upsert based on correlation_id,
 * it fills missing info if an updateLog arrived earlier and created a stub,
 * and sets status to PENDING only on insert.
 */
export const writeLog = async (message: Audit.Events.AuditLogMessage, sender?: string) => {
  await upsertRetryOnDup(() =>
    AuditLogModel.updateOne(
      {
        correlation_id: message.correlation_id,
      },
      {
        $set: {
          sender,
          owner: message.owner,
          time: new Date(message.time),
          title: message.title,
          content: message.content,
          attach_data: message.attach_data,
          ip: message.ip,
          device: message.device,
          client: message.client,
          os: message.os,
          action: message.action,
          created_by: message.created_by,
          member_id: message.member_id,
          account_id: message.account_id,
          broker_id: message.broker_id,
        },
        $setOnInsert: {
          status: Audit.Enums.AuditStatus.PENDING,
        },
      },
      { upsert: true }
    )
  );
};

/**
 * Updates status of an audit log. Generates a stub with status and time
 * if writeLog has not arrived yet.
 */
export const updateLog = async (message: Audit.Events.UpdateResultAuditLogMessage) => {
  return await upsertRetryOnDup(() =>
    AuditLogModel.updateOne(
      {
        correlation_id: message.correlation_id,
      },
      {
        $set: {
          status: message.status,
        },
        $setOnInsert: {
          time: new Date(),
        },
      },
      { upsert: true }
    )
  );
};

export const getAuditLogs = async (input: GetAuditLogsDto) => {
  const { keyword, user_id, action, start_time, end_time } = input;
  const page = Number(input.page) || 1;
  const limit = Number(input.limit) || 20;

  const timeCondition = {
    ...(start_time ? { $gte: new Date(start_time) } : {}),
    ...(end_time ? { $lte: new Date(end_time) } : {}),
  };

  const match: any = {
    ...(keyword ? { $text: { $search: keyword } } : {}),
    ...(user_id ? { owner: user_id } : {}),
    ...(action !== undefined ? { action } : {}),
    ...(Object.keys(timeCondition).length > 0 ? { time: timeCondition } : {}),
  };

  const [data, total] = await Promise.all([
    AuditLogModel.aggregate([
      {
        $match: match,
      },
      { $sort: { time: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          audit_log_id: "$_id",
          correlation_id: 1,
          owner: 1,
          title: 1,
          content: 1,
          time: 1,
          action: 1,
          ip: 1,
          device: 1,
          client: 1,
          os: 1,
          status: 1,
          member_id: 1,
          account_id: 1,
          broker_id: 1,
          sender: 1,
          created_at: 1,
        },
      },
    ]),
    AuditLogModel.countDocuments(match),
  ]);

  const totalPage = Math.ceil(total / limit);

  return {
    total,
    rowCount: total,
    totalPage,
    data,
  };
};

export const getAuditLogDetail = async (auditLogId: string) => {
  const auditLog = await AuditLogModel.findById(auditLogId);
  if (!auditLog) {
    throw new HandlerError(`Audit log không tồn tại`);
  }
  return auditLog.toJSON();
};

export const markStalePendingLogs = async (olderThanMinutes: number) => {
  const result = await AuditLogModel.updateMany(
    {
      status: Audit.Enums.AuditStatus.PENDING,
      time: { $lte: dayjs().subtract(olderThanMinutes, "minute").toDate() },
    },
    {
      status: Audit.Enums.AuditStatus.SYSTEM_ERROR,
    }
  );
  return result.modifiedCount;
};
