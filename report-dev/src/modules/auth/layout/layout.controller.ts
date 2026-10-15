import { Request, Response } from "express";
import { handlerSuccess } from "@svl/share";
import * as layoutService from "./layout.service";

export const setLayout = async (req: Request, res: Response) => {
  const layout = await layoutService.setLayout({
    user: req.user?.id,
    value: req.body.value,
    default: req.body.default,
  });

  return handlerSuccess(res, layout);
};

export const getLayout = async (req: Request, res: Response) => {
  let layout = await layoutService.getLayout(req.user.id);

  if (!layout) {
    layout = {};
  }

  return handlerSuccess(res, layout);
};
