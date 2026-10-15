import _ from "lodash";
import jwt from "jsonwebtoken";
import { Password, generateHash, HashAppSignature, generateRandom, SocketMethods, SocketCode } from "@mss/common";
import { authDB, cacheDB } from "../utils/redis.util";
import { Identity, Session, HandlerError, Notification } from "@svl/share";
import { LoginDto, VerifyPINDto, ChangePasswordDto, ChangePINDto, ForgotPasswordDto, ResetPasswordByTokenDto } from "../dto";
import type { NotificationPort, AuditRecorder } from "@/shared";
import { Audit } from "@svl/share";
import { logger } from "@/loggers/winstonLogger";

const noopNotificationPort: NotificationPort = {
  send: async () => undefined
};

const noopAuditRecorder: AuditRecorder = {
  writeLog: async () => undefined,
  updateResult: async () => undefined,
  executeWithAudit: async <T>(_log: any, _owner: string, operation: () => Promise<T>): Promise<T> => {
    return operation();
  }
};

let notificationPort = noopNotificationPort;
let auditRecorder = noopAuditRecorder;

export function setAuthNotificationPort(port?: NotificationPort) {
  notificationPort = port || noopNotificationPort;
}

export function setAuthAuditRecorder(recorder?: AuditRecorder) {
  auditRecorder = recorder || noopAuditRecorder;
}

async function safeSendNotification(data: Notification.Events.NotificationRequestedData): Promise<void> {
  try {
    await notificationPort.send(data);
  } catch (error) {
    // catch all errors to avoid failing the business flow
  }
}

import {
  PUBLIC_TOKEN_RATE_IP_PREFIX,
  PUBLIC_TOKEN_RATE_FP_PREFIX,
  PUBLIC_TOKEN_SESSION_PREFIX,
  PUBLIC_TOKEN_RATE_WINDOW_SEC,
  PUBLIC_TOKEN_RATE_MAX_PER_IP,
  PUBLIC_TOKEN_RATE_MAX_PER_DEVICE,
  PUBLIC_TOKEN_TTL_SEC,
  FORGOT_PASSWORD_TOKEN_TTL_SECONDS,
  FORGOT_PASSWORD_REDIS_PREFIX,
  FORGOT_PASSWORD_USERNAME_WAITING_PREFIX
} from "../constants/forgotPassword";
import GroupRoleModel from "../models/groupRole.model";
import UserModel from "../models/user.model";

export async function login(body: LoginDto) {
  const { username, password } = body;

  const user = await UserModel.findOne({
    username,
    status: Identity.Enums.UserStatus.ACTIVE,
  }).populate("department", "status");

  if (!user) {
    throw new HandlerError(`Sai tên đăng nhập hoặc mật khẩu`);
  }

  if (user.numLoginFail >= 5) {
    throw new HandlerError(
      "Đăng nhập sai quá nhiều lần. Vui lòng liên hệ User để làm mới Mật khẩu/Mã PIN"
    );
  }

  const passwordsMatch = await Password.compare(user.password, password);
  if (!passwordsMatch) {
    user.numLoginFail += 1;
    await user.save();
    throw new HandlerError(`Sai tên đăng nhập hoặc mật khẩu`);
  }

  const groupRoles = await GroupRoleModel.find({
    status: Identity.Enums.GroupRoleStatus.ACTIVE,
    _id: { $in: user.groupRole },
  }).lean();

  let roles = groupRoles.reduce((accumulator: string[], groupRole) => {
    accumulator.push(...groupRole.role);
    return accumulator;
  }, []);
  roles.push(...user.role);
  roles = roles.filter((value, index, array) => array.indexOf(value) === index);

  let userRoles = roles;

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: generateHash(32),
    title: `Đăng nhập user ${user.username}`,
    content: `Đăng nhập hệ thống`,
    action: Audit.Enums.AuditAction.LOGIN,
    time: new Date().toISOString(),
    attach_data: {
      raw: { userId: user._id.toString(), username: user.username },
      metadata: {}
    }
  };

  return auditRecorder.executeWithAudit(
    auditLog,
    user._id.toString(),
    async () => {
      let cacheUser: any = await authDB.get(`session-${user._id}`);
      if (cacheUser && cacheUser.session) {
        cacheUser.session = generateHash(12);
      } else {
        cacheUser = {
          session: generateHash(12),
        };
      }
      const loginTime = new Date().getTime();

      const userJwt = jwt.sign(
        {
          id: user._id,
          username: user.username,
          email: user.email,
          session: cacheUser.session,
          verifyPIN: false,
          type: user.type,
        },
        process.env.JWT_KEY as string
      );

      await authDB.set(`session-${user._id}`, {
        id: user._id,
        username: user.username,
        email: user.email,
        session: cacheUser.session,
        userRoles,
        loginTime,
        type: user.type,
      });

      await user.save();
      return {
        id: user._id,
        username: user.username,
        email: user.email,
        userRoles: userRoles,
        data: userJwt,
      };
    },
    Audit.Enums.AuditCreatedBy.USER
  );
}

export async function verifyPIN(id: string, body: VerifyPINDto) {
  const { PIN } = body;
  const user = await UserModel.findById(id).populate("department", "code");
  if (!user) {
    throw new HandlerError(`Tài khoản ${id} không tồn tại`);
  }

  if (user.numLoginFail >= 5) {
    throw new HandlerError(
      "Đăng nhập sai quá nhiều lần. Vui lòng liên hệ User để làm mới Mật khẩu/Mã PIN"
    );
  }

  const pinMatched = await Password.compare(user.PIN, PIN);
  if (!pinMatched) {
    user.numLoginFail += 1;
    await user.save();
    throw new HandlerError(`Mã PIN không chính xác`);
  }

  const cacheUser = await authDB.get<any>(`session-${user._id}`);
  if (!cacheUser || !cacheUser.loginTime || !cacheUser.session) {
    throw new HandlerError("Phiên đăng nhập hết hạn. Vui lòng thử lại");
  }

  if (Date.now() - cacheUser.loginTime > 2 * 60 * 1000) {
    user.numLoginFail += 1;
    await user.save();
    throw new HandlerError("Phiên đăng nhập hết hạn. Vui lòng thử lại");
  }

  const userJwt = jwt.sign(
    {
      id: user._id,
      username: user.username,
      email: user.email,
      session: cacheUser.session,
      verifyPIN: true,
      type: user.type,
      departmentCode: (user.department as any)?.code,
    },
    process.env.JWT_KEY as string
  );

  user.lastLoginAt = cacheUser.loginTime;
  user.numLoginFail = 0;
  await user.save();

  const groupRoles = await GroupRoleModel.find({
    status: Identity.Enums.GroupRoleStatus.ACTIVE,
    _id: { $in: user.groupRole },
  }).lean();

  let roles = groupRoles.reduce((accumulator: string[], groupRole) => {
    accumulator.push(...groupRole.role);
    return accumulator;
  }, []);
  roles.push(...user.role);
  roles = roles.filter((value, index, array) => array.indexOf(value) === index);

  const now = new Date();
  const tokenExpiration = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1
  );

  return {
    id: user._id,
    username: user.username,
    email: user.email,
    userRoles: roles,
    data: userJwt,
    changePassword: user.requireChangePassword,
    departmentCode: (user.department as any)?.code,
    type: user.type,
    expiredAt: tokenExpiration.getTime(),
  };
}

export async function logout(currentUser: any) {
  if (currentUser) {
    const { id, email, platform } = currentUser;
    await Session.userSession.clearLoginSession(id, platform);
    return {
      id: id,
      email: email,
    };
  }
  return null;
}

export async function changePasswordUser(id: string, updateDto: ChangePasswordDto, modifier: string) {
  const { newPassword, oldPassword } = updateDto;
  const user = await UserModel.findById(id);
  if (!user) {
    throw new HandlerError(`Người dùng ${id} không tồn tại`);
  }

  const passwordsMatch = await Password.compare(user.password, oldPassword);
  if (!passwordsMatch) {
    throw new HandlerError(`Mật khẩu không chính xác`);
  }

  if (newPassword === oldPassword) {
    throw new HandlerError(`Mật khẩu mới trùng mật khẩu cũ`);
  }

  user.password = newPassword;
  user.requireChangePassword = false;
  user.lastModifiedBy = modifier;
  await user.save();

  await Session.userSession.clearAllLoginSessions(user._id.toString());

  await safeSendNotification({
    channels: [Notification.Enums.NotificationChannel.WS],
    recipients: [{ userId: user._id.toString() }],
    channelOptions: { ws: { event: SocketMethods.AUTH } },
    message: "Phiên đăng nhập đã hết hạn hoặc tài khoản bị thay đổi thông tin",
    metadata: { code: SocketCode.UNAUTHORIZED }
  });

  return user;
}

export async function changePINUser(id: string, dto: ChangePINDto) {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new HandlerError(`Người dùng ${id} không tồn tại`);
  }

  const passwordsMatch = await Password.compare(user.password, dto.password);
  if (!passwordsMatch) {
    throw new HandlerError(`Mật khẩu không chính xác`);
  }

  user.PIN = dto.newPIN;
  await user.save();

  await Session.userSession.clearAllLoginSessions(user._id.toString());

  await safeSendNotification({
    channels: [Notification.Enums.NotificationChannel.WS],
    recipients: [{ userId: user._id.toString() }],
    channelOptions: { ws: { event: SocketMethods.AUTH } },
    message: "Phiên đăng nhập đã hết hạn hoặc tài khoản bị thay đổi thông tin",
    metadata: { code: SocketCode.UNAUTHORIZED }
  });

  return user;
}

export async function getPublicToken(fingerprint: string, ip: string) {
  if (!fingerprint) throw new HandlerError("Missing fingerprint");

  const fpHash = HashAppSignature(process.env.JWT_KEY as string, fingerprint);

  const ipRateKey = `${PUBLIC_TOKEN_RATE_IP_PREFIX}:${ip}`;
  const ipCount = await cacheDB.incrWithExpire(
    ipRateKey,
    PUBLIC_TOKEN_RATE_WINDOW_SEC
  );
  if (ipCount > PUBLIC_TOKEN_RATE_MAX_PER_IP) {
    throw new HandlerError("Too many requests. Please try again later.");
  }

  const fpRateKey = `${PUBLIC_TOKEN_RATE_FP_PREFIX}:${ip}:${fpHash}`;
  const fpCount = await cacheDB.incrWithExpire(
    fpRateKey,
    PUBLIC_TOKEN_RATE_WINDOW_SEC
  );
  if (fpCount > PUBLIC_TOKEN_RATE_MAX_PER_DEVICE) {
    throw new HandlerError("Too many requests. Please try again later.");
  }

  const token = jwt.sign(
    { type: "public", fp: fpHash },
    process.env.JWT_KEY as string,
    { expiresIn: `${PUBLIC_TOKEN_TTL_SEC}s` }
  );

  const sessionKey = `${PUBLIC_TOKEN_SESSION_PREFIX}:${fpHash}`;
  await cacheDB.set(sessionKey, "1");
  await cacheDB.refreshTTL(sessionKey, PUBLIC_TOKEN_TTL_SEC);

  return token;
}

export async function resetPasswordUser(id: string, modifier: string, correlationId: string, deviceInfo?: any) {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new HandlerError(`Người dùng ${id} không tồn tại`);
  }

  const password = generateRandom(12);

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: correlationId,
    title: `Reset mật khẩu user ${user.username}`,
    content: `Reset mật khẩu cho user ${user.username} (${user.email})`,
    action: Audit.Enums.AuditAction.UPDATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { userId: user._id.toString(), username: user.username },
      metadata: {}
    }
  };

  try {
    const result = await auditRecorder.executeWithAudit(
      auditLog,
      modifier,
      async () => {
        user.password = password;
        user.requireChangePassword = true;
        user.numLoginFail = 0;
        await user.save();

        await Session.userSession.clearAllLoginSessions(user._id.toString());

        await safeSendNotification({
          channels: [Notification.Enums.NotificationChannel.WS],
          recipients: [{ userId: user._id.toString() }],
          channelOptions: { ws: { event: SocketMethods.AUTH } },
          message: "Phiên đăng nhập đã hết hạn hoặc tài khoản bị thay đổi thông tin",
          metadata: { code: SocketCode.UNAUTHORIZED }
        });

        await safeSendNotification({
          channels: [Notification.Enums.NotificationChannel.MAIL],
          recipients: [{ email: user.email }],
          subject: `Market Surveillance System - Thông báo thay đổi thành công mật khẩu user đăng nhập`,
          html: `
          <p>Chào bạn,</p>
          <p>Bạn nhận được thư này từ hệ thống gửi thư tự động của Market Surveillance System.<br>Thư xác nhận về việc bạn thay đổi mật khẩu user đăng nhập thành công trên Market Surveillance System.<br>Tên đăng nhập: ${user.username}<br>Mật khẩu truy cập mới: ${password}</p>
        `
        });

        return user;
      },
      Audit.Enums.AuditCreatedBy.USER
    );
    return result;
  } catch (error) {
    logger.error(`resetPasswordUser audit failed for user ${id}: ${error}`);
    throw error;
  }
}

export async function resetPINUser(id: string, modifier: string, correlationId: string, deviceInfo?: any) {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new HandlerError(`Người dùng ${id} không tồn tại`);
  }

  const PIN = _.random(100000, 999999, false).toString();

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: correlationId,
    title: `Reset mã PIN user ${user.username}`,
    content: `Reset mã PIN cho user ${user.username} (${user.email})`,
    action: Audit.Enums.AuditAction.UPDATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { userId: user._id.toString(), username: user.username },
      metadata: {}
    }
  };

  try {
    const result = await auditRecorder.executeWithAudit(
      auditLog,
      modifier,
      async () => {
        user.PIN = PIN;
        user.numLoginFail = 0;
        await user.save();

        await Session.userSession.clearAllLoginSessions(user._id.toString());

        await safeSendNotification({
          channels: [Notification.Enums.NotificationChannel.WS],
          recipients: [{ userId: user._id.toString() }],
          channelOptions: { ws: { event: SocketMethods.AUTH } },
          message: "Phiên đăng nhập đã hết hạn hoặc tài khoản bị thay đổi thông tin",
          metadata: { code: SocketCode.UNAUTHORIZED }
        });

        await safeSendNotification({
          channels: [Notification.Enums.NotificationChannel.MAIL],
          recipients: [{ email: user.email }],
          subject: `Market Surveillance System - Thông báo thay đổi thành công mã PIN user đăng nhập`,
          html: `
          <p>Chào bạn,</p>
          <p>Bạn nhận được thư này từ hệ thống gửi thư tự động của Market Surveillance System.<br>Thư xác nhận về việc bạn thay đổi mã PIN của user đăng nhập thành công trên Market Surveillance System.<br>Tên đăng nhập: ${user.username}<br>Mã PIN mới: ${PIN}</p>
        `
        });

        return user;
      },
      Audit.Enums.AuditCreatedBy.USER
    );
    return result;
  } catch (error) {
    logger.error(`resetPINUser audit failed for user ${id}: ${error}`);
    throw error;
  }
}

export async function forgotPassword(body: ForgotPasswordDto) {
  const { username } = body;
  const textReturn = "Nếu tài khoản tồn tại, bạn sẽ nhận được email hướng dẫn đặt lại mật khẩu";

  const redisKeyUsername = `${FORGOT_PASSWORD_USERNAME_WAITING_PREFIX}-${username}`;
  const usernameWaiting = await authDB.get<{ userId: string; username: string }>(redisKeyUsername);
  if (usernameWaiting?.userId) {
    return { message: textReturn };
  }

  const user = await UserModel.findOne({
    username,
    status: Identity.Enums.UserStatus.ACTIVE,
  });

  if (!user) {
    return { message: textReturn };
  }

  const token = generateHash(32);
  const redisKey = `${FORGOT_PASSWORD_REDIS_PREFIX}-${token}`;

  const value = {
    userId: user._id.toString(),
    username: user.username,
  };

  await authDB.setDebounce(
    redisKey,
    value,
    FORGOT_PASSWORD_TOKEN_TTL_SECONDS
  );

  await authDB.setDebounce(
    redisKeyUsername,
    value,
    FORGOT_PASSWORD_TOKEN_TTL_SECONDS
  );

  const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await safeSendNotification({
    channels: [Notification.Enums.NotificationChannel.MAIL],
    recipients: [{ email: user.email }],
    subject: `Market Surveillance System - Yêu cầu đặt lại mật khẩu`,
    html: `
          <p>Chào bạn,</p>
          <p>Bạn nhận được thư này từ hệ thống gửi thư tự động của Market Surveillance System.<br>
          Hệ thống nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn trên hệ thống Market Surveillance System.</p>
          <p>Vui lòng click vào nút bên dưới để tiến hành đặt lại mật khẩu. Liên kết này sẽ hết hạn sau ${FORGOT_PASSWORD_TOKEN_TTL_SECONDS / 60} phút.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="display: inline-block; background-color: #004d99; color: #ffffff; font-weight: bold; padding: 12px 24px; border-radius: 4px; text-decoration: none;">
              ĐẶT LẠI MẬT KHẨU
            </a>
          </div>
          <p>Nếu nút trên không hoạt động, vui lòng sao chép và dán liên kết sau vào trình duyệt của bạn:<br/>
          <a href="${resetLink}">${resetLink}</a></p>
          <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.</p>
          <p>Lưu ý: Đây là thư gửi tự động từ hệ thống, vui lòng không trả lời thư này.<br>Trân trọng,<br>MXV</p>
        `
  });

  return { message: textReturn };
}

export async function verifyResetToken(token: string) {
  const redisKey = `${FORGOT_PASSWORD_REDIS_PREFIX}-${token}`;
  const tokenData = await authDB.get<{ userId: string; username: string }>(redisKey);

  if (!tokenData?.userId) {
    throw new HandlerError("Liên kết không hợp lệ hoặc đã hết hạn");
  }

  return { valid: true };
}

export async function resetPasswordByToken(body: ResetPasswordByTokenDto, correlationId?: string, deviceInfo?: any) {
  const { token, newPassword } = body;
  const redisKey = `${FORGOT_PASSWORD_REDIS_PREFIX}-${token}`;

  const tokenData = await authDB.get<{ userId: string; username: string }>(redisKey);
  if (!tokenData?.userId) {
    throw new HandlerError("Liên kết không hợp lệ hoặc đã hết hạn");
  }

  const { userId } = tokenData;
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new HandlerError("Người dùng không tồn tại");
  }

  const cid = correlationId || generateHash(32);
  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: cid,
    title: `Đặt lại mật khẩu user ${user.username}`,
    content: `Đặt lại mật khẩu cho user ${user.username} (${user.email}) thông qua liên kết`,
    action: Audit.Enums.AuditAction.UPDATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { userId: user._id.toString(), username: user.username },
      metadata: {}
    }
  };

  try {
    await auditRecorder.executeWithAudit(
      auditLog,
      user._id.toString(),
      async () => {
        user.password = newPassword;
        user.requireChangePassword = false;
        user.numLoginFail = 0;
        await user.save();

        await Session.userSession.clearAllLoginSessions(user._id.toString());

        await safeSendNotification({
          channels: [Notification.Enums.NotificationChannel.WS],
          recipients: [{ userId: user._id.toString() }],
          channelOptions: { ws: { event: SocketMethods.AUTH } },
          message: "Phiên đăng nhập đã hết hạn hoặc tài khoản bị thay đổi thông tin",
          metadata: { code: SocketCode.UNAUTHORIZED }
        });

        await safeSendNotification({
          channels: [Notification.Enums.NotificationChannel.MAIL],
          recipients: [{ email: user.email }],
          subject: `Market Surveillance System - Thông báo đặt lại mật khẩu thành công`,
          html: `
            <p>Chào bạn,</p>
            <p>Bạn nhận được thư này từ hệ thống gửi thư tự động của Market Surveillance System.<br>
            Thư xác nhận về việc bạn đã đặt lại mật khẩu đăng nhập thành công trên Market Surveillance System.</p>
          `
        });

        return null;
      },
      Audit.Enums.AuditCreatedBy.USER
    );
  } catch (error) {
    logger.error(`resetPasswordByToken audit failed for user ${userId}: ${error}`);
    throw error;
  }

  await authDB.del(redisKey);

  const redisKeyUsername = `${FORGOT_PASSWORD_USERNAME_WAITING_PREFIX}-${user.username}`;
  await authDB.del(redisKeyUsername);

  return null;
}
