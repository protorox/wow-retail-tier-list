import { Tier } from "@prisma/client";
import { z } from "zod";

export const appConfigSchema = z.object({
  tiers: z.array(
    z.object({
      tier: z.nativeEnum(Tier),
      minScore: z.number(),
      maxScore: z.number()
    })
  ),
  mythicPlus: z.object({
    topN: z.number().int().positive().default(200),
    timedBonus: z.number().default(0.25),
    overtimePenalty: z.number().default(-0.25),
    minSampleSize: z.number().int().nonnegative().default(20)
  }),
  raid: z.object({
    topN: z.number().int().positive().default(200),
    percentile: z.number().min(0.5).max(0.999).default(0.95),
    minSampleSize: z.number().int().nonnegative().default(20)
  }),
  fetch: z.object({
    cacheTtlSeconds: z.number().int().positive().default(900),
    retryCount: z.number().int().nonnegative().default(4),
    retryBaseDelayMs: z.number().int().positive().default(500),
    apiConcurrency: z.number().int().positive().default(4)
  })
});

export type AppConfig = z.infer<typeof appConfigSchema>;

export const defaultAppConfig: AppConfig = {
  tiers: [
    { tier: Tier.S, minScore: 95, maxScore: 100 },
    { tier: Tier.A_PLUS, minScore: 90, maxScore: 94.99 },
    { tier: Tier.A, minScore: 80, maxScore: 89.99 },
    { tier: Tier.B_PLUS, minScore: 70, maxScore: 79.99 },
    { tier: Tier.B, minScore: 60, maxScore: 69.99 },
    { tier: Tier.C, minScore: 0, maxScore: 59.99 }
  ],
  mythicPlus: {
    topN: 200,
    timedBonus: 0.25,
    overtimePenalty: -0.25,
    minSampleSize: 20
  },
  raid: {
    topN: 200,
    percentile: 0.95,
    minSampleSize: 20
  },
  fetch: {
    cacheTtlSeconds: 900,
    retryCount: 4,
    retryBaseDelayMs: 500,
    apiConcurrency: 4
  }
};
