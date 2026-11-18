/** "30:1", "32 : 1", "1:40" → 30 / 32 / 40. */
export function parseRatio(v: string | null | undefined) {
  if (!v) return null;
  const m = v.match(/(\d+(?:[.,]\d+)?)\s*:\s*(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const a = Number(m[1].replace(",", "."));
  const b = Number(m[2].replace(",", "."));
  const r = Math.max(a, b) / Math.min(a, b);
  return Number.isFinite(r) && r >= 10 && r <= 100 ? Math.round(r * 10) / 10 : null;
}
