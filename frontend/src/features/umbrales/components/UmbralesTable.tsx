import { Pencil } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { UmbralFenomeno } from '@/features/umbrales/types';
import { thresholdNameToCategoria } from '@/features/umbrales/types';
import { GFS_COLOR_MAP } from '@/features/mapa/types/gfs';

/**
 * UmbralesTable — lista vertical de umbrales definidos para el distrito.
 *
 * Visual:
 *  - Cada fila lleva una franja de color (izquierda) y un dot que identifican
 *    su categoría de precipitación (Moderadamente / Lluvioso / Muy /
 *    Extremadamente Lluvioso), reutilizando la paleta del mapa GFS.
 *  - El fondo base es gris; la fila cuyo rango contiene el "máximo umbral
 *    registrado" en los clústeres GFS se resalta con más peso (negrita,
 *    borde de marca y fondo tenue de marca).
 *
 * Acciones por fila: editar (abre el modal con ese registro).
 */
interface UmbralesTableProps {
  umbrales: UmbralFenomeno[];
  /** id del umbral que coincide con el valor máximo actual (para resaltar). */
  activoId?: number | null;
  onEdit: (u: UmbralFenomeno) => void;
}

export function UmbralesTable({ umbrales, activoId, onEdit }: UmbralesTableProps) {
  if (umbrales.length === 0) {
    return (
      <div className="text-center text-text-secondary text-sm font-sans py-8">
        No hay umbrales definidos para este distrito. Use el botón
        “Agregar umbral” para crear el primero.
      </div>
    );
  }

  // Ordenar de menor a mayor intensidad (por min_value, nulls al final).
  const ordenados = [...umbrales].sort((a, b) => {
    const aMin = a.min_value ?? Number.POSITIVE_INFINITY;
    const bMin = b.min_value ?? Number.POSITIVE_INFINITY;
    return aMin - bMin;
  });

  return (
    <ul className="flex flex-col gap-2">
      {ordenados.map((u) => {
        const activo = activoId === u.id;
        const categoria = thresholdNameToCategoria(u.threshold.name);
        const color = categoria ? GFS_COLOR_MAP[categoria] : '#9ca3af';
        return (
          <li
            key={u.id}
            style={{ borderLeftColor: color }}
            className={cn(
              'group flex items-center gap-3 rounded-xl pl-4 pr-4 py-3 outline outline-1 outline-offset-[-1px] transition-colors border-l-4',
              activo
                ? 'outline-primary-main bg-primary-states-hover-main/15'
                : 'outline-button-stroke bg-button-fill-button/40 hover:bg-button-fill-button/70',
            )}
          >
            {/* Dot de color de la categoría */}
            <span
              className="inline-block size-3 rounded-full shrink-0 ring-2 ring-background-main"
              style={{ backgroundColor: color }}
              aria-hidden="true"
              title={u.threshold.name}
            />

            <div
              className={cn(
                'flex flex-1 flex-col',
                activo ? 'text-primary-main' : 'text-text-secondary',
              )}
            >
              <span
                className={cn(
                  'text-sm font-sans leading-5',
                  activo ? 'font-bold' : 'font-normal',
                )}
              >
                {u.threshold.name}
              </span>
              <span
                className={cn(
                  'text-xs font-sans leading-4',
                  activo ? 'text-primary-main/80' : 'text-text-secondary',
                )}
              >
                {u.variable.name} · {u.natural_phenomena.name}
              </span>
            </div>

            <div
              className={cn(
                'text-sm font-sans tabular-nums',
                activo ? 'text-primary-main font-bold' : 'text-text-secondary',
              )}
            >
              {formatRango(u.min_value, u.max_value)}
              <span className="text-text-secondary text-xs ml-1">mm/h</span>
            </div>

            <button
              type="button"
              onClick={() => onEdit(u)}
              title="Editar umbral"
              className="p-2 rounded-lg text-text-secondary hover:text-primary-main hover:bg-primary-states-hover-main/30 transition-colors"
              aria-label={`Editar umbral ${u.threshold.name}`}
            >
              <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function formatRango(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `[${min} – ${max})`;
  if (min !== null) return `≥ ${min}`;
  if (max !== null) return `< ${max}`;
  return '—';
}