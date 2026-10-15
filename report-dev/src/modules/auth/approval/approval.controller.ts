import { Request, Response } from "express";
import { handlerSuccess } from "@svl/share";
import * as approvalService from "./approval.service";
import { QueryBuilder } from "@mss/common";

export const createApproval = async (req: Request, res: Response) => {
  const approval = await approvalService.createApproval(req.body);
  return handlerSuccess(res, approval);
};

export const listApproval = async (req: Request, res: Response) => {
  const query = QueryBuilder.build(req.method === "POST" ? req.body : req.query);
  const list = await approvalService.listApproval(query);
  return handlerSuccess(res, list);
};

export const getApproval = async (req: Request, res: Response) => {
  const { id } = req.params;
  const approval = await approvalService.getApproval(id);
  return handlerSuccess(res, approval);
};

export const updateApproval = async (req: Request, res: Response) => {
  const { id } = req.params;
  const lastModifiedBy = req.body.lastModifiedBy;
  const approval = await approvalService.updateApproval(
    id,
    req.body,
    lastModifiedBy?.toString()
  );
  return handlerSuccess(res, approval);
};
