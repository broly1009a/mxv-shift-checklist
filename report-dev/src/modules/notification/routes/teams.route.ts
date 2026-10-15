import { Router } from "express";
import { catchAsync } from "@svl/share";
import { requireAuth } from "../../../middlewares/requireAuth";
import * as teamsController from "../teams/teams.controller";

export const teamsRouter = Router();

teamsRouter.get(
  "/teams/history",
  ...catchAsync([
    requireAuth,
    teamsController.getHistory,
  ])
);
