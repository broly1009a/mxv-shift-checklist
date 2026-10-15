export const FORGOT_PASSWORD_TOKEN_TTL_SECONDS = 15 * 60;
export const FORGOT_PASSWORD_REDIS_PREFIX = 'auth:me:forgot-password';
export const FORGOT_PASSWORD_USERNAME_WAITING_PREFIX = 'auth:me:forgot-password:username-waiting';

export const PUBLIC_TOKEN_RATE_IP_PREFIX = 'pt-rate:ip';
export const PUBLIC_TOKEN_RATE_FP_PREFIX = 'pt-rate:fp';
export const PUBLIC_TOKEN_SESSION_PREFIX = 'pt-session';

export const PUBLIC_TOKEN_RATE_WINDOW_SEC = 60;
export const PUBLIC_TOKEN_RATE_MAX_PER_IP = 30;
export const PUBLIC_TOKEN_RATE_MAX_PER_DEVICE = 10;
export const PUBLIC_TOKEN_TTL_SEC = 300;
