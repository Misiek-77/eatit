import { useEffect, useState } from 'react';
import { parseNumber } from './number';

interface NumberFieldProps {
  value: number;
  onChange(value: number): void;
  label: string;
  /** Whole numbers only (repetitions). */
  integer?: boolean;
}

const display = (value: number) => (value === 0 ? '' : String(value).replace('.', ','));

function parse(text: string, integer: boolean): number | null {
  if (text.trim() === '') return 0;
  const n = parseNumber(text);
  return n !== null && integer && !Number.isInteger(n) ? null : n;
}

/** Numeric input that accepts "62,5" and "62.5" and only reports valid, non-negative values. */
export function NumberField({ value, onChange, label, integer = false }: NumberFieldProps) {
  const [text, setText] = useState(() => display(value));
  const parsed = parse(text, integer);

  // Follow changes made elsewhere, without clobbering what the person is typing (e.g. "62,").
  useEffect(() => {
    setText((current) => (parse(current, integer) === value ? current : display(value)));
  }, [value, integer]);

  return (
    <input
      className="num"
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      aria-label={label}
      aria-invalid={parsed === null}
      placeholder="0"
      value={text}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        setText(e.target.value);
        const next = parse(e.target.value, integer);
        if (next !== null && next !== value) onChange(next);
      }}
      onBlur={() => setText(display(value))}
    />
  );
}
