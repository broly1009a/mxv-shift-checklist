import { startScanPendingLogJob } from "./scan-pending-log.job";

export function startAuditJobs(): void {
  startScanPendingLogJob();
}
