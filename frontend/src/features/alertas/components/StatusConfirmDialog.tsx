import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * StatusConfirmDialog — modal de confirmación con color tunable.
 *
 * Igual que `ConfirmDialog` pero con `confirmColorClass` configurable,
 * lo que permite tintar botón + anillo con el color del siguiente estado
 * de la alerta (amarillo predicho, cyan en-proceso, verde atendido, etc.).
 *
 * Props principales:
 *   - `open`: visible si true.
 *   - `title`, `message`: contenido textual.
 *   - `confirmColorClass`: clase completa para el botón de confirmar
 *     (ej. "bg-alerts-status-predicho text-text-primary hover:opacity-80").
 *   - `onConfirm`, `onClose`: callbacks.
 *
 * Cierre: clic fuera (overlay), tecla Escape, botón Cancelar.
 */
interface StatusConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  /** Clases Tailwind para el botón de confirmar (bg, text, hover, focus-visible). */
  confirmColorClass: string;
}

export function StatusConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onClose,
  confirmColorClass,
}: StatusConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    cancelBtnRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const cancelBtnCx = cn(
    'px-4 py-2 rounded-md font-sans font-bold text-sm transition-colors',
    'bg-background-main outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary',
    'hover:bg-primary-states-hover-main',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
  );

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md bg-background-main rounded-section shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-6 flex flex-col gap-4"
      >
        <h2 className="text-xl font-bold font-sans text-primary-main leading-6">
          {title}
        </h2>
        <p className="text-sm font-normal font-sans text-text-primary leading-5">
          {message}
        </p>
        <div className="mt-2 flex justify-end items-center gap-3">
          <button ref={cancelBtnRef} type="button" onClick={onClose} className={cancelBtnCx}>
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 rounded-md font-sans font-bold text-sm transition-[filter,opacity]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              confirmColorClass,
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}