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

          const metricValue = row.parsePercent ?? row.amount ?? row.total;
          if (metricValue === undefined || metricValue === null || !Number.isFinite(metricValue)) return null;
          const metric = Number(metricValue);

          const stats = row.combatantInfo?.secondaryStats ?? row.combatantInfo?.stats ?? null;
          const evidenceUrl =
            row.reportID && row.characterID
              ? `${env.WARCRAFTLOGS_BASE_URL}/reports/${row.reportID}#fight=last&type=summary&source=${row.characterID}`
              : `${env.WARCRAFTLOGS_BASE_URL}/zone/rankings/${env.WARCRAFTLOGS_ZONE_ID}`;

          return {
            mode: Mode.RAID,
            role,
            className,
            specName,
            metric,
            buildString: row.talentTree ?? null,
            talentNodes: row.talents ?? null,
            stats,
            evidenceUrl,
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
