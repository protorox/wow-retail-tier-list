import { Mode } from "@prisma/client";
import type { AppConfig } from "@/src/server/config/app-config";
import { clampScore, normalizeToHundred } from "@/src/server/scoring/normalize";
import { median } from "@/src/server/scoring/statistics";
import type { PerformerEntry, SpecAggregate } from "@/src/server/types/performance";

type Grouped = {
  mode: Mode;
  role: PerformerEntry["role"];
  className: string;
  specName: string;
  entries: PerformerEntry[];
};

function groupBySpec(entries: PerformerEntry[]): Grouped[] {
  const groups = new Map<string, Grouped>();

  for (const entry of entries) {
    const key = `${entry.mode}|${entry.role}|${entry.className}|${entry.specName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        mode: entry.mode,
        role: entry.role,
        className: entry.className,
        specName: entry.specName,
        entries: []
      });
    }
    groups.get(key)?.entries.push(entry);
  }

  return [...groups.values()];
}

export function scoreMythicPlus(entries: PerformerEntry[], config: AppConfig): SpecAggregate[] {
  const bySpec = groupBySpec(entries)
    .map((group) => {
      const topEntries = [...group.entries].sort((a, b) => b.metric - a.metric).slice(0, config.mythicPlus.topN);
      const adjustedLevels = topEntries.map((entry) =>
        entry.metric + (entry.timed ? config.mythicPlus.timedBonus : config.mythicPlus.overtimePenalty)
      );

      return {
        mode: group.mode,
        role: group.role,
        className: group.className,
        specName: group.specName,
        scoreRaw: median(adjustedLevels),
        sampleSize: topEntries.length,
        evidenceUrls: [...new Set(topEntries.map((entry) => entry.evidenceUrl))].slice(0, 5),
        rawEntries: topEntries
      };
    })
    .filter((spec) => spec.sampleSize >= config.mythicPlus.minSampleSize);

  const byRole = new Map<string, typeof bySpec>();
  for (const spec of bySpec) {
    const roleKey = spec.role;
    byRole.set(roleKey, [...(byRole.get(roleKey) ?? []), spec]);
  }

  const normalized: SpecAggregate[] = [];

  for (const [role, roleSpecs] of byRole.entries()) {
    const normalizedScores = normalizeToHundred(roleSpecs.map((spec) => spec.scoreRaw));

    roleSpecs.forEach((spec, index) => {
      normalized.push({
        mode: Mode.MYTHIC_PLUS,
        role: role as SpecAggregate["role"],
        className: spec.className,
        specName: spec.specName,
        scoreRaw: spec.scoreRaw,
        scoreNormalized: clampScore(normalizedScores[index]),
        sampleSize: spec.sampleSize,
        evidenceUrls: spec.evidenceUrls,
        rawEntries: spec.rawEntries
      });
    });
  }

  return normalized;
}
