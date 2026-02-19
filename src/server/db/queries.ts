import { Mode, Prisma, Role, Tier } from "@prisma/client";
import { prisma } from "@/src/server/db/prisma";

export type SpecViewModel = {
  id: string;
  mode: Mode;
  role: Role;
  className: string;
  specName: string;
  score: number;
  tier: Tier;
  sampleSize: number;
  rank: number;
  previousRank: number | null;
  rawJson: Prisma.JsonValue | null;
  build: Prisma.JsonValue | null;
  buildSource: string | null;
  buildImportString: string | null;
  stats: Prisma.JsonValue | null;
};

export type SnapshotView = {
  snapshotId: string;
  mode: Mode;
  createdAt: Date;
  metadataJson: Prisma.JsonValue | null;
  specs: SpecViewModel[];
};

export async function getLatestSnapshotView(mode: Mode): Promise<SnapshotView | null> {
  const snapshot = await prisma.snapshot.findFirst({
    where: { mode },
    orderBy: { createdAt: "desc" }
  });

  if (!snapshot) return null;

  const [scores, builds, stats] = await Promise.all([
    prisma.specScore.findMany({
      where: { snapshotId: snapshot.id },
      orderBy: [{ role: "asc" }, { rank: "asc" }]
    }),
    prisma.specBuild.findMany({ where: { snapshotId: snapshot.id } }),
    prisma.specStats.findMany({ where: { snapshotId: snapshot.id } })
  ]);

  const buildMap = new Map(builds.map((item) => [`${item.role}|${item.className}|${item.specName}`, item]));
  const statsMap = new Map(stats.map((item) => [`${item.role}|${item.className}|${item.specName}`, item]));

  const specs: SpecViewModel[] = scores.map((score) => {
    const key = `${score.role}|${score.className}|${score.specName}`;
    const build = buildMap.get(key);
    const stat = statsMap.get(key);

    return {
      id: score.id,
      mode: score.mode,
      role: score.role,
      className: score.className,
      specName: score.specName,
      score: score.score,
      tier: score.tier,
      sampleSize: score.sampleSize,
      rank: score.rank,
      previousRank: score.previousRank,
      rawJson: score.rawJson,
      build: build?.buildJson ?? null,
      buildSource: build?.buildSource ?? null,
      buildImportString: build?.buildImportStringNullable ?? null,
      stats: stat?.statsJson ?? null
    };
  });

  return {
    snapshotId: snapshot.id,
    mode: snapshot.mode,
    createdAt: snapshot.createdAt,
    metadataJson: snapshot.metadataJson,
    specs
  };
}

export async function getLatestJobRuns(limit = 25) {
  return prisma.jobRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit
  });
}
