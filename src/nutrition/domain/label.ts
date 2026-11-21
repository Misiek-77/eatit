import type { Nutrients } from './types';

/**
 * Reads the nutrition table of a food label from OCR text. Built for Polish labels (and the English one often
 * printed next to it), and forgiving about OCR mistakes: letters misread inside words ("Biatko", "Tłuszez"),
 * O for 0 inside numbers, decimal commas, values split over two lines.
 */

export interface LabelReading {
  /** Values per 100 g (or 100 ml) that were found. */
  values: Partial<Nutrients>;
  /** When the label gave only a per-portion column, its size in grams; values were scaled to 100 g. */
  portionGrams?: number;
}

type Key = keyof Nutrients;

/** Words that start a row, without diacritics. The first match on a line decides what the line is. */
const KEYWORDS: [Key, string[]][] = [
  ['kcal', ['wartosc energetyczna', 'energia', 'energy']],
  ['fat', ['tluszcz', 'fat']],
  ['carbs', ['weglowodany', 'carbohydrate', 'carbohydrates']],
  ['sugar', ['cukry', 'sugars']],
  ['fiber', ['blonnik', 'fibre', 'fiber']],
  ['protein', ['bialko', 'protein']],
  ['salt', ['sol', 'salt']],
];

/** Lower case, no diacritics, "ł" as "l". */
const plain = (s: string) => s.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Edit distance, for words OCR got slightly wrong. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** Whether the line starts (after any "w tym") with the keyword, allowing about one OCR slip per four letters. */
function startsWith(line: string, keyword: string): boolean {
  const text = line.replace(/^[^a-z]*(w tym|of which|in tym)\s*/, '').replace(/^[^a-z]+/, '');
  const head = text.slice(0, keyword.length);
  if (head.length < keyword.length - 1) return false;
  const allowed = keyword.length <= 3 ? 0 : Math.floor(keyword.length / 4);
  return distance(head, keyword) <= allowed;
}

/** What a line of the table is about, or null. Saturated fats and other sub-rows of fat are not fat. */
function lineKey(line: string): Key | null {
  if (/nasyc|kwasy|saturat|polyol|skrobia|starch|alkohole/.test(line)) return null;
  for (const [key, words] of KEYWORDS) if (words.some((w) => startsWith(line, w))) return key;
  return null;
}

/** Numbers in a line, with OCR's O/o read as 0 when they sit next to digits, and decimal commas. */
function numbersIn(line: string): { value: number; unit: string }[] {
  const fixed = line
    .replace(/(?<=\d)[oO](?=[\d.,\s]|$)/g, '0')
    .replace(/(?<=[\s<~(]|^)[oO](?=[.,]\d)/g, '0');
  const out: { value: number; unit: string }[] = [];
  for (const m of fixed.matchAll(/(\d+(?:[.,]\d+)?)\s*(kcal|kj|mg|g)?/gi)) {
    let digits = m[1].replace(',', '.');
    let unit = (m[2] ?? '').toLowerCase();
    // OCR often reads the "g" right after a number as a 9: "1,1g" comes back as "1,19". Labels give one
    // decimal, so two decimals ending in 9 with no unit after them are read as one decimal and grams.
    if (!unit && /^\d+\.\d9$/.test(digits)) {
      digits = digits.slice(0, -1);
      unit = 'g';
    }
    const value = parseFloat(digits);
    if (Number.isFinite(value)) out.push({ value, unit });
  }
  return out;
}

/** Portion size from a header like "w porcji (30 g)" or "per portion 30 g". */
function portionSize(text: string): number | undefined {
  const m = /(porcj\w*|portion|serving)[^\d]{0,15}(\d+(?:[.,]\d+)?)\s*(g|ml)/.exec(text);
  const grams = m ? parseFloat(m[2].replace(',', '.')) : NaN;
  return grams > 0 ? grams : undefined;
}

/** Whether the table has a 100 g (or 100 ml) column. */
const hasPer100 = (text: string) => /100\s*(g|ml)/.test(text);

/** Whether two amounts agree within a share of the second. */
const near = (a: number, b: number, share: number) => b > 0 && Math.abs(a - b) <= share * b;

export function readLabel(ocrText: string): LabelReading {
  const lines = plain(ocrText)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const values: Partial<Nutrients> = {};
  /** The portion column of each row, used to catch a lost decimal comma in the 100 g column. */
  const portionColumn: Partial<Nutrients> = {};

  for (let i = 0; i < lines.length; i++) {
    const key = lineKey(lines[i]);
    if (!key || values[key] !== undefined) continue;

    if (key === 'kcal') {
      // Energy may continue on the next line ("1550 kJ" / "370 kcal").
      const nums = [...numbersIn(lines[i]), ...(i + 1 < lines.length && !lineKey(lines[i + 1]) ? numbersIn(lines[i + 1]) : [])];
      const kj = nums.find((n) => n.unit === 'kj');
      // The kcal of the 100 g column is the kJ of that column divided by 4.184. Reading the number that fits that,
      // rather than the first one marked "kcal", survives OCR dropping a "kcal" and handing over the portion's.
      const fromKj = kj && nums.find((n) => n !== kj && n.unit !== 'kj' && near(n.value, kj.value / 4.184, 0.04));
      const kcal = nums.find((n) => n.unit === 'kcal');
      if (fromKj) values.kcal = fromKj.value;
      else if (kj) values.kcal = Math.round(kj.value / 4.184);
      else if (kcal) values.kcal = kcal.value;
      continue;
    }

    // The first amount in the row is the per-100 g column. Milligrams (sodium tables) are converted.
    const nums = numbersIn(lines[i]).filter((n) => n.unit !== 'kcal' && n.unit !== 'kj');
    const first = nums[0];
    if (!first) continue;
    values[key] = first.unit === 'mg' ? first.value / 1000 : first.value;
    if (nums[1]) portionColumn[key] = nums[1].unit === 'mg' ? nums[1].value / 1000 : nums[1].value;
  }

  // A stray "kcal" figure elsewhere (energy row the OCR split oddly).
  if (values.kcal === undefined) {
    const m = /(\d+(?:[.,]\d+)?)\s*kcal/.exec(plain(ocrText));
    if (m) values.kcal = parseFloat(m[1].replace(',', '.'));
  }

  const all = plain(ocrText);
  const portion = portionSize(all);

  // With both columns, the portion one is a check: a 100 g value ten or a hundred times what the portion implies
  // most likely lost its decimal comma ("1,1 g" read as "11g").
  if (portion && hasPer100(all)) {
    for (const k of Object.keys(portionColumn) as Key[]) {
      const a = values[k];
      const b = portionColumn[k];
      if (a === undefined || b === undefined || b <= 0) continue;
      const expected = (b * 100) / portion;
      if (near(a, expected, 0.3)) continue;
      const fixed = [a / 10, a / 100].find((c) => near(c, expected, 0.15));
      if (fixed !== undefined) values[k] = Math.round(fixed * 1000) / 1000;
    }
  }

  if (portion && !hasPer100(all)) {
    const f = 100 / portion;
    for (const k of Object.keys(values) as Key[]) values[k] = Math.round(values[k]! * f * 10) / 10;
    return { values, portionGrams: portion };
  }
  return { values };
}

/** The values a label must give for a product to be saved. */
export const REQUIRED: Key[] = ['kcal', 'protein', 'fat', 'carbs'];
