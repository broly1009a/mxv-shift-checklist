import "./alias";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { handlerNotFoundError, user } from "@svl/share";
import { registerAuth } from "@/modules/auth";
import { registerAudit } from "@/modules/audit";
import { registerNotification } from "@/modules/notification";

import { correlationId, deviceInfo } from "./middlewares";


const app = express();
app.set("trust proxy", true);

// Cross-cutting context middlewares must run before any routes
app.use(correlationId);
app.use(deviceInfo);
app.use(express.json());

app.use(cors({ origin: true, credentials: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(user);
app.use(helmet());

// route
registerAuth(app);
registerAudit(app);
registerNotification(app);

app.all("*", async (req, res) => {
  return handlerNotFoundError(res, "Not found");
});

export { app };
