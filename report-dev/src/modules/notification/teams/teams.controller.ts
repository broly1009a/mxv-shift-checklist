import { Request, Response } from "express";
import { QueryBuilder } from "@mss/common";
import { handlerSuccess } from "@svl/share";
import * as teamsService from "./teams.service";

export const getHistory = async (req: Request, res: Response) => {
  const query = QueryBuilder.build(req.query);
  const list = await teamsService.getHistory(query);
  return handlerSuccess(res, list);
};
