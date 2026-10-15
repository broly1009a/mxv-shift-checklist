import { Request, Response } from 'express';
import { handlerSuccess, ResApproStatus } from "@svl/share";
import * as authService from "../services/auth.service";

export const login = async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  return handlerSuccess(res, result);
};

export const verifyPIN = async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await authService.verifyPIN(id, req.body);
  return handlerSuccess(res, { ...result, tokenExpiration: result.expiredAt });
};

export const logout = async (req: Request, res: Response) => {
  const result = await authService.logout(req.user);
  return handlerSuccess(res, result);
};

export const changePasswordUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modifier = req.user?.username || req.user?.id || "system";
  await authService.changePasswordUser(id, req.body, modifier);
  return handlerSuccess(res, null, ResApproStatus.NON_APPRO, "Đổi mật khẩu thành công");
};

export const changePINUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  await authService.changePINUser(id, req.body);
  return handlerSuccess(res, null, ResApproStatus.NON_APPRO, "Đổi PIN thành công");
};

export const getPublicToken = async (req: Request, res: Response) => {
  const { fingerprint } = req.body;
  const ip = req.body.ip || (req as any).deviceInfo?.ip || req.ip || "unknown";
  const result = await authService.getPublicToken(fingerprint, ip);
  return handlerSuccess(res, result);
};

export const resetPasswordUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modifier = req.user?.username || req.user?.id || "system";
  const correlationId = (req.headers['correlation_id'] as string) || "unknown";
  const deviceInfo = (req as any).deviceInfo;
  await authService.resetPasswordUser(id, modifier, correlationId, deviceInfo);
  return handlerSuccess(res, null, ResApproStatus.NON_APPRO, "Reset mật khẩu thành công");
};

export const resetPINUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modifier = req.user?.username || req.user?.id || "system";
  const correlationId = (req.headers['correlation_id'] as string) || "unknown";
  const deviceInfo = (req as any).deviceInfo;
  await authService.resetPINUser(id, modifier, correlationId, deviceInfo);
  return handlerSuccess(res, null, ResApproStatus.NON_APPRO, "Reset PIN thành công");
};

export const forgotPassword = async (req: Request, res: Response) => {
  const result = await authService.forgotPassword(req.body);
  return handlerSuccess(res, result);
};

export const verifyResetToken = async (req: Request, res: Response) => {
  const result = await authService.verifyResetToken(req.body.token);
  return handlerSuccess(res, result);
};

export const resetPasswordByToken = async (req: Request, res: Response) => {
  const correlationId = (req.headers['correlation_id'] as string) || "unknown";
  const deviceInfo = (req as any).deviceInfo;
  const result = await authService.resetPasswordByToken(req.body, correlationId, deviceInfo);
  return handlerSuccess(res, result);
};
