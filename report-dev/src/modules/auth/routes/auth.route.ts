import { Router } from 'express';
import { catchAsync, validateRequest, Identity, requireRole } from '@svl/share';
import { requireAuth } from '../../../middlewares/requireAuth';
import { authRateLimiter } from '../../../middlewares/authRateLimiter';
import { loginDto, verifyPINDto, changePasswordDto, changePINDto, publicTokenDto, forgotPasswordDto, verifyResetTokenDto, resetPasswordByTokenDto } from '../dto';
import {
  login,
  verifyPIN,
  logout,
  changePasswordUser,
  changePINUser,
  resetPasswordUser,
  resetPINUser,
  forgotPassword,
  verifyResetToken,
  resetPasswordByToken,
  getPublicToken
} from '../controllers/auth.controller';



export const authRouter = Router();

authRouter.post('/auth/login', ...catchAsync([authRateLimiter, ...loginDto, validateRequest, login]));
authRouter.post('/auth/verifyPIN/:id', ...catchAsync([authRateLimiter, ...verifyPINDto, validateRequest, verifyPIN]));
authRouter.post('/auth/logout', ...catchAsync([requireAuth, validateRequest, logout]));
authRouter.put('/auth/change-password/:id', ...catchAsync([requireAuth, ...changePasswordDto, validateRequest, changePasswordUser]));
authRouter.put('/auth/reset-password/:id', ...catchAsync([requireAuth, requireRole([Identity.Enums.Permission.PASSWORD_RESET]), validateRequest, resetPasswordUser]));
authRouter.put('/auth/change-pin/:id', ...catchAsync([requireAuth, ...changePINDto, validateRequest, changePINUser]));
authRouter.put('/auth/reset-pin/:id', ...catchAsync([requireAuth, requireRole([Identity.Enums.Permission.PIN_RESET]), validateRequest, resetPINUser]));
authRouter.post('/auth/public-token', ...catchAsync([authRateLimiter, ...publicTokenDto, validateRequest, getPublicToken]));
authRouter.post('/auth/me/forgot-password', ...catchAsync([authRateLimiter, ...forgotPasswordDto, validateRequest, forgotPassword]));
authRouter.post('/auth/me/verify-reset-token', ...catchAsync([authRateLimiter, ...verifyResetTokenDto, validateRequest, verifyResetToken]));
authRouter.post('/auth/me/reset-password', ...catchAsync([authRateLimiter, ...resetPasswordByTokenDto, validateRequest, resetPasswordByToken]));
