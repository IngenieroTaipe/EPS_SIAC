import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

/**
 * ConfirmDialog — modal de confirmación reutilizable.
 *
 * Sigue la paleta de marca de EPS_SIAC:
 *   - Overlay: negro con 50% opacidad (`bg-black/50`) para difuminar el fondo.
 *   - Tarjeta: fondo `bg-background-main` (#ffffff) con borde redondeado y sombra.
 *   - Título: `text-primary-main` (#070b5b, navy).
 *   - Mensaje: `text-text-primary` (#21272a).
 *   - Botón cancelar: outline `button-stroke`, texto `text-primary`.
 *   - Botón confirmar: sólido `secondary-main` (rojo) + texto blanco.
 *
 * Características:
 *   - Cierre con tecla `Escape` y clic fuera de la tarjeta (overlay click).
 *   - Trap de foco básico (al abrir, el botón cancelar recibe foco).
 *   - Accesibilidad: roles ARIA, `aria-modal`, etiquetas descriptivas.
 *   - Animación de entrada/salida implica不断完善; aquí solo fade simple.
 *
 * Props:
 *   - `open`: controla visibilidad.
 *   - `title`: encabezado del modal.
 *   - `message`: cuerpo descriptivo.
 *   - `confirmText`: etiqueta del botón de confirmación (default "Confirmar").
 *   - `cancelText`: etiqueta del botón de cancelar (default "Cancelar").
 *   - `onConfirm`: callback tras clic en confirmar.
 *   - `onClose`: callback que cierra el modal (cancelar o overlay).
 *   - `variant`: "danger" (rojo, default) o "primary" (navy) para el botón.
 */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  /** Estilo del botón de confirmar. "danger" usa secondary-main; "primary" usa primary-main. */
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onClose,
  variant = 'danger',
}: ConfirmDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Cierra con Escape y trae el foco al botón cancelar al abrir.
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

  const confirmBtnCx = cn(
    'px-4 py-2 rounded-md font-sans font-bold text-sm transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    variant === 'danger'
      ? 'bg-secondary-main text-text-invert-primary hover:bg-secondary-background focus-visible:ring-secondary-main'
      : 'bg-primary-main text-text-invert-primary hover:bg-primary-light focus-visible:ring-primary-main',
  );

  const cancelBtnCx = cn(
    'px-4 py-2 rounded-md font-sans font-bold text-sm transition-colors',
    'bg-background-main outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary',
    'hover:bg-primary-states-hover-main focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2',
  );

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        // Cerrar si clic fuera de la tarjeta.
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        className="w-full max-w-md bg-background-main rounded-section shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-6 flex flex-col gap-4"
      >
        {/* Título */}
        <h2
          id="confirm-dialog-title"
          className="text-xl font-bold font-sans text-primary-main leading-6"
        >
          {title}
        </h2>

        {/* Mensaje */}
        <p
          id="confirm-dialog-desc"
          className="text-sm font-normal font-sans text-text-primary leading-5"
        >
          {message}
        </p>

        {/* Botones */}
        <div className="mt-2 flex justify-end items-center gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            className={cancelBtnCx}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={confirmBtnCx}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}