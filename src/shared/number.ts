/** Parses a non-negative number typed by a person; accepts both "62,5" and "62.5". */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
