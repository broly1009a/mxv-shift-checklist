import { CronJob } from "cron";
import { redisConnector } from "@mss/common";
import { logger } from "@/loggers/winstonLogger";
import * as auditLogService from "../services/audit-log.service";

const STALE_THRESHOLD_MINUTES = 15;
const LOCK_KEY = "AUDIT:SCAN-PENDING-LOG-LOCK";
const LOCK_TIME_SECONDS = 55;

const job = new CronJob(
  "0 * * * * *",
  async () => {
    await main();
  },
  null,
  false,
  "Asia/Ho_Chi_Minh"
);

const main = async () => {
  let acquired = false;
  try {
    acquired = await lock(LOCK_KEY, LOCK_TIME_SECONDS);
    if (!acquired) {
      return;
    }

    const modifiedCount = await auditLogService.markStalePendingLogs(
      STALE_THRESHOLD_MINUTES
    );
    if (modifiedCount > 0) {
      logger.info(
        `Job quét log PENDING quá hạn: cập nhật ${modifiedCount} log sang SYSTEM_ERROR`
      );
    }
  } catch (error) {
    logger.error(`Job quét log PENDING quá hạn lỗi: ${error}`);
  } finally {
    if (acquired) {
      try {
        await unlock(LOCK_KEY);
      } catch (unlockError) {
        logger.error(`Unlock failed for key ${LOCK_KEY}: ${unlockError}`);
      }
    }
  }
};

const lock = async (key: string, timeSeconds: number): Promise<boolean> => {
  const result = await redisConnector
    .getClient()
    .set(key, "1", "EX", timeSeconds, "NX");
  return result === "OK";
};

const unlock = async (key: string): Promise<void> => {
  await redisConnector.getClient().del(key);
};

export const startScanPendingLogJob = () => {
  job.start();
};
