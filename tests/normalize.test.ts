import { describe, expect, it } from "vitest";
import { normalizeToHundred } from "@/src/server/scoring/normalize";

describe("normalizeToHundred", () => {
  it("normalizes a simple range to 0..100", () => {
    const result = normalizeToHundred([10, 20, 30]);
    expect(result).toEqual([0, 50, 100]);
  });

  it("returns 50 for all values when min and max are equal", () => {
    const result = normalizeToHundred([12, 12, 12]);
    expect(result).toEqual([50, 50, 50]);
  });

  it("returns empty array for empty input", () => {
    const result = normalizeToHundred([]);
    expect(result).toEqual([]);
  });
});
