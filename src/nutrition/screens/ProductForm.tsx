import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { formatWhole } from '../../shared/format';
import { Header } from '../../shared/Header';
import { Icon } from '../../shared/Icon';
import { newId } from '../../shared/id';
import { NumberField } from '../../shared/NumberField';
import { Confirm } from '../../shared/Sheet';
import { kcalFromMacros, looksWrong } from '../domain/nutrients';
import type { Meal, Nutrients, Portion, Product } from '../domain/types';
import { useNutrition } from '../state/nutritionContext';
import { foundList, LabelPhoto } from './LabelPhoto';

/** What the add screen hands over when it opens this form. */
export interface ProductDraftState {
  /** A product found in Open Food Facts, to be checked against the label. */
  draft?: Product;
  /** A scanned code that is not in the database yet. */
  barcode?: string;
  /** A line about where the values came from. */
  notice?: string;
  /** Values read from a photographed label, per 100 g. */
  label?: Partial<Nutrients>;
  /** The text the label reader saw, shown on request to check odd values. */
  ocrText?: string;
  /** When set, saving goes on to ask how much of it was eaten at this meal. */
  meal?: Meal;
  date?: string;
}

const FIELDS: [keyof Nutrients, string, boolean][] = [
  ['kcal', 'Energia (kcal)', true],
  ['protein', 'Białko (g)', true],
  ['fat', 'Tłuszcz (g)', true],
  ['carbs', 'Węglowodany (g)', true],
  ['fiber', 'Błonnik (g)', false],
  ['sugar', 'w tym cukry (g)', false],
  ['salt', 'Sól (g)', false],
];

/** Creates or edits a product. Also the check screen after a scan: values come pre-filled and can be corrected. */
export function ProductForm() {
  const { id } = useParams();
  const store = useNutrition();
  const state = (useLocation().state ?? {}) as ProductDraftState;
  const existing = store.products.find((p) => p.id === id);
  if (id !== 'nowy' && !existing) return <Navigate to="/dieta/produkty" replace />;
  // A dish has its own form, worked out from its ingredients.
  if (existing?.ingredients) return <Navigate to={`/dieta/danie/${existing.id}`} replace state={state} />;
  return <Form key={id} existing={existing} state={state} />;
}

function Form({ existing, state }: { existing?: Product; state: ProductDraftState }) {
  const store = useNutrition();
  const navigate = useNavigate();
  const start = existing ?? state.draft;
  const [name, setName] = useState(start?.name ?? '');
  const [brand, setBrand] = useState(start?.brand ?? '');
  const [per100, setPer100] = useState<Nutrients>(start?.per100 ?? { kcal: 0, protein: 0, fat: 0, carbs: 0, ...state.label });
  const [ocrText, setOcrText] = useState(state.ocrText);
  const [labelNotice, setLabelNotice] = useState<string | null>(null);
  const [portions, setPortions] = useState<Portion[]>(start?.portions ?? []);
  const [favorite, setFavorite] = useState(start?.favorite ?? false);
  const [removing, setRemoving] = useState(false);
  const barcode = start?.barcode ?? state.barcode;
  const valid = name.trim() !== '' && per100.kcal > 0 && portions.every((p) => p.name.trim() && p.grams > 0);
  const suspicious = per100.kcal > 0 && looksWrong(per100);

  function save() {
    const product: Product = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      ...(barcode ? { barcode } : {}),
      per100,
      portions: portions.map((p) => ({ name: p.name.trim(), grams: p.grams })),
      source: existing?.source ?? state.draft?.source ?? (ocrText ? 'label' : 'manual'),
      ...(favorite ? { favorite: true } : {}),
      updatedAt: new Date().toISOString(),
    };
    store.saveProduct(product);
    if (state.meal && state.date) navigate(`/dieta/dodaj?posilek=${state.meal}&dzien=${state.date}&produkt=${product.id}`, { replace: true });
    else navigate('/dieta/produkty');
  }

  return (
    <main className="screen">
      <Header back={state.meal ? `/dieta/dodaj?posilek=${state.meal}&dzien=${state.date}` : '/dieta/produkty'}>
        {existing && (
          <button type="button" className="icon-btn" aria-label="Usuń produkt" onClick={() => setRemoving(true)}>
            <Icon name="trash" />
          </button>
        )}
      </Header>
      <h1 className="title">{existing ? 'Edytuj produkt' : 'Nowy produkt'}</h1>
      {state.notice && !existing && <p className="note" style={{ marginTop: 12 }}>{state.notice}</p>}

      <form
        className="section stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save();
        }}
      >
        <label className="field">
          <span>Nazwa</span>
          <input className="input" value={name} maxLength={80} placeholder="np. Płatki owsiane" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Marka (opcjonalnie)</span>
          <input className="input" value={brand} maxLength={60} onChange={(e) => setBrand(e.target.value)} />
        </label>
        {barcode && <p className="muted small">Kod kreskowy: {barcode}</p>}

        <h2 className="label">Wartość odżywcza w 100 g</h2>
        <LabelPhoto
          label="Wypełnij ze zdjęcia etykiety"
          className="btn btn-small"
          onRead={(reading, text) => {
            // Values found replace what is in the fields; anything not found stays as it was.
            setPer100((n) => ({ ...n, ...reading.values }));
            setOcrText(text);
            const { found, missing } = foundList(reading);
            setLabelNotice(found ? `Odczytano: ${found}.${missing ? ` Nie znaleziono: ${missing}.` : ''} Sprawdź z etykietą.` : 'Nie znaleziono wartości na zdjęciu.');
          }}
        />
        {labelNotice && <p className="note" role="status">{labelNotice}</p>}
        <div className="measure-grid">
          {FIELDS.map(([key, label, required]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <NumberField
                label={`${label} w 100 g`}
                value={per100[key] ?? 0}
                onChange={(v) =>
                  setPer100((n) => {
                    const next = { ...n, [key]: v };
                    // Optional values left at zero are not stored at all.
                    if (!required && v === 0) delete next[key];
                    return next;
                  })
                }
              />
            </label>
          ))}
        </div>
        {suspicious && (
          <p className="note error" role="status">
            Kalorie nie zgadzają się z makro: z białka, tłuszczu i węglowodanów wychodzi około {formatWhole(kcalFromMacros(per100))} kcal. Sprawdź, czy
            wszystko przepisane jest dobrze.
          </p>
        )}

        {ocrText && (
          <details className="disclosure">
            <summary>Tekst odczytany ze zdjęcia</summary>
            <pre className="ocr-text">{ocrText.trim() || '(pusty)'}</pre>
          </details>
        )}

        <h2 className="label">Porcje</h2>
        <p className="muted small">Np. „1 kromka” = 35 g albo „1 opakowanie” = 150 g. Ułatwiają wpisywanie ilości.</p>
        {portions.map((p, i) => (
          <div className="portion-row" key={i}>
            <input
              className="input"
              aria-label={`Porcja ${i + 1}: nazwa`}
              placeholder="np. 1 kromka"
              value={p.name}
              maxLength={40}
              onChange={(e) => setPortions((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <NumberField label={`Porcja ${i + 1}: gramy`} value={p.grams} onChange={(grams) => setPortions((list) => list.map((x, j) => (j === i ? { ...x, grams } : x)))} />
            <span className="muted small">g</span>
            <button type="button" className="icon-btn" aria-label={`Usuń porcję ${i + 1}`} onClick={() => setPortions((list) => list.filter((_, j) => j !== i))}>
              <Icon name="close" />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-small btn-quiet" onClick={() => setPortions((list) => [...list, { name: '', grams: 0 }])}>
          <Icon name="plus" />
          Dodaj porcję
        </button>

        <label className="item" style={{ minHeight: 0, padding: 0 }}>
          <span className="item-main">Ulubiony (zawsze na górze listy)</span>
          <input type="checkbox" className="switch" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} />
        </label>

        <button type="submit" className="btn btn-primary btn-block" disabled={!valid}>
          {state.meal ? 'Zapisz i wybierz ilość' : 'Zapisz produkt'}
        </button>
      </form>

      <Confirm
        open={removing}
        onClose={() => setRemoving(false)}
        onConfirm={() => {
          if (existing) store.removeProduct(existing.id);
          navigate('/dieta/produkty');
        }}
        title="Usunąć produkt?"
        message="Produkt zniknie z listy. Wpisy w dzienniku, w których był użyty, zostaną bez zmian."
        confirmLabel="Usuń produkt"
      />
    </main>
  );
}
