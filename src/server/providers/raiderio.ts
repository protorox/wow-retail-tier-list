import { Mode, Role } from "@prisma/client";
import pLimit from "p-limit";
import type { AppConfig } from "@/src/server/config/app-config";
import { env } from "@/src/server/config/env";
import { logger } from "@/src/server/logger";
import { loadFixture } from "@/src/server/providers/fixtures";
import { fetchJsonWithCache } from "@/src/server/providers/http";
import type { PerformerEntry } from "@/src/server/types/performance";

type RaiderIOMockRow = {
  role: "DPS" | "TANK" | "HEALER";
  className: string;
  specName: string;
  keyLevel: number;
  timed: boolean;
  buildString?: string;
  stats?: Record<string, number>;
  evidenceUrl: string;
};

type RaiderIOCharacter = {
  class?: string;
  class_name?: string;
  spec?: string;
  spec_name?: string;
  role?: string;
  talent_build?: string;
  talents?: string[];
  secondary_stats?: Record<string, number>;
  profile_url?: string;
};

type RaiderIORun = {
  mythic_level?: number;
  key_level?: number;
  is_completed_within_time?: boolean;
  timed?: boolean;
  score?: number;
  url?: string;
  run_url?: string;
  characters?: RaiderIOCharacter[];
  roster?: RaiderIOCharacter[];
};

type RaiderIOResponse = {
  runs?: RaiderIORun[];
  results?: RaiderIORun[];
};

function normalizeRole(role: string | undefined): Role | null {
  if (!role) return null;
  const value = role.toUpperCase();
  if (value.includes("TANK")) return Role.TANK;
  if (value.includes("HEAL")) return Role.HEALER;
  if (value.includes("DAMAGE") || value.includes("DPS")) return Role.DPS;
  return null;
}

function parseRunEntries(runs: RaiderIORun[]): PerformerEntry[] {
  const entries: PerformerEntry[] = [];

  for (const run of runs) {
    const keyLevel = run.mythic_level ?? run.key_level ?? 0;
    if (!Number.isFinite(keyLevel) || keyLevel <= 0) continue;

    const timed = Boolean(run.is_completed_within_time ?? run.timed);
    const roster = run.characters ?? run.roster ?? [];

    for (const character of roster) {
      const role = normalizeRole(character.role);
      if (!role) continue;

      const className = character.class_name ?? character.class;
      const specName = character.spec_name ?? character.spec;
      if (!className || !specName) continue;

      entries.push({
        mode: Mode.MYTHIC_PLUS,
        role,
        className,
        specName,
        metric: keyLevel,
        timed,
        buildString: character.talent_build ?? null,
        talentNodes: character.talents ?? null,
        stats: character.secondary_stats ?? null,
        evidenceUrl: character.profile_url ?? run.run_url ?? run.url ?? env.RAIDER_IO_BASE_URL,
        raw: run
      });
    }
  }

  return entries;
}

export async function fetchMythicPlusEntries(config: AppConfig): Promise<PerformerEntry[]> {
  if (env.isMockMode) {
    const fixture = await loadFixture<RaiderIOMockRow[]>("mythic-plus.json");
    return fixture.map((row) => ({
      mode: Mode.MYTHIC_PLUS,
      role: Role[row.role],
      className: row.className,
      specName: row.specName,
      metric: row.keyLevel,
      timed: row.timed,
      buildString: row.buildString ?? null,
      stats: row.stats ?? null,
      evidenceUrl: row.evidenceUrl,
      raw: row
    }));
  }

  const limit = pLimit(config.fetch.apiConcurrency);
  const pages = [0, 1, 2, 3];

  const requests = pages.map((page) =>
    limit(async () => {
      const url = new URL(env.RAIDER_IO_MPLUS_ENDPOINT, env.RAIDER_IO_BASE_URL);
      url.searchParams.set("season", "current");
      url.searchParams.set("region", "world");
      url.searchParams.set("page", String(page));

      return fetchJsonWithCache<RaiderIOResponse>(url.toString(), {
        cacheNamespace: "raiderio",
        cacheTtlSeconds: config.fetch.cacheTtlSeconds,
        retryCount: config.fetch.retryCount,
        retryBaseDelayMs: config.fetch.retryBaseDelayMs
      });
    })
  );

  const responses = await Promise.all(requests);
  const runs = responses.flatMap((response) => response.runs ?? response.results ?? []);

  logger.info({ runCount: runs.length }, "Fetched mythic+ runs from Raider.IO");

  return parseRunEntries(runs);
}
