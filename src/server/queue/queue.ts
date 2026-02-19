import { Queue } from "bullmq";
import { env } from "@/src/server/config/env";

export const QUEUE_JOB_NAME = "refresh-tier-data";

const redisUrl = new URL(env.REDIS_URL);
const redisDb = redisUrl.pathname ? Number(redisUrl.pathname.replace("/", "")) : 0;

export const queueConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  db: Number.isFinite(redisDb) ? redisDb : 0,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

let refreshQueue: Queue | null = null;

function getRefreshQueue() {
  if (!refreshQueue) {
    refreshQueue = new Queue(env.QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 200,
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 1000
        }
      }
    });
  }

  return refreshQueue;
}

export type RefreshJobPayload = {
  mode?: "MYTHIC_PLUS" | "RAID" | "ALL";
  trigger?: "manual" | "cron" | "interval" | "seed";
};

export async function enqueueRefreshJob(payload: RefreshJobPayload): Promise<void> {
  await getRefreshQueue().add(QUEUE_JOB_NAME, payload, {
    jobId: `${payload.trigger ?? "manual"}-${Date.now()}`
  });
}
