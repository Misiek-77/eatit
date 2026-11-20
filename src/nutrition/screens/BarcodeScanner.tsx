import { useEffect, useRef, useState } from 'react';
import { isBarcode } from '../data/openFoodFacts';

type CameraState = 'starting' | 'running' | 'denied' | 'unavailable';

/**
 * Reads a barcode with the back camera, or takes one typed in. The reading library is loaded only when the
 * scanner opens, so the rest of the app stays small. Calls `onCode` once with digits only.
 */
export function BarcodeScanner({ onCode }: { onCode(code: string): void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<CameraState>('starting');
  const [typed, setTyped] = useState('');
  const done = useRef(false);
  // The latest callback, so the camera starts once even when the parent passes a new function on each render.
  const report = useRef(onCode);
  report.current = onCode;

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamera('unavailable');
        return;
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
        if (cancelled || !video.current) return;
        const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]]);
        const reader = new BrowserMultiFormatReader(hints);
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          video.current,
          (result) => {
            const code = result?.getText();
            if (!code || done.current || !isBarcode(code)) return;
            done.current = true;
            navigator.vibrate?.(60);
            controls.stop();
            report.current(code);
          },
        );
        if (cancelled) controls.stop();
        else {
          stop = () => controls.stop();
          setCamera('running');
        }
      } catch (error) {
        if (cancelled) return;
        setCamera(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  return (
    <div className="stack">
      <div className="scanner">
        <video ref={video} muted playsInline aria-label="Podgląd z aparatu" />
        {camera === 'running' && <span className="scanner-frame" aria-hidden="true" />}
        {camera === 'starting' && <p className="scanner-note">Włączam aparat…</p>}
        {camera === 'denied' && (
          <p className="scanner-note">Brak dostępu do aparatu. Zezwól na niego w ustawieniach Safari dla tej strony albo wpisz kod poniżej.</p>
        )}
        {camera === 'unavailable' && <p className="scanner-note">Aparat nie jest dostępny. Wpisz cyfry spod kodu kreskowego poniżej.</p>}
      </div>
      <p className="muted small">Skieruj aparat na kod kreskowy, zeskanuje się sam.</p>
      <form
        className="row-actions"
        onSubmit={(e) => {
          e.preventDefault();
          if (isBarcode(typed) && !done.current) {
            done.current = true;
            report.current(typed);
          }
        }}
      >
        <TypedCode value={typed} onChange={setTyped} />
        <button type="submit" className="btn" disabled={!isBarcode(typed)}>
          Szukaj
        </button>
      </form>
    </div>
  );
}

/** Digits of a barcode typed by hand. A text field (not NumberField): leading zeros matter. */
function TypedCode({ value, onChange }: { value: string; onChange(v: string): void }) {
  return (
    <input
      className="input"
      inputMode="numeric"
      autoComplete="off"
      placeholder="np. 5900000000000"
      aria-label="Kod kreskowy"
      value={value}
      maxLength={14}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
    />
  );
}
