export const REDIS_KEYS = {
  LAYOUT: (userId: string) => `layout-${userId}`,
  AUDIT_TAG: (userId: string) => `audit-tag:${userId}`
};
