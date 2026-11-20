const whole = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 });
const longDay = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

/** "1 850" */
export const formatWhole = (n: number) => whole.format(Math.round(n));
/** "12,5" — up to one decimal, for grams of macronutrients. */
export const formatGrams = (n: number) => oneDecimal.format(Math.round(n * 10) / 10);
/** "piątek, 20 listopada" */
export const formatLongDay = (date: Date) => longDay.format(date);
/** "Nogi" from "nogi". */
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Polish plural: plural(5, 'produkt', 'produkty', 'produktów') → "5 produktów". */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = n === 1 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${n} ${word}`;
}

/** Lowercased, without diacritics, for forgiving search. */
export function searchKey(text: string): string {
  return text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '');
}
