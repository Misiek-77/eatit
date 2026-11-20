import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { dayKey } from '../../shared/date';
import { formatWhole, searchKey } from '../../shared/format';
import { Header } from '../../shared/Header';
import { Icon } from '../../shared/Icon';
import { newId } from '../../shared/id';
import { Sheet } from '../../shared/Sheet';
import { lookupBarcode } from '../data/openFoodFacts';
import { MEALS, type Meal, type Product } from '../domain/types';
import { useNutrition } from '../state/nutritionContext';
import { BarcodeScanner } from './BarcodeScanner';
import { AmountForm, MEAL_LABEL } from './parts';
import type { ProductDraftState } from './ProductForm';

/** Picks what was eaten for a meal: from the person's products, by barcode, or as a new product. */
export function AddScreen() {
  const store = useNutrition();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const meal: Meal = (MEALS as readonly string[]).includes(params.get('posilek') ?? '') ? (params.get('posilek') as Meal) : 'snack';
  const date = params.get('dzien') ?? dayKey(new Date());
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Product | null>(() => store.products.find((p) => p.id === params.get('produkt')) ?? null);
  const [scanning, setScanning] = useState(false);
  const [looking, setLooking] = useState<string | null>(null);
  const back = `/dieta${date === dayKey(new Date()) ? '' : `?dzien=${date}`}`;

  // Products by when they were last eaten, most recent first; never-eaten ones after, favourites leading.
  const ordered = useMemo(() => {
    const lastUse = new Map<string, string>();
    for (const e of store.entries) if ((lastUse.get(e.productId) ?? '') < e.createdAt) lastUse.set(e.productId, e.createdAt);
    return [...store.products].sort(
      (a, b) =>
        Number(!!b.favorite) - Number(!!a.favorite) ||
        (lastUse.get(b.id) ?? '').localeCompare(lastUse.get(a.id) ?? '') ||
        a.name.localeCompare(b.name, 'pl'),
    );
  }, [store.products, store.entries]);
  const key = searchKey(query.trim());
  const shown = key ? ordered.filter((p) => searchKey(`${p.name} ${p.brand ?? ''}`).includes(key)) : ordered.slice(0, 30);

  const toForm = (state: ProductDraftState) => navigate('/dieta/produkt/nowy', { state: { ...state, meal, date } });

  const onCode = useCallback(
    async (code: string) => {
      setScanning(false);
      const mine = store.products.find((p) => p.barcode === code);
      if (mine) {
        setPicked(mine);
        return;
      }
      setLooking(code);
      const result = await lookupBarcode(code, new Date().toISOString());
      setLooking(null);
      if (result.kind === 'found') toForm({ draft: result.product, notice: 'Znaleziono w bazie Open Food Facts. Sprawdź wartości z etykietą i zapisz.' });
      else
        toForm({
          barcode: code,
          notice:
            result.kind === 'unknown'
              ? 'Tego produktu nie ma w bazie. Przepisz wartości z etykiety (na 100 g) — następnym razem znajdzie się od razu.'
              : 'Brak połączenia z internetem. Przepisz wartości z etykiety (na 100 g).',
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.products, meal, date],
  );

  return (
    <main className="screen">
      <Header back={back} />
      <h1 className="title">{MEAL_LABEL[meal]}</h1>
      <p className="subtitle">Dodaj produkt do posiłku</p>

      <div className="add-actions">
        <button type="button" className="btn btn-primary" onClick={() => setScanning(true)}>
          <Icon name="barcode" />
          Skanuj kod
        </button>
        <button type="button" className="btn" onClick={() => toForm({})}>
          <Icon name="plus" />
          Nowy produkt
        </button>
      </div>
      {looking && (
        <p className="note" role="status" style={{ marginTop: 12 }}>
          Szukam produktu {looking} w bazie…
        </p>
      )}

      <section className="section">
        <input className="input" type="search" placeholder="Szukaj w moich produktach" aria-label="Szukaj w moich produktach" value={query} onChange={(e) => setQuery(e.target.value)} />
        {store.products.length === 0 ? (
          <p className="empty">Nie masz jeszcze produktów. Zeskanuj kod kreskowy albo dodaj nowy produkt z etykiety.</p>
        ) : shown.length === 0 ? (
          <p className="empty">Nic nie pasuje. Zeskanuj produkt albo dodaj go ręcznie.</p>
        ) : (
          <ul className="list">
            {shown.map((p) => (
              <li key={p.id}>
                <button type="button" className="item" onClick={() => setPicked(p)}>
                  <span className="item-main">
                    <span className="item-title">
                      {p.favorite && <span aria-label="Ulubiony">★ </span>}
                      {p.name}
                    </span>
                    <span className="item-sub">
                      {p.brand ? `${p.brand} · ` : ''}
                      {formatWhole(p.per100.kcal)} kcal / 100 g
                    </span>
                  </span>
                  <span className="item-end">
                    <Icon name="plus" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={scanning} onClose={() => setScanning(false)} title="Skanuj kod kreskowy">
        {scanning && <BarcodeScanner onCode={(code) => void onCode(code)} />}
      </Sheet>
      <Sheet open={picked !== null} onClose={() => setPicked(null)} title={picked?.name ?? ''}>
        {picked && (
          <AmountForm
            product={picked}
            submitLabel={`Dodaj do: ${MEAL_LABEL[meal].toLowerCase()}`}
            onSubmit={(grams) => {
              store.saveEntry({
                id: newId(),
                date,
                meal,
                productId: picked.id,
                name: picked.brand ? `${picked.name} (${picked.brand})` : picked.name,
                grams,
                per100: picked.per100,
                createdAt: new Date().toISOString(),
              });
              navigate(back);
            }}
          />
        )}
      </Sheet>
    </main>
  );
}
