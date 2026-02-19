import { Mode, Role } from "@prisma/client";
import pLimit from "p-limit";
import { env } from "@/src/server/config/env";
import type { AppConfig } from "@/src/server/config/app-config";
import { getRoleForSpec } from "@/src/server/config/spec-role-map";
import { logger } from "@/src/server/logger";
import { loadFixture } from "@/src/server/providers/fixtures";
import { fetchJsonWithCache, requireCredentials } from "@/src/server/providers/http";
import type { PerformerEntry } from "@/src/server/types/performance";

type RaidMockRow = {
  role: "DPS" | "TANK" | "HEALER";
  className: string;
  specName: string;
  parse: number;
  bossName: string;
  buildString?: string;
  stats?: Record<string, number>;
  evidenceUrl: string;
};

type MythicPlusMockRow = {
  role: "DPS" | "TANK" | "HEALER";
  className: string;
  specName: string;
  keyLevel: number;
  timed: boolean;
  buildString?: string;
  stats?: Record<string, number>;
  evidenceUrl: string;
};

type OAuthResponse = {
  access_token: string;
  expires_in: number;
};

type ZoneResponse = {
  data?: {
    worldData?: {
      zone?: {
        encounters?: Array<{ id: number; name: string }>;
      };
    };
  };
};

type RankingRow = {
  className?: string;
  specName?: string;
  role?: string;
  amount?: number;
  total?: number;
  parsePercent?: number;
  score?: number;
  playerScore?: number;
  playerscore?: number;
  dps?: number;
  hps?: number;
  tankhps?: number;
  metric?: number;
  completedWithinTime?: boolean;
  completeInTime?: boolean;
  timed?: boolean;
  inTime?: boolean;
  wasCompletedInTime?: boolean;
  talentTree?: string;
  talents?: string[];
  reportID?: string;
  characterID?: number;
  combatantInfo?: {
    secondaryStats?: Record<string, number>;
    stats?: Record<string, number>;
  };
};

type RankingsResponse = {
  data?: {
    worldData?: {
      encounter?: {
        characterRankings?: {
          rankings?: RankingRow[];
        };
      };
    };
  };
};

async function getOAuthToken(config: AppConfig): Promise<string> {
  requireCredentials(env.WARCRAFTLOGS_CLIENT_ID, env.WARCRAFTLOGS_CLIENT_SECRET);

  const creds = Buffer.from(`${env.WARCRAFTLOGS_CLIENT_ID}:${env.WARCRAFTLOGS_CLIENT_SECRET}`).toString("base64");
  const url = `${env.WARCRAFTLOGS_BASE_URL}/oauth/token`;

  const response = await fetchJsonWithCache<OAuthResponse>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${creds}`
    },
    body: "grant_type=client_credentials",
    cacheNamespace: "wcl-oauth",
    cacheTtlSeconds: 300,
    retryCount: config.fetch.retryCount,
    retryBaseDelayMs: config.fetch.retryBaseDelayMs
  });

  return response.access_token;
}

async function graphQLRequest<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
  namespace: string,
  config: AppConfig
): Promise<T> {
  const body = JSON.stringify({ query, variables });

  return fetchJsonWithCache<T>(`${env.WARCRAFTLOGS_BASE_URL}/api/v2/client`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body,
    cacheNamespace: namespace,
    cacheTtlSeconds: config.fetch.cacheTtlSeconds,
    retryCount: config.fetch.retryCount,
    retryBaseDelayMs: config.fetch.retryBaseDelayMs
  });
}

function parseRole(specName: string, explicitRole?: string): Role | null {
  if (explicitRole) {
    const normalized = explicitRole.toUpperCase();
    if (normalized.includes("TANK")) return Role.TANK;
    if (normalized.includes("HEAL")) return Role.HEALER;
    if (normalized.includes("DPS") || normalized.includes("DAMAGE")) return Role.DPS;
  }

  const mapped = getRoleForSpec(specName.replace(/\s+/g, ""));
  return mapped;
}

function extractMetric(row: RankingRow): number | null {
  const candidates = [
    row.amount,
    row.total,
    row.parsePercent,
    row.score,
    row.playerScore,
    row.playerscore,
    row.dps,
    row.hps,
    row.tankhps,
    row.metric
  ];

  for (const value of candidates) {
    if (value !== undefined && value !== null && Number.isFinite(value)) {
      return Number(value);
    }
  }

  return null;
}

function extractTimed(row: RankingRow): boolean | undefined {
  const candidates = [row.completedWithinTime, row.completeInTime, row.timed, row.inTime, row.wasCompletedInTime];

  for (const value of candidates) {
    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

function extractEvidenceUrl(row: RankingRow): string {
  if (row.reportID && row.characterID) {
    return `${env.WARCRAFTLOGS_BASE_URL}/reports/${row.reportID}#fight=last&type=summary&source=${row.characterID}`;
  }

  return `${env.WARCRAFTLOGS_BASE_URL}`;
}

export async function fetchRaidEntries(config: AppConfig): Promise<PerformerEntry[]> {
  if (env.isMockMode) {
    const fixture = await loadFixture<RaidMockRow[]>("raid.json");
    return fixture.map((row) => ({
      mode: Mode.RAID,
      role: Role[row.role],
      className: row.className,
      specName: row.specName,
      metric: row.parse,
      buildString: row.buildString ?? null,
      stats: row.stats ?? null,
      evidenceUrl: row.evidenceUrl,
      raw: row
    }));
  }

  const token = await getOAuthToken(config);
  const zoneQuery = `
    query ZoneEncounters($zoneID: Int!) {
      worldData {
        zone(id: $zoneID) {
          encounters {
            id
            name
          }
        }
      }
    }
  `;

  const zone = await graphQLRequest<ZoneResponse>(
    token,
    zoneQuery,
    { zoneID: env.WARCRAFTLOGS_ZONE_ID },
    "wcl-zone",
    config
  );

  const encounters = zone.data?.worldData?.zone?.encounters ?? [];
  if (encounters.length === 0) {
    logger.warn("No encounters returned from Warcraft Logs zone query");
    return [];
  }

  const rankingsQuery = `
    query EncounterRankings($encounterID: Int!, $difficulty: Int!, $page: Int!) {
      worldData {
        encounter(id: $encounterID) {
          characterRankings(difficulty: $difficulty, partition: 1, page: $page, includeCombatantInfo: true)
        }
      }
    }
  `;

  const limit = pLimit(config.fetch.apiConcurrency);

  const requests = encounters.flatMap((encounter) =>
    [1, 2].map((page) =>
      limit(async () => {
        const response = await graphQLRequest<RankingsResponse>(
          token,
          rankingsQuery,
          {
            encounterID: encounter.id,
            difficulty: env.WARCRAFTLOGS_DIFFICULTY,
            page
          },
          `wcl-rankings-${encounter.id}-${page}`,
          config
        );

        const rankings = response.data?.worldData?.encounter?.characterRankings?.rankings ?? [];

        return rankings.map((row) => {
          const className = row.className;
          const specName = row.specName;
          if (!className || !specName) return null;

          const role = parseRole(specName, row.role);
          if (!role) return null;

          const metric = extractMetric(row);
          if (metric === null) return null;

          const stats = row.combatantInfo?.secondaryStats ?? row.combatantInfo?.stats ?? null;

          return {
            mode: Mode.RAID,
            role,
            className,
            specName,
            metric,
            buildString: row.talentTree ?? null,
            talentNodes: row.talents ?? null,
            stats,
            evidenceUrl: extractEvidenceUrl(row),
            raw: row
          } satisfies PerformerEntry;
        });
      })
    )
  );

  const grouped = await Promise.all(requests);
  const entries = grouped.flat().filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  logger.info({ encounterCount: encounters.length, rowCount: entries.length }, "Fetched raid rankings");

  return entries;
}

export async function fetchMythicPlusEntriesFromWarcraftLogs(config: AppConfig): Promise<PerformerEntry[]> {
  if (env.isMockMode) {
    const fixture = await loadFixture<MythicPlusMockRow[]>("mythic-plus.json");
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

  const token = await getOAuthToken(config);
  const zoneQuery = `
    query ZoneEncounters($zoneID: Int!) {
      worldData {
        zone(id: $zoneID) {
          encounters {
            id
            name
          }
        }
      }
    }
  `;

  const zone = await graphQLRequest<ZoneResponse>(
    token,
    zoneQuery,
    { zoneID: env.WARCRAFTLOGS_MPLUS_ZONE_ID },
    "wcl-mplus-zone",
    config
  );

  const encounters = zone.data?.worldData?.zone?.encounters ?? [];
  if (encounters.length === 0) {
    logger.warn({ zoneID: env.WARCRAFTLOGS_MPLUS_ZONE_ID }, "No encounters returned from Warcraft Logs M+ zone query");
    return [];
  }

  const rankingsQuery = `
    query EncounterMPlusRankings($encounterID: Int!, $difficulty: Int!, $page: Int!, $bracket: Int!) {
      worldData {
        encounter(id: $encounterID) {
          characterRankings(
            difficulty: $difficulty,
            bracket: $bracket,
            partition: 1,
            page: $page,
            includeCombatantInfo: true
          )
        }
      }
    }
  `;

  const limit = pLimit(config.fetch.apiConcurrency);
  const pages = Array.from({ length: env.WARCRAFTLOGS_MPLUS_PAGES }, (_, index) => index + 1);

  const requests = encounters.flatMap((encounter) =>
    pages.map((page) =>
      limit(async () => {
        const response = await graphQLRequest<RankingsResponse>(
          token,
          rankingsQuery,
          {
            encounterID: encounter.id,
            difficulty: env.WARCRAFTLOGS_MPLUS_DIFFICULTY,
            bracket: env.WARCRAFTLOGS_MPLUS_BRACKET,
            page
          },
          `wcl-mplus-rankings-${encounter.id}-${page}`,
          config
        );

        const rankings = response.data?.worldData?.encounter?.characterRankings?.rankings ?? [];

        return rankings.map((row) => {
          const className = row.className;
          const specName = row.specName;
          if (!className || !specName) return null;

          const role = parseRole(specName, row.role);
          if (!role) return null;

          const metric = extractMetric(row);
          if (metric === null) return null;

          const stats = row.combatantInfo?.secondaryStats ?? row.combatantInfo?.stats ?? null;

          return {
            mode: Mode.MYTHIC_PLUS,
            role,
            className,
            specName,
            metric,
            timed: extractTimed(row),
            buildString: row.talentTree ?? null,
            talentNodes: row.talents ?? null,
            stats,
            evidenceUrl: extractEvidenceUrl(row),
            raw: row
          } satisfies PerformerEntry;
        });
      })
    )
  );

  const grouped = await Promise.all(requests);
  const entries = grouped.flat().filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  logger.info(
    {
      zoneID: env.WARCRAFTLOGS_MPLUS_ZONE_ID,
      encounterCount: encounters.length,
      pages: env.WARCRAFTLOGS_MPLUS_PAGES,
      rowCount: entries.length
    },
    "Fetched Mythic+ rankings from Warcraft Logs"
  );

  return entries;
}
