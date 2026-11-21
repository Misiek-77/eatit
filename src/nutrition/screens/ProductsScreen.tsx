import { useState } from 'react';
import { Link } from 'react-router-dom';
import { plural, searchKey } from '../../shared/format';
import { Header } from '../../shared/Header';
import { Icon } from '../../shared/Icon';
import { useNutrition } from '../state/nutritionContext';
import { nutrientLine } from './parts';

/** The person's own product list: everything scanned or typed in, to edit or remove. */
export function ProductsScreen() {
  const { products } = useNutrition();
  const [query, setQuery] = useState('');
  const key = searchKey(query.trim());
  const shown = products
    .filter((p) => !key || searchKey(`${p.name} ${p.brand ?? ''}`).includes(key))
    .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || a.name.localeCompare(b.name, 'pl'));

  return (
    <main className="screen">
      <Header>
        <Link className="icon-btn" to="/dieta/produkt/nowy" aria-label="Nowy produkt">
          <Icon name="plus" />
        </Link>
      </Header>
      <h1 className="title">Moje produkty</h1>
      <p className="subtitle">
        {products.length === 0
          ? 'Zeskanowane i dodane produkty pojawią się tutaj. Z produktów złożysz też własne dania.'
          : plural(products.length, 'pozycja', 'pozycje', 'pozycji')}
      </p>
      <div className="add-actions">
        <Link className="btn" to="/dieta/produkt/nowy">
          <Icon name="plus" />
          Nowy produkt
        </Link>
        <Link className="btn" to="/dieta/danie/nowe">
          <Icon name="dish" />
          Nowe danie
        </Link>
      </div>
      <section className="section">
        <input className="input" type="search" placeholder="Szukaj" aria-label="Szukaj produktu" value={query} onChange={(e) => setQuery(e.target.value)} />
        <ul className="list">
          {shown.map((p) => (
            <li key={p.id}>
              <Link className="item" to={`/dieta/produkt/${p.id}`}>
                <span className="item-main">
                  <span className="item-title">
                    {p.favorite && <span aria-label="Ulubiony">★ </span>}
                    {p.name}
                    {p.ingredients && <span className="muted"> · danie</span>}
                    {p.brand && <span className="muted"> · {p.brand}</span>}
                  </span>
                  <span className="item-sub">{nutrientLine(p.per100)} na 100 g</span>
                </span>
                <span className="item-end">
                  <Icon name="forward" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {products.length > 0 && shown.length === 0 && <p className="empty">Nic nie pasuje do „{query}”.</p>}
      </section>
    </main>
  );
}
