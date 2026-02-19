import { Tier } from "@prisma/client";
import type { AppConfig } from "@/src/server/config/app-config";

export function assignTier(score: number, config: AppConfig): Tier {
  const sorted = [...config.tiers].sort((a, b) => b.minScore - a.minScore);
  const matched = sorted.find((tierRange) => score >= tierRange.minScore && score <= tierRange.maxScore);

  return matched?.tier ?? Tier.C;
}
