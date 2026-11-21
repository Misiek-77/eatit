import type React from 'react';
import { useState } from 'react';
import { formatGrams, formatWhole } from '../../shared/format';
import { NumberField } from '../../shared/NumberField';
import { forGrams } from '../domain/nutrients';
import type { Goals, Nutrients, Product } from '../domain/types';

export const MEAL_LABEL = { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąski' } as const;

/** Energy eaten against the goal as a ring, with what is left in the middle. */
export function KcalRing({ eaten, goal }: { eaten: number; goal: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const share = goal > 0 ? Math.min(1, eaten / goal) : 0;
  const over = goal > 0 && eaten > goal;
  const left = goal - eaten;
  return (
    <div className="kcal-ring" role="img" aria-label={`Zjedzone ${formatWhole(eaten)} z ${formatWhole(goal)} kcal`}>
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} className="kcal-ring-track" />
        {/* Nothing eaten draws nothing: a rounded line end of zero length would show as a dot. */}
        {share > 0 && <circle
          cx="60"
          cy="60"
          r={r}
          className={over ? 'kcal-ring-fill over' : 'kcal-ring-fill'}
          strokeDasharray={`${share * c} ${c}`}
          transform="rotate(-90 60 60)"
        />}
      </svg>
      <div className="kcal-ring-text">
        <strong>{formatWhole(Math.abs(left))}</strong>
        <span>{left >= 0 ? 'kcal zostało' : 'kcal ponad cel'}</span>
      </div>
    </div>
  );
}

/** Protein, fat and carbohydrates against their goals. */
export function MacroBars({ totals, goals }: { totals: Nutrients; goals: Goals }) {
  const rows = [
    ['Białko', totals.protein, goals.protein],
    ['Tłuszcz', totals.fat, goals.fat],
    ['Węglowodany', totals.carbs, goals.carbs],
  ] as const;
  return (
    <ul className="bars macro-bars">
      {rows.map(([label, value, goal]) => (
        <li key={label} className="bar-row">
          <span className="bar-name">{label}</span>
          <span className="bar-track" aria-hidden="true">
            <span className={value > goal ? 'bar-fill over' : 'bar-fill'} style={{ width: `${goal > 0 ? Math.min(100, (value / goal) * 100) : 0}%` }} />
          </span>
          <span className="bar-value">
            {formatGrams(value)} / {formatWhole(goal)} g
          </span>
        </li>
      ))}
    </ul>
  );
}

/** "372 kcal · B 13,5 · T 7 · W 58,7" */
export const nutrientLine = (n: Nutrients) =>
  `${formatWhole(n.kcal)} kcal · B ${formatGrams(n.protein)} · T ${formatGrams(n.fat)} · W ${formatGrams(n.carbs)}`;

/** Asks how much of a product was eaten, in grams or the product's portions, and shows what that amounts to. */
export function AmountForm({
  product,
  initialGrams,
  submitLabel,
  onSubmit,
  onRemove,
}: {
  product: Pick<Product, 'name' | 'per100' | 'portions'>;
  initialGrams?: number;
  submitLabel: string;
  onSubmit(grams: number): void;
  onRemove?(): void;
}) {
  const [grams, setGrams] = useState(initialGrams ?? product.portions[0]?.grams ?? 100);
  const n = forGrams(product.per100, grams);
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (grams > 0) onSubmit(grams);
      }}
    >
      <label className="field">
        <span>Ile zjadłeś (g)</span>
        <NumberField label="Ilość w gramach" value={grams} onChange={setGrams} />
      </label>
      <div className="chips" role="group" aria-label="Szybki wybór">
        {product.portions.map((p) => (
          <button key={p.name} type="button" className="chip" aria-pressed={grams === p.grams} onClick={() => setGrams(p.grams)}>
            {p.name} ({formatGrams(p.grams)} g)
          </button>
        ))}
        {[50, 100, 150, 200].map((g) => (
          <button key={g} type="button" className="chip" aria-pressed={grams === g} onClick={() => setGrams(g)}>
            {g} g
          </button>
        ))}
      </div>
      <div className="amount-preview" role="status">
        <div>
          <strong>{formatWhole(n.kcal)}</strong> kcal
        </div>
        <div>B {formatGrams(n.protein)} g</div>
        <div>T {formatGrams(n.fat)} g</div>
        <div>W {formatGrams(n.carbs)} g</div>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={!(grams > 0)}>
        {submitLabel}
      </button>
      {onRemove && (
        <button type="button" className="btn btn-danger btn-quiet btn-block" onClick={onRemove}>
          Usuń z dziennika
        </button>
      )}
    </form>
  );
}

/** An illustration with a short message, for screens with nothing on them yet. */
export function EmptyArt({ image, title, children }: { image: 'meal' | 'products' | 'progress'; title: string; children?: React.ReactNode }) {
  return (
    <figure className="empty-art">
      <img src={`illustrations/${image}.jpg`} alt="" width={480} height={511} loading="lazy" />
      <figcaption>
        <strong>{title}</strong>
        {children && <span>{children}</span>}
      </figcaption>
    </figure>
  );
}
