import { useRef, useState } from 'react';
import { Icon } from '../../shared/Icon';
import { Sheet } from '../../shared/Sheet';
import { recognizeLabel, type OcrProgress } from '../data/labelOcr';
import { readLabel, type LabelReading } from '../domain/label';

const STAGE_TEXT: Record<OcrProgress['stage'], string> = {
  preparing: 'Przygotowuję zdjęcie…',
  loading: 'Wczytuję czytnik etykiet… Za pierwszym razem pobiera się on z internetu, potem działa offline.',
  reading: 'Czytam etykietę…',
};

/**
 * A button that takes a photo of a nutrition table (or one from the library), reads it on the phone and hands
 * over what was found together with the raw text. Shows progress while it works.
 */
export function LabelPhoto({
  label,
  className,
  onRead,
}: {
  label: string;
  className: string;
  onRead(reading: LabelReading, text: string): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setError(null);
    setProgress({ stage: 'preparing' });
    try {
      const text = await recognizeLabel(file, setProgress);
      setProgress(null);
      onRead(readLabel(text), text);
    } catch {
      setProgress(null);
      setError(
        navigator.onLine === false
          ? 'Czytnik etykiet trzeba raz pobrać z internetu. Połącz się i spróbuj jeszcze raz — potem będzie działał offline.'
          : 'Nie udało się odczytać zdjęcia. Spróbuj jeszcze raz albo wpisz wartości ręcznie.',
      );
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()}>
        <Icon name="camera" />
        {label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void read(file);
        }}
      />
      {error && (
        <p className="note error" role="alert" style={{ marginTop: 10 }}>
          {error}
        </p>
      )}
      <Sheet open={progress !== null} onClose={() => undefined} title="Odczyt etykiety">
        {progress && (
          <div className="stack" role="status">
            <p>{STAGE_TEXT[progress.stage]}</p>
            <div className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: `${Math.round((progress.share ?? (progress.stage === 'preparing' ? 0.05 : 0.15)) * 100)}%` }} />
            </div>
            <p className="muted small">Najlepiej działa zdjęcie samej tabeli z bliska, prosto i bez odblasków.</p>
          </div>
        )}
      </Sheet>
    </>
  );
}

/** "kcal, białko i tłuszcz" — what a reading found, for the notice on the check screen. */
export function foundList(reading: LabelReading): { found: string; missing: string } {
  const names: [keyof LabelReading['values'], string][] = [
    ['kcal', 'kcal'],
    ['protein', 'białko'],
    ['fat', 'tłuszcz'],
    ['carbs', 'węglowodany'],
    ['sugar', 'cukry'],
    ['fiber', 'błonnik'],
    ['salt', 'sól'],
  ];
  const join = (list: string[]) => (list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} i ${list.at(-1)}`);
  const found = names.filter(([k]) => reading.values[k] !== undefined).map(([, n]) => n);
  const missing = names.slice(0, 4).filter(([k]) => reading.values[k] === undefined).map(([, n]) => n);
  return { found: join(found), missing: join(missing) };
}
