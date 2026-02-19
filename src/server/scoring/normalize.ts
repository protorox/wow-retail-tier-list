export function normalizeToHundred(values: number[]): number[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return values.map(() => 50);
  }

  return values.map((value) => ((value - min) / (max - min)) * 100);
}

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.min(100, Math.max(0, Number(score.toFixed(2))));
}
