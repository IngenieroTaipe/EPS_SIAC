import { useCallback } from 'react';
import { cn } from '@/shared/lib/cn';

interface GfsForecastSliderProps {
  /**
   * Etiquetas legibles de cada hora del pronóstico (ej: ['14:00','15:00',...]).
   * Longitud del array define el rango del slider (0 .. length-1).
   * Puede venir vacío si el backend aún no carga datos.
   */
  hours: string[];
  /** Índice de hora actual (0..hours.length-1). Se clamp internamente. */
  value: number;
  /** Callback al cambiar el índice seleccionado. */
  onChange: (index: number) => void;
  /** Clase extra para el contenedor (utility). */
  className?: string;
}

/**
 * GfsForecastSlider — deslizador horizontal de horas GFS, agnóstico a Leaflet.
 *
 * Flotante (`position: absolute`, bottom-center) y reutilizable: su padre
 * decide dónde montarlo (típicamente via portal sobre el wrapper del mapa)
 * y qué hacer con cada `onChange` (actualizar colores de polígonos, etc.).
 *
 * Es defensivo: si `hours` está vacío se deshabilita y muestra '—'.
 * Si `value` cae fuera de rango se clamp automáticamente.
 */
export function GfsForecastSlider({
  hours,
  value,
  onChange,
  className,
}: GfsForecastSliderProps) {
  const total = hours.length;
  const max = Math.max(0, total - 1);
  const clamped = total > 0 ? Math.max(0, Math.min(value, max)) : 0;
  const currentLabel = total > 0 ? hours[clamped] : '—';
  const disabled = total === 0;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const idx = Number(e.target.value);
      if (Number.isInteger(idx) && idx >= 0 && idx < total) onChange(idx);
    },
    [onChange, total],
  );

  return (
    <div
      className={cn(
        'absolute bottom-5 left-1/2 -translate-x-1/2 z-[1000]',
        'flex items-center gap-3 min-w-[420px] max-w-[calc(100%-2.5rem)]',
        'rounded-lg bg-background-main/95 backdrop-blur',
        'px-4 py-3 shadow-[0px_5px_5px_0px_rgba(0,0,0,0.25)]',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
      role="group"
      aria-label="Selector de hora del pronóstico GFS"
    >
      {/* Hora actual legible (HH:mm), ancho fijo para que el layout no baile. */}
      <span className="w-12 shrink-0 text-center text-sm font-medium font-sans tabular-nums text-text-primary">
        {currentLabel}
      </span>

      {/* Slider nativo — accesible por teclado, sin dependencias extra. */}
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={clamped}
        onChange={handleChange}
        disabled={disabled}
        aria-label="Hora del pronóstico"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={currentLabel}
        className="flex-1 accent-primary-main"
      />

      {/* Contador "actual / total" como pista de progreso. */}
      <span className="shrink-0 text-xs font-sans tabular-nums text-text-secondary">
        {disabled ? '0/0' : `${clamped + 1}/${total}`}
      </span>
    </div>
  );
}