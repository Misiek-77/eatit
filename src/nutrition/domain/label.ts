import type { Nutrients } from './types';

/**
 * Reads the nutrition table of a food label from OCR text. Built for Polish labels, including the common
 * bilingual ones ("Tłuszcz/Fat"), and for what OCR really does to a photo of a curved package:
 *
 * - row names come back garbled ("W prpać > yias" for "Węglowodany/Carbohydrate"). EU labels list the rows in a
 *   fixed order, so a row that cannot be named takes the place left for it between the rows that can;
 * - the "g" after a number turns into a digit and decimal commas vanish ("1,5 g" → "159", "6,5 g" → "651").
 *   The energy row survives best (the kJ figure pins the kcal one), so the readings of fat, carbohydrates and
 *   protein are chosen together to fit it: 4 kcal per gram of protein and carbohydrate, 9 per gram of fat.
 *   Sugars may not exceed carbohydrates nor saturates fat;
 * - O instead of 0, letters misread inside words, a value pushed onto the next line.
 */

export interface LabelReading {
  /** Values per 100 g (or 100 ml) that were found. */
  values: Partial<Nutrients>;
  /** When the label gave only a per-portion column, its size in grams; values were scaled to 100 g. */
  portionGrams?: number;
}

type Key = keyof Nutrients;
/** Table rows in the order EU rules print them; saturates is a row of its own, only used to place the others. */
type Row = Key | 'saturates';
const ORDER: Row[] = ['fat', 'saturates', 'carbs', 'sugar', 'fiber', 'protein', 'salt'];

/** Words that name a row, without diacritics, Polish and English. */
const KEYWORDS: [Row | 'energy', string[]][] = [
  ['energy', ['wartosc energetyczna', 'energia', 'energy']],
  ['saturates', ['kwasy tluszczowe nasycone', 'nasycone', 'of which saturates', 'saturates']],
  ['fat', ['tluszcz', 'fat']],
  ['carbs', ['weglowodany', 'carbohydrate', 'carbohydrates']],
  ['sugar', ['cukry', 'sugars', 'sugar']],
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

/** Whether a piece of a row name starts with the keyword, allowing about one OCR slip per four letters. */
function startsWith(piece: string, keyword: string): boolean {
  const text = piece.replace(/^[^a-z]*(w tym|of which|in tym)\s*/, '').replace(/^[^a-z]+/, '');
  const head = text.slice(0, keyword.length);
  if (head.length < keyword.length - 1) return false;
  const allowed = keyword.length <= 3 ? 0 : Math.floor(keyword.length / 4);
  return distance(head, keyword) <= allowed;
}

/** What a line is about: its name before the numbers, in either language ("tluszcz/fat"). */
function lineKey(line: string): Row | 'energy' | null {
  const name = line.split(/\d/)[0];
  if (/nasyc|saturat/.test(name)) return 'saturates';
  if (/polyol|skrobia|starch|alkohol|jednonienas|wielonienas|mono|poly/.test(name)) return null;
  const pieces = name.split('/').map((p) => p.trim());
  for (const [key, words] of KEYWORDS) if (pieces.some((p) => words.some((w) => startsWith(p, w)))) return key;
  return null;
}

interface Token {
  /** The number as written, with a decimal point. */
  text: string;
  value: number;
  unit: string;
}

/**
 * Numbers in a line, with O read as 0 next to digits and decimal commas as points. A digit stuck to letters
 * ("-5akoproe", a garbled word) is part of the word, not an amount.
 */
function numbersIn(line: string): Token[] {
  const fixed = line.replace(/(?<=\d)[oO](?=[\d.,\s]|$)/g, '0').replace(/(?<=[\s<~(]|^)[oO](?=[.,]\d)/g, '0');
  const out: Token[] = [];
  for (const m of fixed.matchAll(/(?<![a-z\d.,])(\d+(?:[.,]\d+)?)\s*(kcal|kj|mg|g)?(?![a-z])/gi)) {
    const text = m[1].replace(',', '.');
    const value = parseFloat(text);
    if (Number.isFinite(value)) out.push({ text, value, unit: (m[2] ?? '').toLowerCase() });
  }
  return out;
}

/**
 * What a misread amount may really have been, each with the number of repairs it took: as read; with its last
 * digit dropped when no unit follows (a "g" read as 9, 0, 1, 4, 7 or 8); with a lost decimal comma put back after
 * the first or second digit; or with a middle 8 read as the comma.
 */
function readings(t: Token, oneDecimal = true): { value: number; edits: number }[] {
  const out = new Map<number, number>();
  const add = (written: string, edits: number) => {
    const value = Math.round(parseFloat(written) * 1000) / 1000;
    // Grams are printed with at most one decimal, so a reading written with two ("1.59", "1.00") is less likely.
    const cost = edits + (oneDecimal && (written.split('.')[1] ?? '').length > 1 ? 2 : 0);
    if (Number.isFinite(value) && value >= 0 && (out.get(value) ?? Infinity) > cost) out.set(value, cost);
  };
  // Grams are printed with one decimal, so "1,19" with no unit after it is most likely "1,1g" with the g read as 9:
  // that reading comes first. Salt is the exception (it has two decimals) and is read as written.
  const gAsNine = oneDecimal && !t.unit && /^\d+\.\d9$/.test(t.text);
  const variants: [string, number][] = [[t.text, gAsNine ? 1 : 0]];
  if (!t.unit && /[901478]$/.test(t.text) && t.text.replace('.', '').length >= 2)
    variants.push([t.text.slice(0, -1).replace(/\.$/, ''), gAsNine ? 0 : 1]);
  for (const [s, e] of variants) {
    add(s, e);
    if (!s.includes('.') && s.length >= 2) {
      add(`${s[0]}.${s.slice(1)}`, e + 1);
      if (s.length >= 3) add(`${s.slice(0, 2)}.${s.slice(2)}`, e + 1);
      if (s.length === 3 && s[1] === '8') add(`${s[0]}.${s[2]}`, e + 2);
    }
  }
  return [...out].map(([value, edits]) => ({ value, edits }));
}

/**
 * The amounts of a table row: the numbers after its last word. A table prints the values to the right of the
 * name, so a digit OCR left inside a garbled name ("| 2 mł io oekinko 109") is not taken for one.
 */
function rowNumbers(line: string): Token[] {
  let end = 0;
  for (const m of line.matchAll(/[a-z]{2,}/g)) if (!/^(kcal|kj|mg)$/.test(m[0])) end = m.index + m[0].length;
  return numbersIn(line.slice(end));
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

/** The energy in kcal from the energy row (and the line after it when the row was split). */
function energyFrom(lines: string[], i: number): number | undefined {
  const nums = [...numbersIn(lines[i]), ...(i + 1 < lines.length && !lineKey(lines[i + 1]) ? numbersIn(lines[i + 1]) : [])];
  const kj = nums.find((n) => n.unit === 'kj');
  // The kcal of the 100 g column is its kJ divided by 4.184. Taking the number that fits survives OCR dropping a
  // "kcal" and offering the portion column's instead.
  const fromKj = kj && nums.find((n) => n !== kj && n.unit !== 'kj' && near(n.value, kj.value / 4.184, 0.04));
  const kcal = nums.find((n) => n.unit === 'kcal');
  if (fromKj) return fromKj.value;
  if (kj) return Math.round(kj.value / 4.184);
  return kcal?.value;
}

export function readLabel(ocrText: string): LabelReading {
  const all = plain(ocrText);
  const lines = all
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let kcal: number | undefined;
  const energyAt = lines.findIndex((l) => lineKey(l) === 'energy');
  if (energyAt >= 0) kcal = energyFrom(lines, energyAt);

  // The table: lines after the energy row that carry a number, up to the net weight or the end. Ingredient
  // lines (with percentages) are not part of it.
  const table: { key: Row | null; first: Token; second?: Token }[] = [];
  for (let i = energyAt >= 0 ? energyAt + 1 : 0; i < lines.length; i++) {
    const line = lines[i];
    if (/masa netto|net weight|netto|przechowywac|najlepiej spozyc/.test(line) && table.length > 0) break;
    const key = lineKey(line);
    if (key === 'energy' || /%/.test(line)) continue;
    const nums = rowNumbers(line).filter((n) => n.unit !== 'kcal' && n.unit !== 'kj');
    if (nums.length === 0) continue;
    table.push({ key, first: nums[0], second: nums[1] });
  }

  // Rows without a readable name take the places left for them between named rows, in the fixed order. Fibre is
  // optional, so when there is one place too many it is the one left empty.
  const named: (Row | null)[] = table.map((r) => r.key as Row | null);
  for (let i = 0; i < table.length; i++) {
    if (named[i]) continue;
    let j = i;
    while (j < table.length && !named[j]) j++;
    const before = i > 0 ? ORDER.indexOf(named[i - 1] as Row) : -1;
    const after = j < table.length ? ORDER.indexOf(named[j] as Row) : ORDER.length;
    let places = ORDER.slice(before + 1, after);
    const unnamed = j - i;
    if (places.length > unnamed && places.includes('fiber')) places = places.filter((p) => p !== 'fiber');
    if (places.length === unnamed) for (let k = 0; k < unnamed; k++) named[i + k] = places[k];
    i = j;
  }

  const rows = new Map<Row, { first: Token; second?: Token }>();
  table.forEach((r, i) => {
    const key = named[i] as Row | null;
    if (key && !rows.has(key)) rows.set(key, r);
  });

  const values: Partial<Nutrients> = {};
  const plainValue = (t: Token) => (t.unit === 'mg' ? t.value / 1000 : t.value);

  // Fat, carbohydrates and protein, chosen together to fit the energy when it is known.
  const macros = (['fat', 'carbs', 'protein'] as const).filter((k) => rows.has(k));
  const fiberRow = rows.get('fiber');
  const fiber = fiberRow ? plainValue(fiberRow.first) : 0;
  if (kcal && macros.length === 3) {
    const options = macros.map((k) => readings(rows.get(k)!.first).filter((r) => r.value <= 100));
    let best: { pick: number[]; cost: number } | null = null;
    for (const f of options[0])
      for (const c of options[1])
        for (const p of options[2]) {
          if (f.value + c.value + p.value > 100) continue;
          const energy = p.value * 4 + (c.value - fiber) * 4 + fiber * 2 + f.value * 9;
          const miss = Math.abs(energy - kcal) / kcal;
          const cost = miss * 100 + (f.edits + c.edits + p.edits) * 0.5;
          if (!best || cost < best.cost) best = { pick: [f.value, c.value, p.value], cost };
        }
    // Only trusted when it fits the energy closely; otherwise the plain readings stand, flagged on the check screen.
    if (best && best.cost <= 12) macros.forEach((k, n) => (values[k] = best!.pick[n]));
  }
  // Without the energy to check against: the reading that needed the fewest repairs.
  for (const k of macros) {
    if (values[k] !== undefined) continue;
    const row = rows.get(k)!;
    values[k] = row.first.unit === 'mg' ? row.first.value / 1000 : [...readings(row.first)].sort((a, b) => a.edits - b.edits)[0].value;
  }

  // Sugars within carbohydrates, saturates within fat, salt and fibre plausible: the least repaired reading that fits.
  const within = (k: Row, limit: number) => {
    const row = rows.get(k);
    if (!row) return undefined;
    if (row.first.unit === 'mg') return row.first.value / 1000;
    const fits = readings(row.first, k !== 'salt')
      .filter((r) => r.value <= limit)
      .sort((a, b) => a.edits - b.edits);
    return fits[0]?.value ?? row.first.value;
  };
  const sugar = within('sugar', values.carbs ?? 100);
  if (sugar !== undefined) values.sugar = sugar;
  const fib = within('fiber', 50);
  if (fib !== undefined) values.fiber = fib;
  const salt = within('salt', 20);
  if (salt !== undefined) values.salt = salt;
  if (kcal !== undefined) values.kcal = kcal;

  // A stray "kcal" figure elsewhere, when no energy row was recognised.
  if (values.kcal === undefined) {
    const m = /(\d+(?:[.,]\d+)?)\s*kcal/.exec(all);
    if (m) values.kcal = parseFloat(m[1].replace(',', '.'));
  }

  const portion = portionSize(all);

  // With both columns, the portion one is a further check: a 100 g value ten or a hundred times what the portion
  // implies most likely lost its decimal comma.
  if (portion && hasPer100(all)) {
    for (const [k, row] of rows) {
      if (k === 'saturates' || !row.second || row.second.value <= 0) continue;
      const a = values[k];
      if (a === undefined) continue;
      const expected = (plainValue(row.second) * 100) / portion;
      if (near(a, expected, 0.3)) continue;
      const fixed = [a / 10, a / 100].find((c) => near(c, expected, 0.15));
      if (fixed !== undefined) values[k] = Math.round(fixed * 1000) / 1000;
    }
  }

  // Only a portion column: scale everything to 100 g.
  if (portion && !hasPer100(all)) {
    const f = 100 / portion;
    for (const k of Object.keys(values) as Key[]) values[k] = Math.round(values[k]! * f * 10) / 10;
    return { values, portionGrams: portion };
  }
  return { values };
}

/** The values a label must give for a product to be saved. */
export const REQUIRED: Key[] = ['kcal', 'protein', 'fat', 'carbs'];
