import { Mode, Prisma } from "@prisma/client";
import { ensureAppConfig } from "@/src/server/config/store";
import { prisma } from "@/src/server/db/prisma";
import { logger } from "@/src/server/logger";
import { deriveMostCommonBuild } from "@/src/server/aggregation/builds";
import { deriveStatPriority } from "@/src/server/aggregation/stats";
import { assignTier } from "@/src/server/scoring/tiering";
import { scoreMythicPlus } from "@/src/server/scoring/mythic-plus";
import { scoreRaid } from "@/src/server/scoring/raid";
import { fetchMythicPlusEntriesFromWarcraftLogs, fetchRaidEntries } from "@/src/server/providers/warcraftlogs";
import type { SpecAggregate } from "@/src/server/types/performance";
import type { AppConfig } from "@/src/server/config/app-config";

export type RefreshMode = "MYTHIC_PLUS" | "RAID" | "ALL";

type RefreshRunInput = {
  mode?: RefreshMode;
  trigger?: "manual" | "cron" | "interval" | "seed";
};

async function previousRankMap(mode: Mode): Promise<Map<string, number>> {
  const previousSnapshot = await prisma.snapshot.findFirst({
    where: { mode },
    orderBy: { createdAt: "desc" },
    include: { specScores: true }
  });

  const map = new Map<string, number>();
  if (!previousSnapshot) return map;

  for (const score of previousSnapshot.specScores) {
    map.set(`${score.role}|${score.className}|${score.specName}`, score.rank);
  }

  return map;
}

function sortAndRank(specs: SpecAggregate[]): Array<SpecAggregate & { rank: number }> {
  const grouped = new Map<string, SpecAggregate[]>();
  for (const spec of specs) {
    grouped.set(spec.role, [...(grouped.get(spec.role) ?? []), spec]);
  }

  const ranked: Array<SpecAggregate & { rank: number }> = [];

  for (const roleSpecs of grouped.values()) {
    const sorted = [...roleSpecs].sort((a, b) => b.scoreNormalized - a.scoreNormalized);
    sorted.forEach((spec, index) => {
      ranked.push({ ...spec, rank: index + 1 });
    });
  }

  return ranked;
}

async function persistSnapshot(
  mode: Mode,
  scored: SpecAggregate[],
  config: AppConfig,
  metadata: Prisma.JsonObject
): Promise<number> {
  const previousRanks = await previousRankMap(mode);
  const ranked = sortAndRank(scored);
  const topN = mode === Mode.MYTHIC_PLUS ? config.mythicPlus.topN : config.raid.topN;

  const created = await prisma.$transaction(async (tx) => {
    const snapshot = await tx.snapshot.create({
      data: {
        mode,
        metadataJson: metadata
      }
    });

    for (const spec of ranked) {
      const previousRank = previousRanks.get(`${spec.role}|${spec.className}|${spec.specName}`) ?? null;
      const tier = assignTier(spec.scoreNormalized, config);
      const build = deriveMostCommonBuild(spec.rawEntries, topN);
      const stats = deriveStatPriority(spec.rawEntries, topN);

      await tx.specScore.create({
        data: {
          snapshotId: snapshot.id,
          mode,
          role: spec.role,
          className: spec.className,
          specName: spec.specName,
          score: spec.scoreNormalized,
          tier,
          sampleSize: spec.sampleSize,
          rank: spec.rank,
          previousRank,
          rawJson: {
            scoreRaw: spec.scoreRaw,
            evidenceUrls: spec.evidenceUrls,
            rawSampleCount: spec.rawEntries.length
          }
        }
      });

      await tx.specBuild.create({
        data: {
          snapshotId: snapshot.id,
          mode,
          role: spec.role,
          className: spec.className,
          specName: spec.specName,
          buildJson: build,
          buildSource: build.buildSource,
          buildImportStringNullable: build.type === "import_string" ? build.buildImportString : null
        }
      });

      await tx.specStats.create({
        data: {
          snapshotId: snapshot.id,
          mode,
          role: spec.role,
          className: spec.className,
          specName: spec.specName,
          statsJson: stats
        }
      });
    }

    return ranked.length;
  });

  return created;
}

export async function runRefresh(input: RefreshRunInput = {}): Promise<{ updated: number }> {
  const start = Date.now();
  const config = await ensureAppConfig();
  const mode = input.mode ?? "ALL";

  const jobRun = await prisma.jobRun.create({
    data: {
      mode: mode === "ALL" ? undefined : (mode as Mode),
      status: "running",
      metadataJson: {
        trigger: input.trigger ?? "manual"
      }
    }
  });

  try {
    let updated = 0;

    if (mode === "ALL" || mode === "MYTHIC_PLUS") {
      const entries = await fetchMythicPlusEntriesFromWarcraftLogs(config);
      const scored = scoreMythicPlus(entries, config);
      if (scored.length > 0) {
        updated += await persistSnapshot(Mode.MYTHIC_PLUS, scored, config, {
          source: "warcraftlogs_mythic_plus",
          entryCount: entries.length,
          scoredCount: scored.length,
          minSampleSize: config.mythicPlus.minSampleSize,
          topN: config.mythicPlus.topN,
          trigger: input.trigger ?? "manual"
        });
      } else {
        logger.warn({ entryCount: entries.length }, "Skipping Mythic+ snapshot because no specs met scoring criteria");
      }
    }

    if (mode === "ALL" || mode === "RAID") {
      const entries = await fetchRaidEntries(config);
      const scored = scoreRaid(entries, config);
      if (scored.length > 0) {
        updated += await persistSnapshot(Mode.RAID, scored, config, {
          source: "warcraftlogs",
          entryCount: entries.length,
          scoredCount: scored.length,
          minSampleSize: config.raid.minSampleSize,
          topN: config.raid.topN,
          trigger: input.trigger ?? "manual"
        });
      } else {
        logger.warn({ entryCount: entries.length }, "Skipping raid snapshot because no specs met scoring criteria");
      }
    }

    const durationMs = Date.now() - start;

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        durationMs,
        itemsUpdated: updated
      }
    });

    logger.info({ mode, durationMs, updated }, "Refresh completed");

    return { updated };
  } catch (error) {
    const durationMs = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        durationMs,
        errorMessage
      }
    });

    logger.error({ error, mode }, "Refresh failed");
    throw error;
  }
}
