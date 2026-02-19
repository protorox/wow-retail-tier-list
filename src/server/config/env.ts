import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgresql://postgres:postgres@localhost:5432/wow_tier_list?schema=public"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  MOCK_MODE: z.string().default("false"),
  RAIDER_IO_BASE_URL: z.string().url().default("https://raider.io"),
  RAIDER_IO_MPLUS_ENDPOINT: z.string().default("/api/v1/mythic-plus/runs"),
  WARCRAFTLOGS_BASE_URL: z.string().url().default("https://www.warcraftlogs.com"),
  WARCRAFTLOGS_CLIENT_ID: z.string().optional(),
  WARCRAFTLOGS_CLIENT_SECRET: z.string().optional(),
  WARCRAFTLOGS_ZONE_ID: z.coerce.number().default(38),
  WARCRAFTLOGS_DIFFICULTY: z.coerce.number().default(5),
  WARCRAFTLOGS_MPLUS_ZONE_ID: z.coerce.number().default(20),
  WARCRAFTLOGS_MPLUS_DIFFICULTY: z.coerce.number().default(10),
  WARCRAFTLOGS_MPLUS_BRACKET: z.coerce.number().default(10),
  WARCRAFTLOGS_MPLUS_PAGES: z.coerce.number().default(12),
  REFRESH_INTERVAL_MINUTES: z.coerce.number().default(30),
  WORKER_MODE: z.enum(["interval", "cron"]).default("interval"),
  QUEUE_NAME: z.string().default("wow-tier-refresh"),
  QUEUE_CONCURRENCY: z.coerce.number().default(2),
  API_CONCURRENCY: z.coerce.number().default(4),
  CRON_SECRET: z.string().min(1).default("replace-me"),
  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(1).default("admin"),
  ENABLE_SEED_ON_START: z.string().default("true")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isMockMode: raw.MOCK_MODE.toLowerCase() === "true",
  shouldSeedOnStart: raw.ENABLE_SEED_ON_START.toLowerCase() === "true"
};
