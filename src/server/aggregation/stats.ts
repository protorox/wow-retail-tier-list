import type { PerformerEntry } from "@/src/server/types/performance";
import { median } from "@/src/server/scoring/statistics";

export type DerivedStatPriority =
  | {
      available: true;
      sampleSize: number;
      medians: Record<string, number>;
      priorityOrder: string[];
      note: string;
    }
  | {
      available: false;
      sampleSize: number;
      note: string;
    };

export function deriveStatPriority(entries: PerformerEntry[], topN: number): DerivedStatPriority {
  const topEntries = entries.slice(0, topN);
  const statsAccumulator = new Map<string, number[]>();
  let entriesWithStats = 0;

  for (const entry of topEntries) {
    if (!entry.stats) continue;
    entriesWithStats += 1;

    for (const [stat, value] of Object.entries(entry.stats)) {
      if (!Number.isFinite(value)) continue;
      const existing = statsAccumulator.get(stat) ?? [];
      existing.push(value);
      statsAccumulator.set(stat, existing);
    }
  }

  if (statsAccumulator.size === 0 || entriesWithStats === 0) {
    return {
      available: false,
      sampleSize: topEntries.length,
      note: "Not available from source payloads"
    };
  }

  const medians = Object.fromEntries(
    [...statsAccumulator.entries()].map(([stat, values]) => [stat, Number(median(values).toFixed(2))])
  );

  const priorityOrder = Object.entries(medians)
    .sort((a, b) => b[1] - a[1])
    .map(([stat]) => stat);

  return {
    available: true,
    sampleSize: entriesWithStats,
    medians,
    priorityOrder,
    note: "Data-driven from top performers"
  };
}
