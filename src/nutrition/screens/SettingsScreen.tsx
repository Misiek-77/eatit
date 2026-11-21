import { useRef, useState } from 'react';
import { formatWhole, plural } from '../../shared/format';
import { Header } from '../../shared/Header';
import { NumberField } from '../../shared/NumberField';
import { saveFile } from '../../shared/saveFile';
import { Confirm } from '../../shared/Sheet';
import { getTheme, setTheme, useSystemDark, type Theme } from '../../shared/theme';
import { parseBackup, serializeBackup, serializeCombined } from '../data/backup';
import { goalsFromWeight } from '../domain/nutrients';
import type { Goals, NutritionData } from '../domain/types';
import { useNutrition } from '../state/nutritionContext';

type Message = { kind: 'ok' | 'error'; text: string } | null;

/** Daily goals, theme and backups of the nutrition diary. */
export function SettingsScreen() {
  const store = useNutrition();
  const [goals, setGoals] = useState<Goals>(store.settings.goals);
  const latestWeight = [...store.weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1)?.kg ?? 0;
  const [weight, setWeight] = useState(latestWeight);
  const [waterGoal, setWaterGoal] = useState(store.settings.waterGoalMl);
  const [bonus, setBonus] = useState(store.settings.trainingBonusKcal);
  const [fromCombined, setFromCombined] = useState<{ withTraining: boolean } | null>(null);
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const systemDark = useSystemDark();
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState<NutritionData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fromMacros = goals.protein * 4 + goals.fat * 9 + goals.carbs * 4;
  const changed =
    JSON.stringify(goals) !== JSON.stringify(store.settings.goals) || waterGoal !== store.settings.waterGoalMl || bonus !== store.settings.trainingBonusKcal;

  async function exportData(both: boolean) {
    const now = new Date().toISOString();
    const { products, entries, weights, water, settings } = store;
    const data = { products, entries, weights, water, settings };
    const combined = both ? await serializeCombined(data, now) : null;
    const result = await saveFile(
      new Blob([combined ? combined.text : serializeBackup(data, now)], { type: 'application/json' }),
      `${both ? 'trening-i-jadlospis' : 'jadlospis'}-kopia-${now.slice(0, 10)}.json`,
      both ? 'Kopia zapasowa obu aplikacji' : 'Kopia zapasowa jadłospisu',
    );
    if (result === 'cancelled') return;
    store.saveSettings({ ...store.settings, lastBackupAt: now });
    const done = result === 'shared' ? 'Kopia zapasowa została zapisana.' : 'Kopia zapasowa została pobrana.';
    setMessage({
      kind: 'ok',
      text: combined && !combined.withTraining ? `${done} Aplikacja Trening nie była otwierana na tym urządzeniu, więc w pliku jest tylko jadłospis.` : done,
    });
  }

  return (
    <main className="screen">
      <Header back="/dieta" />
      <h1 className="title">Cele i ustawienia</h1>

      <section className="section stack">
        <h2 className="label">Cele na dzień</h2>
        <div className="measure-grid">
          <label className="field">
            <span>Energia (kcal)</span>
            <NumberField integer label="Cel kalorii" value={goals.kcal} onChange={(kcal) => setGoals({ ...goals, kcal })} />
          </label>
          <label className="field">
            <span>Białko (g)</span>
            <NumberField integer label="Cel białka w gramach" value={goals.protein} onChange={(protein) => setGoals({ ...goals, protein })} />
          </label>
          <label className="field">
            <span>Tłuszcz (g)</span>
            <NumberField integer label="Cel tłuszczu w gramach" value={goals.fat} onChange={(fat) => setGoals({ ...goals, fat })} />
          </label>
          <label className="field">
            <span>Węglowodany (g)</span>
            <NumberField integer label="Cel węglowodanów w gramach" value={goals.carbs} onChange={(carbs) => setGoals({ ...goals, carbs })} />
          </label>
        </div>
        <p className={Math.abs(fromMacros - goals.kcal) > 100 ? 'note error' : 'muted small'}>
          Makro daje razem {formatWhole(fromMacros)} kcal{Math.abs(fromMacros - goals.kcal) > 100 ? ' — to wyraźnie inaczej niż cel kalorii.' : '.'}
        </p>
        <details className="disclosure">
          <summary>Wylicz z masy ciała</summary>
          <div className="stack">
            <label className="field">
              <span>Masa ciała (kg)</span>
              <NumberField label="Masa ciała w kg" value={weight} onChange={setWeight} />
            </label>
            <p className="muted small">
              Białko 2 g na kg, tłuszcz 25% energii, reszta to węglowodany. Kalorie zostają te wpisane wyżej.
              {latestWeight > 0 && ' Wpisana jest ostatnia waga z Postępów.'}
            </p>
            <button type="button" className="btn" disabled={weight <= 0 || goals.kcal <= 0} onClick={() => setGoals(goalsFromWeight(weight, goals.kcal))}>
              Wylicz makro
            </button>
          </div>
        </details>
        <h2 className="label">Dzień treningowy</h2>
        <label className="field">
          <span>Dodatkowe kcal w dni z treningiem</span>
          <NumberField integer label="Dodatkowe kalorie w dni treningowe" value={bonus} onChange={setBonus} />
        </label>
        <p className="muted small">
          Gdy w aplikacji Trening na tym telefonie jest zapisany trening danego dnia, cel kalorii rośnie o tyle, a dodatek idzie w węglowodany. 0 wyłącza
          dodatek. Zwykle 200–400 kcal.
        </p>
        <h2 className="label">Woda</h2>
        <label className="field">
          <span>Cel wody na dzień (ml)</span>
          <NumberField integer label="Cel wody w ml" value={waterGoal} onChange={setWaterGoal} />
        </label>
        <p className="muted small">Często podaje się około 30–35 ml na kg masy ciała{latestWeight > 0 && `, u Ciebie około ${formatWhole(Math.round((latestWeight * 33) / 50) * 50)} ml`}.</p>
        <button
          type="button"
          className="btn btn-primary btn-block"
          disabled={!changed || goals.kcal <= 0 || waterGoal <= 0}
          onClick={() => store.saveSettings({ ...store.settings, goals, waterGoalMl: waterGoal, trainingBonusKcal: bonus })}
        >
          {changed ? 'Zapisz cele' : 'Cele zapisane'}
        </button>
      </section>

      <section className="section">
        <h2 className="label">Motyw</h2>
        <div className="segmented" role="group" aria-label="Motyw">
          {(
            [
              ['system', 'System'],
              ['light', 'Jasny'],
              ['dark', 'Ciemny'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={theme === value}
              onClick={() => {
                setTheme(value);
                setThemeState(value);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {theme === 'system' && <p className="muted small" style={{ marginTop: 8 }}>Zgodnie z urządzeniem, obecnie {systemDark ? 'ciemny' : 'jasny'}.</p>}
      </section>

      <section className="section">
        <h2 className="label">Dane</h2>
        <p className="muted small" style={{ marginBottom: 12 }}>
          Dziennik i produkty są zapisane tylko na tym urządzeniu. „Eksportuj” na iPhonie otwiera udostępnianie: wybierz „Zachowaj w Plikach”, np. w iCloud
          Drive.
        </p>
        <div className="row-actions">
          <button type="button" className="btn" onClick={() => void exportData(false)}>
            Eksportuj
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            Importuj
          </button>
        </div>
        <button type="button" className="btn btn-block" style={{ marginTop: 8 }} onClick={() => void exportData(true)}>
          Eksportuj obie aplikacje (z Treningiem)
        </button>
        <p className="muted small" style={{ marginTop: 8 }}>
          Jeden plik z jadłospisem i danymi Treningu z tego telefonu. Wczytany tutaj przywraca jadłospis, a wczytany w Treningu — treningi.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const result = parseBackup(await file.text());
            if (result.ok) {
              setMessage(null);
              setFromCombined(result.combined ?? null);
              setPending(result.data);
            } else setMessage({ kind: 'error', text: result.error });
          }}
        />
        {message && (
          <p className={message.kind === 'error' ? 'note error' : 'note'} role="status" style={{ marginTop: 12 }}>
            {message.text}
          </p>
        )}
        <p className="muted small" style={{ marginTop: 16 }}>
          Dane produktów ze skanowanych kodów pochodzą z otwartej bazy Open Food Facts (openfoodfacts.org). Wysyłany jest tylko kod kreskowy.
        </p>
      </section>

      <Confirm
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() =>
          pending &&
          void store.replaceAll(pending).then(
            () => {
              setGoals(pending.settings.goals);
              setWaterGoal(pending.settings.waterGoalMl);
              setBonus(pending.settings.trainingBonusKcal);
              setMessage({
                kind: 'ok',
                text: fromCombined?.withTraining
                  ? 'Jadłospis został zaimportowany. Treningi z tego pliku wczytasz w aplikacji Trening: Ustawienia → Importuj.'
                  : 'Dane zostały zaimportowane.',
              });
            },
            () => setMessage({ kind: 'error', text: 'Nie udało się zapisać danych. Dotychczasowe dane są nienaruszone.' }),
          )
        }
        title="Zastąpić dane?"
        message={
          pending
            ? `Plik zawiera ${plural(pending.products.length, 'produkt', 'produkty', 'produktów')}, ${plural(pending.entries.length, 'wpis', 'wpisy', 'wpisów')} i ${plural(pending.weights.length, 'pomiar wagi', 'pomiary wagi', 'pomiarów wagi')}. Import zastąpi wszystko, co jest teraz w jadłospisie.`
            : ''
        }
        confirmLabel="Zastąp dane"
      />
    </main>
  );
}
