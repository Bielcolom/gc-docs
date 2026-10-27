export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, decimals: number): number {
  const k = 10 ** decimals;
  return Math.round(value * k) / k;
}
