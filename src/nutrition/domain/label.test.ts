import { describe, expect, it } from 'vitest';
import { readLabel } from './label';

describe('reading a food label', () => {
  it('reads a clean Polish table, taking the 100 g column', () => {
    const text = `Wartość odżywcza          w 100 g    w porcji (30 g)
Wartość energetyczna      1550 kJ / 370 kcal    465 kJ / 111 kcal
Tłuszcz                   12 g      3,6 g
w tym kwasy tłuszczowe nasycone   3,1 g   0,9 g
Węglowodany               50 g      15 g
w tym cukry               8,2 g     2,5 g
Błonnik                   6 g       1,8 g
Białko                    10 g      3 g
Sól                       0,9 g     0,27 g`;
    expect(readLabel(text)).toEqual({ values: { kcal: 370, fat: 12, carbs: 50, sugar: 8.2, fiber: 6, protein: 10, salt: 0.9 } });
  });

  it('forgives typical OCR mistakes: misread letters, O for 0, energy split over two lines', () => {
    const text = `WARTOSC ODZYWCZA W 100 g
Wartosc energetyczna 1674 kJ
4OO kcal
Tłuszez 2O,5 g
w tym kwasy tluszczowe nasycone 5,1 g
Weglowodany 45,O g
w tym cukry 30 g
Biatko 6,4 g
Só1 O,12 g`;
    const { values } = readLabel(text);
    expect(values).toMatchObject({ kcal: 400, fat: 20.5, carbs: 45, sugar: 30, protein: 6.4 });
  });

  it('works out kcal from kJ when kcal is missing, and reads English rows', () => {
    const text = `Nutrition per 100 g
Energy 1046 kJ
Fat 9 g
of which saturates 2 g
Carbohydrate 30 g
of which sugars 3 g
Protein 8 g
Salt 1,2 g`;
    expect(readLabel(text).values).toEqual({ kcal: 250, fat: 9, carbs: 30, sugar: 3, protein: 8, salt: 1.2 });
  });

  it('scales a label that only gives a portion to 100 g', () => {
    const text = `Wartość odżywcza w porcji (25 g)
Wartość energetyczna 100 kcal
Tłuszcz 5 g
Węglowodany 10 g
Białko 2,5 g`;
    expect(readLabel(text)).toEqual({ values: { kcal: 400, fat: 20, carbs: 40, protein: 10 }, portionGrams: 25 });
  });

  it('leaves out what it cannot find instead of guessing', () => {
    expect(readLabel('Skład: mąka pszenna, cukier, sól\nNajlepiej spożyć przed: 12.2027').values).toEqual({});
  });
});

describe('repairing a real OCR reading with both columns', () => {
  // What Tesseract actually returned for a test photo: "kcal" lost after 372, decimal commas lost in "1,1 g" and
  // in the portion column.
  const text = `Wartość odżywcza w 100g w porcji (40 g)
Wartość energetyczna 1557 kJ / 372 628IkJ / 149 kcal
Tłuszcz 7,0g 289g

w tym kwasy tłuszczowe nasycone 1,2g 0,5g
Węglowodany 58,7, g 23,5g

w tym cukry 11g 0,4g

Błonnik 10g 4,0g

Białko 13,5 g 5,49

Sól 0,01 g <0,01 g`;

  it('takes the kcal that matches the kJ of the 100 g column', () => {
    expect(readLabel(text).values.kcal).toBe(372);
  });

  it('puts back a lost decimal comma when the portion column shows the value was ten times smaller', () => {
    expect(readLabel(text).values.sugar).toBe(1.1);
  });

  it('keeps values the portion column cannot help with, or that already agree', () => {
    expect(readLabel(text).values).toMatchObject({ fat: 7, carbs: 58.7, fiber: 10, protein: 13.5, salt: 0.01 });
  });
});

describe('a "g" read as 9', () => {
  it('drops the 9 from a two-decimal number with no unit after it', () => {
    const text = `Wartość odżywcza w 100 g w porcji (40 g)
w tym cukry 1,19 0,4g
Białko 13,59 5,49
Sól 0,08 g 0,03 g`;
    expect(readLabel(text).values).toEqual({ sugar: 1.1, protein: 13.5, salt: 0.08 });
  });
});
