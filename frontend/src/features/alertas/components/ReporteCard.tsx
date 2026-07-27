import { cn } from '@/shared/lib/cn';

/**
 * ReporteCard — tarjeta de text area reutilizable.
 *
 * Se usa para:
 *   - "Reporte de daños"       (visible cuando el flujo llega a EN_ESPERA_REPORTE o después).
 *   - "Reporte de acciones"    (visible cuando el flujo llega a EN_PROCESO_ATENCION o después).
 *
 * Características:
 *   - Label de título, subtítulo descriptivo, textarea con maxlength 500.
 *   - Contador de caracteres (X/500) abajo-derecha.
 *   - Read-only si se pasa `readOnly` (cuando ya está guardado y no se edita).
 *
 * Estilos según Figma:
 *   - Tarjeta: fondo `bg-background-main`, outline `input-stroke-main`, radius 2xl.
 *   - Textarea: fondo `bg-background-main`, outline `input-stroke-main`, radius xl.
 *   - Placeholder: `text-text-status-placeholder`.
 *
 * Cuando el contenido se guarda (cambia `readOnly` a true tras "Guardar y
 * Cambiar Estado"), el textarea ya no es editable y aparece solo el contenido
 * cargado — esto sigue el patrón:"luego se queda ahi" (del usuario).
 */
interface ReporteCardProps {
  /** ID único de la instancia (para keys de React + testing). */
  id: string;
  /** Título grande, ej. "Reporte de daños". */
  title: string;
  /** Subtítulo descriptivo. */
  description: string;
  /** Texto actualmente cargado (cuando se edita el campo, se llama `onChange`). */
  value: string;
  /** Cambia el texto — solo se invoca si NO es read-only. */
  onChange?: (nuevo: string) => void;
  /** Si true, textarea deshabilitado (contenido ya guardado). */
  readOnly?: boolean;
  /** Placeholder del textarea. */
  placeholder?: string;
}

export function ReporteCard({
  id,
  title,
  description,
  value,
  onChange,
  readOnly = false,
  placeholder,
}: ReporteCardProps) {
  const fieldId = `reporte-${id}`;
  const maxLen = 500;

  return (
    <div className="self-stretch bg-background-main rounded-2xl outline outline-1 outline-offset-[-1px] outline-input-stroke-main px-6 py-5 flex flex-col items-start gap-1">
      <h3 className="self-stretch text-text-primary text-base font-bold font-sans leading-6">
        {title}
      </h3>
      <p className="self-stretch text-text-secondary text-xs font-normal font-sans leading-4">
        {description}
      </p>

      <div className="self-stretch pt-2 pb-1.5 flex flex-col items-start">
        <textarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange?.(e.target.value.slice(0, maxLen))}
          maxLength={maxLen}
          readOnly={readOnly}
          disabled={readOnly}
          placeholder={placeholder}
          className={cn(
            'self-stretch bg-background-main rounded-xl outline outline-1 outline-offset-[-1px] outline-input-stroke-main',
            'px-4 pt-3 pb-8 resize-none',
            'text-text-primary text-sm font-normal font-sans leading-5',
            'placeholder:text-text-status-placeholder',
            'focus:outline-2 focus:outline-primary-main',
            'min-h-24',
          )}
          aria-label={title}
        />
        <span className="self-end pt-1 text-text-secondary text-xs font-normal font-sans leading-4">
          {value.length}/{maxLen}
        </span>
      </div>
    </div>
  );
}