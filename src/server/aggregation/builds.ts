import type { PerformerEntry } from "@/src/server/types/performance";

export type DerivedBuild =
  | {
      type: "import_string";
      sampleSize: number;
      buildSource: "derived_from_top_performers";
      mostCommonBuild: string;
      buildImportString: string;
      buildFrequency: number;
    }
  | {
      type: "node_rates";
      sampleSize: number;
      buildSource: "derived_from_top_performers";
      nodePickRates: Array<{ node: string; pickRate: number }>;
    }
  | {
      type: "not_available";
      sampleSize: number;
      buildSource: "not_available";
      reason: string;
    };

export function deriveMostCommonBuild(entries: PerformerEntry[], topN: number): DerivedBuild {
  const topEntries = entries.slice(0, topN);
  const buildCounts = new Map<string, number>();

  for (const entry of topEntries) {
    const build = entry.buildString?.trim();
    if (!build) continue;
    buildCounts.set(build, (buildCounts.get(build) ?? 0) + 1);
  }

  if (buildCounts.size > 0) {
    const [mostCommonBuild, count] = [...buildCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      type: "import_string",
      sampleSize: topEntries.length,
      buildSource: "derived_from_top_performers",
      mostCommonBuild,
      buildImportString: mostCommonBuild,
      buildFrequency: Number((count / topEntries.length).toFixed(3))
    };
  }

  const nodeCounts = new Map<string, number>();
  let withNodes = 0;

  for (const entry of topEntries) {
    if (!entry.talentNodes || entry.talentNodes.length === 0) continue;
    withNodes += 1;

    for (const node of entry.talentNodes) {
      nodeCounts.set(node, (nodeCounts.get(node) ?? 0) + 1);
    }
  }

  if (nodeCounts.size > 0 && withNodes > 0) {
    const nodePickRates = [...nodeCounts.entries()]
      .map(([node, count]) => ({
        node,
        pickRate: Number((count / withNodes).toFixed(3))
      }))
      .sort((a, b) => b.pickRate - a.pickRate)
      .slice(0, 20);

    return {
      type: "node_rates",
      sampleSize: withNodes,
      buildSource: "derived_from_top_performers",
      nodePickRates
    };
  }

  return {
    type: "not_available",
    sampleSize: topEntries.length,
    buildSource: "not_available",
    reason: "No build strings or talent node selections were present in source payloads."
  };
}
