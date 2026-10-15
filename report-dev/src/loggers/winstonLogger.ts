import { Logger } from "@mss/common";

export const logger = new Logger(
  process.env.SERVICE_NAME,
  process.env.NODE_ENV,
  process.env.LOKI_HOST
);
