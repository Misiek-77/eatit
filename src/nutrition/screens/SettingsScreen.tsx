import { useRef, useState } from 'react';
import { formatWhole, plural } from '../../shared/format';
import { Header } from '../../shared/Header';
import { NumberField } from '../../shared/NumberField';
import { saveFile } from '../../shared/saveFile';
import { Confirm } from '../../shared/Sheet';
import { getTheme, setTheme, useSystemDark, type Theme } from '../../shared/theme';
import { parseBackup, serializeBackup } from '../data/backup';
import { goalsFromWeight } from '../domain/nutrients';
import type { Goals, NutritionData } from '../domain/types';
import { useNutrition } from '../state/nutritionContext';

type Message = { kind: 'ok' | 'error'; text: string } | null;

/** Daily goals, theme and backups of the nutrition diary. */
export function SettingsScreen() {
  const store = useNutrition();
  const [goals, setGoals] = useState<Goals>(store.settings.goals);
  const [weight, setWeight] = useState(0);
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const systemDark = useSystemDark();
  const [message, setMessage] = useState<Message>(null);
  const [pending, setPending] = useState<NutritionData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fromMacros = goals.protein * 4 + goals.fat * 9 + goals.carbs * 4;
  const changed = JSON.stringify(goals) !== JSON.stringify(store.settings.goals);

  async function exportData() {
    const now = new Date().toISOString();
    const { products, entries, settings } = store;
    const result = await saveFile(
      new Blob([serializeBackup({ products, entries, settings }, now)], { type: 'application/json' }),
      `jadlospis-kopia-${now.slice(0, 10)}.json`,
      'Kopia zapasowa jadłospisu',
    );
    if (result === 'cancelled') return;
    store.saveSettings({ ...store.settings, lastBackupAt: now });
    setMessage({ kind: 'ok', text: result === 'shared' ? 'Kopia zapasowa została zapisana.' : 'Kopia zapasowa została pobrana.' });
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
            <p className="muted small">Białko 2 g na kg, tłuszcz 25% energii, reszta to węglowodany. Kalorie zostają te wpisane wyżej.</p>
            <button type="button" className="btn" disabled={weight <= 0 || goals.kcal <= 0} onClick={() => setGoals(goalsFromWeight(weight, goals.kcal))}>
              Wylicz makro
            </button>
          </div>
        </details>
        <button type="button" className="btn btn-primary btn-block" disabled={!changed || goals.kcal <= 0} onClick={() => store.saveSettings({ ...store.settings, goals })}>
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
          <button type="button" className="btn" onClick={() => void exportData()}>
            Eksportuj
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            Importuj
          </button>
        </div>
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
              setMessage({ kind: 'ok', text: 'Dane zostały zaimportowane.' });
            },
            () => setMessage({ kind: 'error', text: 'Nie udało się zapisać danych. Dotychczasowe dane są nienaruszone.' }),
          )
        }
        title="Zastąpić dane?"
        message={
          pending
            ? `Plik zawiera ${plural(pending.products.length, 'produkt', 'produkty', 'produktów')} i ${plural(pending.entries.length, 'wpis', 'wpisy', 'wpisów')}. Import zastąpi wszystko, co jest teraz w jadłospisie.`
            : ''
        }
        confirmLabel="Zastąp dane"
      />
    </main>
  );
}
