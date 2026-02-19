import { describe, expect, it } from "vitest";
import { Mode, Role } from "@prisma/client";
import { deriveMostCommonBuild } from "@/src/server/aggregation/builds";
import type { PerformerEntry } from "@/src/server/types/performance";

function makeEntry(overrides: Partial<PerformerEntry>): PerformerEntry {
  return {
    mode: Mode.MYTHIC_PLUS,
    role: Role.DPS,
    className: "Mage",
    specName: "Fire",
    metric: 15,
    evidenceUrl: "https://example.com",
    ...overrides
  };
}

describe("deriveMostCommonBuild", () => {
  it("selects the most common build string", () => {
    const entries = [
      makeEntry({ buildString: "BUILD_A" }),
      makeEntry({ buildString: "BUILD_A" }),
      makeEntry({ buildString: "BUILD_B" })
    ];

    const result = deriveMostCommonBuild(entries, 10);

    expect(result.type).toBe("import_string");
    if (result.type === "import_string") {
      expect(result.mostCommonBuild).toBe("BUILD_A");
      expect(result.buildFrequency).toBeCloseTo(0.667, 2);
    }
  });

  it("falls back to talent node pick rates when build strings are missing", () => {
    const entries = [
      makeEntry({ buildString: null, talentNodes: ["A1", "A2"] }),
      makeEntry({ buildString: null, talentNodes: ["A1", "B2"] }),
      makeEntry({ buildString: null, talentNodes: ["A1"] })
    ];

    const result = deriveMostCommonBuild(entries, 10);

    expect(result.type).toBe("node_rates");
    if (result.type === "node_rates") {
      expect(result.nodePickRates[0].node).toBe("A1");
      expect(result.nodePickRates[0].pickRate).toBe(1);
    }
  });
});
