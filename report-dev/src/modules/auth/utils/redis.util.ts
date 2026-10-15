import { redisConnector } from "@mss/common";

class RedisAdapter {
  constructor(private namespace: string) {}

  private getKey(key: string): string {
    return `${this.namespace}${key}`;
  }

  async get<T = any>(key: string): Promise<T | null> {
    const val = await redisConnector.getClient().get(this.getKey(key));
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch (e) {
      return val as any;
    }
  }

  async set(key: string, value: any): Promise<void> {
    const val = typeof value === "string" ? value : JSON.stringify(value);
    await redisConnector.getClient().set(this.getKey(key), val);
  }

  async setDebounce(key: string, value: any, ttl: number): Promise<void> {
    const val = typeof value === "string" ? value : JSON.stringify(value);
    await redisConnector.getClient().set(this.getKey(key), val, "EX", ttl);
  }

  async del(key: string): Promise<void> {
    await redisConnector.getClient().del(this.getKey(key));
  }

  async scanAllKeys(pattern: string): Promise<string[]> {
    const client = redisConnector.getClient();
    let cursor = "0";
    const keys: string[] = [];
    const searchPattern = `${this.namespace}*${pattern}*`;
    do {
      const res = await client.scan(cursor, "MATCH", searchPattern, "COUNT", 100);
      cursor = res[0];
      const rawKeys = res[1].map((k: string) => k.replace(new RegExp(`^${this.namespace}`), ""));
      keys.push(...rawKeys);
    } while (cursor !== "0");
    return keys;
  }

  async incrWithExpire(key: string, ttlSeconds: number): Promise<number> {
    const client = redisConnector.getClient();
    const actualKey = this.getKey(key);
    const multi = client.multi();
    multi.incr(actualKey);
    multi.expire(actualKey, ttlSeconds);
    const results = await multi.exec();
    return results ? (results[0][1] as number) : 0;
  }

  async refreshTTL(key: string, ttlSeconds: number): Promise<void> {
    await redisConnector.getClient().expire(this.getKey(key), ttlSeconds);
  }
}

export const authDB = new RedisAdapter("auth:");
export const cacheDB = new RedisAdapter("cache:");
