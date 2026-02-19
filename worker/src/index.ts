import "dotenv/config";
import { Worker, QueueEvents } from "bullmq";
import { env } from "@/src/server/config/env";
import { logger } from "@/src/server/logger";
import { runRefresh } from "@/src/server/jobs/refresh";
import { QUEUE_JOB_NAME, enqueueRefreshJob, queueConnection } from "@/src/server/queue/queue";
import { prisma } from "@/src/server/db/prisma";

let intervalHandle: NodeJS.Timeout | null = null;

async function bootstrapSeed(): Promise<boolean> {
  if (!env.shouldSeedOnStart) return false;

  const existingSnapshots = await prisma.snapshot.count();
  if (existingSnapshots > 0) {
    logger.info({ existingSnapshots }, "Skipping seed refresh; snapshots already exist");
    return false;
  }

  logger.info("No snapshots found; running seed refresh immediately");
  await runRefresh({
    mode: "ALL",
    trigger: "seed"
  });
  logger.info("Seed refresh completed on startup");
  return true;
}

async function main() {
  logger.info({ workerMode: env.WORKER_MODE }, "Starting worker");

  const worker = new Worker(
    env.QUEUE_NAME,
    async (job) => {
      if (job.name !== QUEUE_JOB_NAME) {
        logger.warn({ jobName: job.name }, "Skipping unknown job");
        return;
      }

      const mode = job.data?.mode ?? "ALL";
      const trigger = job.data?.trigger ?? "manual";

      logger.info({ jobId: job.id, mode, trigger }, "Processing refresh job");
      await runRefresh({ mode, trigger });
    },
    {
      connection: queueConnection,
      concurrency: env.QUEUE_CONCURRENCY
    }
  );

  const queueEvents = new QueueEvents(env.QUEUE_NAME, {
    connection: queueConnection
  });

  queueEvents.on("completed", ({ jobId }) => {
    logger.info({ jobId }, "Job completed");
  });

  queueEvents.on("failed", ({ jobId, failedReason }) => {
    logger.error({ jobId, failedReason }, "Job failed");
  });

  const seeded = await bootstrapSeed();

  if (env.WORKER_MODE === "interval") {
    const intervalMs = env.REFRESH_INTERVAL_MINUTES * 60_000;

    if (!seeded) {
      await enqueueRefreshJob({ mode: "ALL", trigger: "interval" });
    }

    intervalHandle = setInterval(() => {
      void enqueueRefreshJob({ mode: "ALL", trigger: "interval" }).catch((error) => {
        logger.error({ error }, "Failed to enqueue interval refresh job");
      });
    }, intervalMs);

    logger.info({ intervalMs }, "Interval scheduler enabled");
  } else {
    logger.info("Cron mode enabled; expecting external trigger via protected API endpoint");
  }

  const shutdown = async () => {
    logger.info("Shutting down worker");
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }

    await worker.close();
    await queueEvents.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

void main().catch((error) => {
  logger.error({ error }, "Worker startup failed");
  process.exit(1);
});
