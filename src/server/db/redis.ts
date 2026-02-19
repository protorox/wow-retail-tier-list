import IORedis from "ioredis";
import { env } from "@/src/server/config/env";

const globalForRedis = globalThis as unknown as { redis: IORedis | undefined };

export const redis =
  globalForRedis.redis ??
  new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
