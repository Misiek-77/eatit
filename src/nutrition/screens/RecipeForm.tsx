import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { formatGrams, formatWhole, searchKey } from '../../shared/format';
import { Header } from '../../shared/Header';
import { Icon } from '../../shared/Icon';
import { newId } from '../../shared/id';
import { NumberField } from '../../shared/NumberField';
import { Confirm, Sheet } from '../../shared/Sheet';
import { ingredientGrams, recipePer100, recipeTotals } from '../domain/recipe';
import type { Ingredient, Meal, Product } from '../domain/types';
import { useNutrition } from '../state/nutritionContext';
import { nutrientLine } from './parts';

const PORTION = '1 porcja';

/** Creates or edits a dish made of the person's products; its values per 100 g are worked out from them. */
export function RecipeForm() {
  const { id } = useParams();
  const store = useNutrition();
  const state = (useLocation().state ?? {}) as { meal?: Meal; date?: string };
  const existing = store.products.find((p) => p.id === id);
  if (id !== 'nowe' && !existing) return <Navigate to="/dieta/produkty" replace />;
  return <Form key={id} existing={existing} meal={state.meal} date={state.date} />;
}

function Form({ existing, meal, date }: { existing?: Product; meal?: Meal; date?: string }) {
  const store = useNutrition();
  const navigate = useNavigate();
  const [name, setName] = useState(existing?.name ?? '');
  // Ingredients take their products' current values, so a corrected product corrects the dish on the next save.
  const [ingredients, setIngredients] = useState<Ingredient[]>(() =>
    (existing?.ingredients ?? []).map((i) => {
      const p = store.products.find((x) => x.id === i.productId);
      return p ? { ...i, name: p.name, per100: p.per100 } : i;
    }),
  );
  const [cooked, setCooked] = useState(existing?.cookedGrams ?? 0);
  const portion = existing?.portions.find((p) => p.name === PORTION);
  const rawWeight = ingredientGrams(existing?.ingredients ?? []);
  const [servings, setServings] = useState(portion ? Math.round((existing?.cookedGrams || rawWeight) / portion.grams) : 0);
  const [favorite, setFavorite] = useState(existing?.favorite ?? false);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState('');
  const [removing, setRemoving] = useState(false);

  const weight = cooked > 0 ? cooked : ingredientGrams(ingredients);
  const totals = recipeTotals(ingredients);
  const per100 = recipePer100(ingredients, cooked);
  const valid = name.trim() !== '' && ingredients.length > 0 && ingredients.every((i) => i.grams > 0) && per100.kcal > 0;
  const key = searchKey(query.trim());
  const choices = store.products
    .filter((p) => p.id !== existing?.id && (!key || searchKey(`${p.name} ${p.brand ?? ''}`).includes(key)))
    .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || a.name.localeCompare(b.name, 'pl'));

  function save() {
    const product: Product = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      per100,
      portions: [
        ...(servings > 0 ? [{ name: PORTION, grams: Math.round(weight / servings) }] : []),
        { name: 'całe danie', grams: Math.round(weight) },
      ],
      source: 'recipe',
      ingredients,
      ...(cooked > 0 ? { cookedGrams: cooked } : {}),
      ...(favorite ? { favorite: true } : {}),
      updatedAt: new Date().toISOString(),
    };
    store.saveProduct(product);
    if (meal && date) navigate(`/dieta/dodaj?posilek=${meal}&dzien=${date}&produkt=${product.id}`, { replace: true });
    else navigate('/dieta/produkty');
  }

  return (
    <main className="screen">
      <Header back={meal ? `/dieta/dodaj?posilek=${meal}&dzien=${date}` : '/dieta/produkty'}>
        {existing && (
          <button type="button" className="icon-btn" aria-label="Usuń danie" onClick={() => setRemoving(true)}>
            <Icon name="trash" />
          </button>
        )}
      </Header>
      <h1 className="title">{existing ? 'Edytuj danie' : 'Nowe danie'}</h1>
      <p className="subtitle">Złóż danie z produktów, a wartości policzą się same.</p>

      <form
        className="section stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save();
        }}
      >
        <label className="field">
          <span>Nazwa</span>
          <input className="input" value={name} maxLength={80} placeholder="np. Owsianka z bananem" onChange={(e) => setName(e.target.value)} />
        </label>

        <h2 className="label">Składniki</h2>
        {ingredients.length === 0 && <p className="muted small">Dodaj produkty, z których robisz danie, i ile każdego idzie.</p>}
        {ingredients.map((ing, i) => (
          <div className="dish-row" key={`${ing.productId}-${i}`}>
            <span className="item-main">
              <span className="item-title">{ing.name}</span>
              <span className="item-sub">{formatWhole((ing.per100.kcal * ing.grams) / 100)} kcal</span>
            </span>
            <NumberField
              label={`${ing.name}: gramy`}
              value={ing.grams}
              onChange={(grams) => setIngredients((list) => list.map((x, j) => (j === i ? { ...x, grams } : x)))}
            />
            <span className="muted small">g</span>
            <button type="button" className="icon-btn" aria-label={`Usuń składnik: ${ing.name}`} onClick={() => setIngredients((list) => list.filter((_, j) => j !== i))}>
              <Icon name="close" />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-small" onClick={() => setPicking(true)} disabled={store.products.length === 0}>
          <Icon name="plus" />
          Dodaj składnik
        </button>
        {store.products.length === 0 && <p className="muted small">Najpierw dodaj produkty: zeskanuj je albo wpisz ręcznie.</p>}

        <div className="measure-grid">
          <label className="field">
            <span>Waga gotowego dania (g)</span>
            <NumberField label="Waga gotowego dania w gramach" value={cooked} onChange={setCooked} />
          </label>
          <label className="field">
            <span>Liczba porcji</span>
            <NumberField integer label="Liczba porcji" value={servings} onChange={setServings} />
          </label>
        </div>
        <p className="muted small">
          Zważ garnek po ugotowaniu (bez garnka), gdy woda zmienia wagę, np. przy makaronie czy ryżu. Puste pole: suma składników
          {ingredients.length > 0 && ` (${formatWhole(ingredientGrams(ingredients))} g)`}.
        </p>

        {ingredients.length > 0 && (
          <div className="note" role="status">
            <strong>Całe danie ({formatWhole(weight)} g):</strong> {nutrientLine(totals)}
            <br />
            <strong>Na 100 g:</strong> {nutrientLine(per100)}
            {servings > 0 && (
              <>
                <br />
                <strong>Porcja ({formatWhole(weight / servings)} g):</strong> {formatWhole(totals.kcal / servings)} kcal · B {formatGrams(totals.protein / servings)}
              </>
            )}
          </div>
        )}

        <label className="item" style={{ minHeight: 0, padding: 0 }}>
          <span className="item-main">Ulubione (zawsze na górze listy)</span>
          <input type="checkbox" className="switch" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={!valid}>
          {meal ? 'Zapisz i wybierz ilość' : 'Zapisz danie'}
        </button>
      </form>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Dodaj składnik">
        <input className="input" type="search" placeholder="Szukaj" aria-label="Szukaj składnika" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul className="list">
          {choices.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="item"
                onClick={() => {
                  setIngredients((list) => [...list, { productId: p.id, name: p.brand ? `${p.name} (${p.brand})` : p.name, grams: p.portions[0]?.grams ?? 100, per100: p.per100 }]);
                  setPicking(false);
                  setQuery('');
                }}
              >
                <span className="item-main">
                  <span className="item-title">{p.name}</span>
                  <span className="item-sub">{nutrientLine(p.per100)} na 100 g</span>
                </span>
                <span className="item-end">
                  <Icon name="plus" />
                </span>
              </button>
            </li>
          ))}
        </ul>
        {choices.length === 0 && <p className="empty">Nic nie pasuje.</p>}
      </Sheet>

      <Confirm
        open={removing}
        onClose={() => setRemoving(false)}
        onConfirm={() => {
          if (existing) store.removeProduct(existing.id);
          navigate('/dieta/produkty');
        }}
        title="Usunąć danie?"
        message="Danie zniknie z listy. Wpisy w dzienniku zostaną bez zmian."
        confirmLabel="Usuń danie"
      />
    </main>
  );
}
