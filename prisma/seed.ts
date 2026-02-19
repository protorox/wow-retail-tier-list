import "dotenv/config";
import { ensureAppConfig } from "@/src/server/config/store";
import { runRefresh } from "@/src/server/jobs/refresh";
import { prisma } from "@/src/server/db/prisma";
import { redis } from "@/src/server/db/redis";
import { logger } from "@/src/server/logger";

async function main() {
  await ensureAppConfig();
  const result = await runRefresh({ mode: "ALL", trigger: "seed" });
  logger.info({ updated: result.updated }, "Seed completed");
}

void main()
  .catch((error) => {
    logger.error({ error }, "Seed failed");
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await redis.quit();
  });
