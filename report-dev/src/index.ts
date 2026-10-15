import * as dotenv from "dotenv";
const env = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${env.trim()}` });
import "./alias";
import { redisConnector } from "@mss/common";
import { kafkaConnector } from "@/events";
import { logger } from "@/loggers/winstonLogger";
import { app } from "@/app";
import { initAuthSeed } from "./modules/auth/initialize/initialize.service";
import { mongoConnector } from "@/mongo/mongoConnector";
import { startAuditJobs } from "./modules/audit";
import { createMonolithComposition } from "./bootstrap";
import { attachNotificationWs } from "./modules/notification";
import { gracefulShutdown, registerShutdownHandlers, setShutdownServer } from "@/utils/shutdown";

// Đăng ký bắt lỗi global ngay từ khi app mới bật
registerShutdownHandlers();

const start = async () => {
  logger.info(`Starting ${process.env.SERVICE_NAME} '${env.trim()}'...`);

  if (!process.env.JWT_KEY) {
    logger.error("JWT_KEY must be defined");
    throw new Error("JWT_KEY must be defined");
  }

  if (!process.env.MONGO_URI) {
    logger.error("MONGO_URI must be defined");
    throw new Error("MONGO_URI must be defined");
  }
  if (!process.env.KAFKA_BROKERS) {
    logger.error("KAFKA_BROKERS must be defined");
    throw new Error("KAFKA_BROKERS must be defined");
  }

  try {
    const redisUrl = new URL(process.env.REDIS_URL as string);
    if (process.env.REDIS_PASS) {
      redisUrl.password = process.env.REDIS_PASS;
    }
    redisConnector.connect(redisUrl.toString());
    kafkaConnector.connect(process.env.KAFKA_BROKERS.split(";"));

    await mongoConnector.db.asPromise();
    logger.info("Mongo connection is ready.");
    await initAuthSeed();
    startAuditJobs();

    const monolith = createMonolithComposition();

    const server = app.listen(process.env.SERVICE_PORT || 3020, () => {
      logger.info(`Listening on port ${process.env.SERVICE_PORT}!!!!!!!!`);
    });
    attachNotificationWs(server);

    setShutdownServer(server);
  } catch (err) {
    gracefulShutdown("startup_failure", err);
  }
};

start();
