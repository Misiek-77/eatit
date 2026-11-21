import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { dateOfKey, dayKey, shiftDay } from '../../shared/date';
import { capitalize, formatGrams, formatLongDay, formatWhole } from '../../shared/format';
import { Header } from '../../shared/Header';
import { Icon } from '../../shared/Icon';
import { Sheet } from '../../shared/Sheet';
import { useToday } from '../../shared/useToday';
import { newId } from '../../shared/id';
import { copyEntries, pastMeals } from '../domain/diary';
import { dayTotals, entryNutrients, goalsForDay } from '../domain/nutrients';
import { MEALS, type DiaryEntry, type Meal } from '../domain/types';
import { useNutrition } from '../state/nutritionContext';
import { useTrainingLink } from '../state/training';
import { AmountForm, KcalRing, MacroBars, MEAL_LABEL } from './parts';

/** The diary of one day: energy and macros against the goals, and what was eaten at each meal. */
export function TodayScreen() {
  const store = useNutrition();
  const today = dayKey(useToday());
  const [params, setParams] = useSearchParams();
  const date = params.get('dzien') ?? today;
  const [editing, setEditing] = useState<DiaryEntry | null>(null);
  const [copyTo, setCopyTo] = useState<Meal | null>(null);
  const totals = dayTotals(store.entries, date);
  const { workoutDays } = useTrainingLink();
  const bonus = store.settings.trainingBonusKcal;
  const trainingDay = workoutDays.has(date);
  const goals = goalsForDay(store.settings.goals, bonus, trainingDay);
  const water = store.water.find((w) => w.date === date)?.ml ?? 0;
  const waterGoal = store.settings.waterGoalMl;
  const past = copyTo ? pastMeals(store.entries, date, copyTo) : [];
  const dayName = (key: string) => (key === shiftDay(today, -1) ? 'Wczoraj' : capitalize(formatLongDay(dateOfKey(key))));
  const go = (key: string) => setParams(key === today ? {} : { dzien: key }, { replace: true });

  return (
    <main className="screen">
      <Header>
        <Link className="icon-btn" to="/dieta/ustawienia" aria-label="Cele i ustawienia">
          <Icon name="settings" />
        </Link>
      </Header>
      <div className="day-nav">
        <button type="button" className="icon-btn" aria-label="Poprzedni dzień" onClick={() => go(shiftDay(date, -1))}>
          <Icon name="back" />
        </button>
        <div className="day-title">
          <h1 className="title">{date === today ? 'Dziś' : date === shiftDay(today, -1) ? 'Wczoraj' : capitalize(formatLongDay(dateOfKey(date)).split(',')[0])}</h1>
          <span className="muted small">{formatLongDay(dateOfKey(date))}</span>
        </div>
        <button type="button" className="icon-btn" aria-label="Następny dzień" disabled={date >= today} onClick={() => go(shiftDay(date, 1))}>
          <Icon name="forward" />
        </button>
      </div>

      {trainingDay && (
        <p className="training-day" role="note">
          <Icon name="bolt" />
          {bonus > 0 ? `Dzień treningowy: cel wyższy o ${formatWhole(bonus)} kcal (z węglowodanów).` : 'Dzień treningowy. Dodatek kalorii ustawisz w Celach.'}
        </p>
      )}
      <section className="section day-summary">
        <KcalRing eaten={totals.day.kcal} goal={goals.kcal} />
        <div className="day-summary-side">
          <p>
            <strong>{formatWhole(totals.day.kcal)}</strong> <span className="muted">/ {formatWhole(goals.kcal)} kcal</span>
          </p>
          <MacroBars totals={totals.day} goals={goals} />
        </div>
      </section>

      <section className="section water" aria-label="Woda">
        <Icon name="water" />
        <div className="water-main">
          <p>
            <strong>{formatWhole(water)}</strong> <span className="muted">/ {formatWhole(waterGoal)} ml wody</span>
          </p>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill water-fill" style={{ width: `${Math.min(100, (water / Math.max(1, waterGoal)) * 100)}%` }} />
          </span>
        </div>
        <button type="button" className="icon-btn" aria-label="Odejmij szklankę wody (250 ml)" disabled={water <= 0} onClick={() => store.setWater({ date, ml: Math.max(0, water - 250) })}>
          <Icon name="minus" />
        </button>
        <button type="button" className="btn btn-small" aria-label="Dodaj szklankę wody (250 ml)" onClick={() => store.setWater({ date, ml: water + 250 })}>
          <Icon name="plus" />
          250 ml
        </button>
      </section>

      {MEALS.map((meal) => {
        const entries = store.entries.filter((e) => e.date === date && e.meal === meal).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return (
          <section className="section meal" key={meal}>
            <div className="meal-head">
              <h2 className="label">{MEAL_LABEL[meal]}</h2>
              <span className="muted small">{formatWhole(totals.meals[meal].kcal)} kcal</span>
            </div>
            {entries.length > 0 && (
              <ul className="list">
                {entries.map((e) => {
                  const n = entryNutrients(e);
                  return (
                    <li key={e.id}>
                      <button type="button" className="item" onClick={() => setEditing(e)}>
                        <span className="item-main">
                          <span className="item-title">{e.name}</span>
                          <span className="item-sub">
                            {formatGrams(e.grams)} g · B {formatGrams(n.protein)} · T {formatGrams(n.fat)} · W {formatGrams(n.carbs)}
                          </span>
                        </span>
                        <span className="item-end">{formatWhole(n.kcal)} kcal</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="meal-actions">
              <Link className="btn btn-small btn-quiet add-food" to={`/dieta/dodaj?posilek=${meal}&dzien=${date}`}>
                <Icon name="plus" />
                Dodaj
              </Link>
              <button type="button" className="btn btn-small btn-quiet" onClick={() => setCopyTo(meal)}>
                <Icon name="copy" />
                Kopiuj
              </button>
            </div>
          </section>
        );
      })}

      <Sheet open={copyTo !== null} onClose={() => setCopyTo(null)} title={copyTo ? `Kopiuj do: ${MEAL_LABEL[copyTo].toLowerCase()}` : ''}>
        {past.length === 0 ? (
          <p className="empty">W ostatnich dwóch tygodniach nie ma posiłków do skopiowania.</p>
        ) : (
          <ul className="list">
            {past.map((p) => (
              <li key={`${p.date}-${p.meal}`}>
                <button
                  type="button"
                  className="item"
                  onClick={() => {
                    if (copyTo) store.saveEntries(copyEntries(p.entries, date, copyTo, new Date().toISOString(), newId));
                    setCopyTo(null);
                  }}
                >
                  <span className="item-main">
                    <span className="item-title">
                      {dayName(p.date)} · {MEAL_LABEL[p.meal]}
                    </span>
                    <span className="item-sub">{p.entries.map((e) => e.name).join(', ')}</span>
                  </span>
                  <span className="item-end">{formatWhole(p.totals.kcal)} kcal</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.name ?? ''}>
        {editing && (
          <AmountForm
            product={{ name: editing.name, per100: editing.per100, portions: store.products.find((p) => p.id === editing.productId)?.portions ?? [] }}
            initialGrams={editing.grams}
            submitLabel="Zapisz"
            onSubmit={(grams) => {
              store.saveEntry({ ...editing, grams });
              setEditing(null);
            }}
            onRemove={() => {
              store.removeEntry(editing.id);
              setEditing(null);
            }}
          />
        )}
      </Sheet>
    </main>
  );
}
