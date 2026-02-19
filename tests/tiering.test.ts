import { describe, expect, it } from "vitest";
import { Tier } from "@prisma/client";
import { assignTier } from "@/src/server/scoring/tiering";
import { defaultAppConfig } from "@/src/server/config/app-config";

describe("assignTier", () => {
  it("assigns S tier for score >= 95", () => {
    expect(assignTier(95, defaultAppConfig)).toBe(Tier.S);
    expect(assignTier(99.5, defaultAppConfig)).toBe(Tier.S);
  });

  it("assigns middle tiers correctly", () => {
    expect(assignTier(92, defaultAppConfig)).toBe(Tier.A_PLUS);
    expect(assignTier(85, defaultAppConfig)).toBe(Tier.A);
    expect(assignTier(75, defaultAppConfig)).toBe(Tier.B_PLUS);
    expect(assignTier(65, defaultAppConfig)).toBe(Tier.B);
  });

  it("assigns C tier for low scores", () => {
    expect(assignTier(59.99, defaultAppConfig)).toBe(Tier.C);
    expect(assignTier(0, defaultAppConfig)).toBe(Tier.C);
  });
});
