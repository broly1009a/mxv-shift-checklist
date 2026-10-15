import { logger } from "@/loggers/winstonLogger";
import { kafkaConnector } from "@/events";
import { redisConnector } from "@mss/common";

let registeredServer: any = null;

export const setShutdownServer = (server: any) => {
  registeredServer = server;
};

export const gracefulShutdown = async (signal: string, err?: any) => {
  if (err) {
    logger.error(`[${signal}] Error occurred: ${err.message || err}`, err);
  } else {
    logger.info(`[${signal}] Received shutdown signal. Closing gracefully...`);
  }

  try {
    if (registeredServer) {
      registeredServer.close(() => {
        logger.info("HTTP server closed.");
      });
    }

    try {
      await kafkaConnector.disconnect();
      logger.info("Kafka disconnected gracefully.");
    } catch (e) {
      logger.error("Error disconnecting Kafka", e);
    }

    try {
      await redisConnector.disconnect();
      logger.info("Redis disconnected gracefully.");
    } catch (e) {
      logger.error("Error disconnecting Redis", e);
    }
    
    // Delay 1s để đảm bảo Winston kịp flush toàn bộ log ra console/file trước khi exit
    setTimeout(() => {
      logger.info("Exiting process...");
      process.exit(err ? 1 : 0);
    }, 1000);
  } catch (shutdownErr) {
    logger.error("Error during graceful shutdown", shutdownErr);
    setTimeout(() => {
      process.exit(1);
    }, 1000);
  }
};

export const registerShutdownHandlers = () => {
  process.on("uncaughtException", (err) => gracefulShutdown("uncaughtException", err));
  process.on("unhandledRejection", (reason) => gracefulShutdown("unhandledRejection", reason));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
};
