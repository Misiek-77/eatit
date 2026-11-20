import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

const SUPPORTS_CLOSEDBY = typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype;

interface SheetProps {
  open: boolean;
  onClose(): void;
  title: string;
  children: ReactNode;
}

/** Modal bottom sheet on the native <dialog>: focus, Esc, back gesture and inertness come from the browser. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // React does not emit the `autofocus` attribute, so the dialog's own focus step cannot see it.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Tap-outside for browsers without `closedby`: press and release must both land outside the sheet.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || SUPPORTS_CLOSEDBY) return;
    const outside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    const down = (e: PointerEvent) => {
      pressedOutside = outside(e);
    };
    const up = (e: PointerEvent) => {
      if (pressedOutside && outside(e)) dialog.close();
    };
    dialog.addEventListener('pointerdown', down);
    dialog.addEventListener('pointerup', up);
    return () => {
      dialog.removeEventListener('pointerdown', down);
      dialog.removeEventListener('pointerup', up);
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      // React bubbles `close` up its tree, so a sheet opened from inside this one would close both.
      onClose={(e) => e.target === e.currentTarget && onClose()}
      {...{ closedby: 'any' }}
    >
      {open && (
        <>
          <div className="sheet-head">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="icon-btn" aria-label="Zamknij" onClick={onClose}>
              <Icon name="close" />
            </button>
          </div>
          <div className="sheet-body">{children}</div>
        </>
      )}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  onClose(): void;
  onConfirm(): void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}

/** Confirmation for a destructive action; focus starts on the safe choice. */
export function Confirm({ open, onClose, onConfirm, title, message, confirmLabel, cancelLabel = 'Anuluj' }: ConfirmProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="stack">
        <p className="muted">{message}</p>
        <div className="row-actions">
          <button type="button" className="btn" data-autofocus onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-danger btn-quiet"
            onClick={() => {
              onClose();
              onConfirm();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
