import { useMemo, useState } from 'react';
import { dayKey, shiftDay } from '../../shared/date';
import { formatDayMonth, formatGrams, formatShortDay, formatWhole } from '../../shared/format';
import { Header } from '../../shared/Header';
import { Icon } from '../../shared/Icon';
import { newId } from '../../shared/id';
import { NumberField } from '../../shared/NumberField';
import { Confirm } from '../../shared/Sheet';
import { useToday } from '../../shared/useToday';
import { goalsForDay } from '../domain/nutrients';
import { WEIGHT_PLANS, type WeightEntry, type WeightPlan } from '../domain/types';
import { weekStart, weekSummary, type WeekDay } from '../domain/week';
import { mergeWeights, trendLine, verdict, weeklyChange, type WeightPoint } from '../domain/weight';
import { useNutrition } from '../state/nutritionContext';
import { useTrainingLink } from '../state/training';
import { MacroBars } from './parts';

const PLAN_LABEL: Record<WeightPlan, string> = { lose: 'Chudnę', keep: 'Utrzymuję', gain: 'Buduję masę' };
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatGrams(Math.abs(n))}`;

/** The week at a glance (energy, macros, water) and the body weight trend. */
export function ProgressScreen() {
  const store = useNutrition();
  const today = dayKey(useToday());
  const link = useTrainingLink();
  const [monday, setMonday] = useState(() => weekStart(today));
  const { goals, trainingBonusKcal } = store.settings;
  const week = weekSummary(store.entries, store.water, monday, today, (d) => goalsForDay(goals, trainingBonusKcal, link.workoutDays.has(d)));
  const current = monday === weekStart(today);
  const sunday = shiftDay(monday, 6);

  return (
    <main className="screen">
      <Header />
      <h1 className="title">Postępy</h1>

      <section className="section">
        <div className="week-nav">
          <button type="button" className="icon-btn" aria-label="Poprzedni tydzień" onClick={() => setMonday(shiftDay(monday, -7))}>
            <Icon name="back" />
          </button>
          <h2>{current ? 'Ten tydzień' : `${formatDayMonth(monday)} – ${formatDayMonth(sunday)}`}</h2>
          <button type="button" className="icon-btn" aria-label="Następny tydzień" disabled={current} onClick={() => setMonday(shiftDay(monday, 7))}>
            <Icon name="forward" />
          </button>
        </div>
        <WeekChart days={week.days} monday={monday} />
        {week.average ? (
          <>
            <div className="stats" style={{ marginTop: 12 }}>
              <Stat value={formatWhole(week.average.kcal)} unit="kcal" label="Średnio dziennie" />
              <Stat value={`${week.kcalDays}/${week.loggedDays}`} label="Dni w celu kalorii (±10%)" />
              <Stat value={`${week.proteinDays}/${week.loggedDays}`} label="Dni z celem białka" />
            </div>
            <h3 className="label" style={{ marginTop: 16 }}>
              Makro średnio dziennie
            </h3>
            <MacroBars totals={week.average} goals={goals} />
            <p className="muted small" style={{ marginTop: 8 }}>
              Liczone z {week.loggedDays === 1 ? '1 dnia' : `${week.loggedDays} dni`} z wpisami.
              {week.averageWaterMl > 0 && ` Woda średnio ${formatWhole(week.averageWaterMl)} ml dziennie.`}
            </p>
          </>
        ) : (
          <p className="empty">W tym tygodniu nic nie zostało zapisane.</p>
        )}
      </section>

      <WeightSection today={today} fromTraining={link.weights} />
    </main>
  );
}

function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div>
      <div className="stat-value">
        {value} {unit && <small>{unit}</small>}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

/** Energy of each day of the week as bars, with each day's goal as a tick. */
function WeekChart({ days, monday }: { days: WeekDay[]; monday: string }) {
  const W = 320;
  const H = 140;
  const top = 12;
  const bottom = 22;
  const inner = H - top - bottom;
  const max = Math.max(1, ...days.map((d) => Math.max(d.totals.kcal, d.goals.kcal)));
  const slot = W / 7;
  const y = (kcal: number) => top + inner - (kcal / max) * inner;
  const letters = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
  const label = days.map((d) => `${formatShortDay(d.date)}: ${formatWhole(d.totals.kcal)} z ${formatWhole(d.goals.kcal)} kcal`).join(', ');
  return (
    <svg className="chart week-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label || 'Brak dni'}>
      <line x1={0} x2={W} y1={top + inner} y2={top + inner} stroke="var(--line)" />
      {letters.map((l, i) => {
        const d = days.find((x) => x.date === shiftDay(monday, i));
        const x = i * slot + slot * 0.2;
        const w = slot * 0.6;
        const over = d && d.totals.kcal > d.goals.kcal * 1.1;
        return (
          <g key={l}>
            {d && d.totals.kcal > 0 && (
              <rect x={x} y={y(d.totals.kcal)} width={w} height={top + inner - y(d.totals.kcal)} rx={4} fill={over ? 'var(--danger)' : 'var(--accent)'} />
            )}
            {d && <line x1={x - 3} x2={x + w + 3} y1={y(d.goals.kcal)} y2={y(d.goals.kcal)} stroke="var(--ink)" strokeWidth={2} strokeDasharray="3 2" />}
            <text x={x + w / 2} y={H - 6} textAnchor="middle">
              {l}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function WeightSection({ today, fromTraining }: { today: string; fromTraining: WeightPoint[] }) {
  const store = useNutrition();
  const mine = store.weights.find((w) => w.date === today);
  const [kg, setKg] = useState(0);
  const [removing, setRemoving] = useState<WeightEntry | null>(null);
  const points = useMemo(() => mergeWeights(store.weights, fromTraining), [store.weights, fromTraining]);
  const ownDates = new Set(store.weights.map((w) => w.date));
  const latest = points.at(-1);
  const change = weeklyChange(points);
  const plan = store.settings.weightPlan;
  const judged = change !== null && latest ? verdict(change, latest.kg, plan) : null;
  const recent = points.filter((p) => p.date >= shiftDay(today, -90));

  function save() {
    if (!(kg > 0)) return;
    store.saveWeight({ id: mine?.id ?? newId(), date: today, kg, updatedAt: new Date().toISOString() });
    setKg(0);
  }

  return (
    <section className="section">
      <h2 className="label">Masa ciała</h2>
      <form
        className="weight-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="field">
          <span>{mine ? `Dziś: ${formatGrams(mine.kg)} kg. Popraw` : 'Dzisiejsza waga (kg)'}</span>
          <NumberField label="Dzisiejsza waga w kg" value={kg} onChange={setKg} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={!(kg > 0)}>
          Zapisz
        </button>
      </form>
      <p className="muted small" style={{ marginTop: 6 }}>
        Najlepiej rano, na czczo. Waga zapisana w Treningu też się tu liczy.
      </p>

      <div className="chips" role="group" aria-label="Cel" style={{ marginTop: 12 }}>
        {WEIGHT_PLANS.map((p) => (
          <button key={p} type="button" className="chip" aria-pressed={plan === p} onClick={() => store.saveSettings({ ...store.settings, weightPlan: p })}>
            {PLAN_LABEL[p]}
          </button>
        ))}
      </div>

      {latest ? (
        <>
          <div className="stats" style={{ marginTop: 16 }}>
            <Stat value={formatGrams(latest.kg)} unit="kg" label={formatShortDay(latest.date)} />
            <Stat value={change === null ? '—' : signed(change)} unit={change === null ? undefined : 'kg'} label="Na tydzień (średnia 7 dni)" />
            <span />
          </div>
          {recent.length > 1 && <WeightChart points={recent} />}
          {judged ? (
            <p className={judged.tone === 'good' ? 'note verdict' : 'note error verdict'} role="status">
              {judged.text}
            </p>
          ) : (
            <p className="muted small verdict">Tempo zmian pokaże się po około 10 dniach ważenia.</p>
          )}
          <ul className="list" style={{ marginTop: 8 }}>
            {[...points]
              .reverse()
              .slice(0, 10)
              .map((p) => {
                const own = ownDates.has(p.date) ? store.weights.find((w) => w.date === p.date) : undefined;
                return (
                  <li key={p.date}>
                    <div className="item">
                      <span className="item-main">
                        <span className="item-title">{formatGrams(p.kg)} kg</span>
                        <span className="item-sub">
                          {formatShortDay(p.date)}
                          {!own && ' · z Treningu'}
                        </span>
                      </span>
                      {own && (
                        <button type="button" className="icon-btn" aria-label={`Usuń wagę z dnia ${formatShortDay(p.date)}`} onClick={() => setRemoving(own)}>
                          <Icon name="trash" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
          </ul>
        </>
      ) : (
        <p className="empty">Brak pomiarów wagi.</p>
      )}

      <Confirm
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && store.removeWeight(removing.id)}
        title="Usunąć wagę?"
        message="Pomiar zniknie z listy i z wykresu."
        confirmLabel="Usuń"
      />
    </section>
  );
}

/** Daily readings as dots and their 7-day average as a line. */
function WeightChart({ points }: { points: WeightPoint[] }) {
  const W = 320;
  const H = 150;
  const pad = { top: 14, right: 10, bottom: 22, left: 10 };
  const trend = trendLine(points);
  const values = [...points.map((p) => p.kg), ...trend.map((p) => p.kg)];
  const min = Math.min(...values) - 0.3;
  const max = Math.max(...values) + 0.3;
  const first = new Date(points[0].date).getTime();
  const span = Math.max(1, new Date(points.at(-1)!.date).getTime() - first);
  const x = (date: string) => pad.left + ((new Date(date).getTime() - first) / span) * (W - pad.left - pad.right);
  const y = (kg: number) => pad.top + (1 - (kg - min) / (max - min)) * (H - pad.top - pad.bottom);
  const path = trend.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(' ');
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Wykres wagi od ${formatGrams(points[0].kg)} kg (${formatShortDay(points[0].date)}) do ${formatGrams(points.at(-1)!.kg)} kg`}
    >
      <line x1={pad.left} x2={W - pad.right} y1={H - pad.bottom} y2={H - pad.bottom} stroke="var(--line)" />
      {points.map((p) => (
        <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={2.5} fill="var(--muted)" />
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
      <text x={pad.left} y={H - 6}>
        {formatDayMonth(points[0].date)}
      </text>
      <text x={W - pad.right} y={H - 6} textAnchor="end">
        {formatDayMonth(points.at(-1)!.date)}
      </text>
    </svg>
  );
}
