import { calcularPasos, calcularSeparadores, formatFechaCorta, formatHora } from '../stepper-utils';
import type { AlertaHistorica } from '../types';
import { cn } from '@/shared/lib/cn';

/**
 * Stepper — barra horizontal con 3 fases del flujo de la alerta:
 *
 *   [Notificado]——[Confirmado]——[Atendido]
 *
 * Cada fase:
 *   - "hecho":   círculo navy (`primary-light`) + check blanco dentro.
 *   - "proceso": círculo navy + check blanco dentro (igual al "hecho" en
 *                este diseño, ya que el backend ya marcó la fecha).
 *   - "falta":   círculo gris (`button-stroke`) sin icono.
 *
 * Separador entre fases:
 *   - activo   (siguiente fase ya empezó): `bg-primary-light`.
 *   - inactivo (siguiente fase sin empezar): `bg-button-stroke`.
 *
 * Debajo de cada círculo (excepto "falta"): etiqueta de la fase + fecha+hora.
 *
 * Notas:
 *   - El "proceso" visualmente es idéntico al "hecho" en este diseño (ambos
 *     circle primary-light con check); la diferencia semántica la marca el
 *     color del separador siguiente (inactivo si la siguiente fase no
 *     empezó todavía). Si quieres distinguir "proceso" visualmente, edita
 *     este componente (puedes añadir borde animado o cambio de icono).
 */
interface StepperProps {
  alerta: AlertaHistorica;
}

export function Stepper({ alerta }: StepperProps) {
  const pasos = calcularPasos(alerta);
  const separadores = calcularSeparadores(pasos);

  return (
    <div className="self-stretch bg-background-main rounded-2xl outline outline-1 outline-offset-[-1px] outline-input-stroke-main px-6 py-5 flex flex-col items-start gap-2.5">
      <h2 className="text-text-primary text-base font-bold font-sans leading-6">
        Estado de la alerta
      </h2>

      <div className="self-stretch inline-flex justify-center items-start">
        {pasos.map((paso, idx) => (
          <div key={paso.fase} className="inline-flex items-start">
            {/* Círculo + label + fecha */}
            <div className="w-28 inline-flex flex-col items-center">
              <PasoCirculo estado={paso.estado} />
              <div className="pt-2 flex flex-col items-center">
                <span
                  className={cn(
                    'text-sm font-bold font-sans leading-5',
                    paso.estado === 'falta'
                      ? 'text-text-status-placeholder'
                      : 'text-text-primary',
                  )}
                >
                  {paso.label}
                </span>
              </div>
              {paso.fecha && (
                <div className="flex flex-col items-center">
                  <span className="text-text-secondary text-xs font-normal font-sans leading-4">
                    {formatFechaCorta(paso.fecha)}
                    <br />
                    {formatHora(paso.fecha)}
                  </span>
                </div>
              )}
            </div>

            {/* Separador hacia el siguiente paso (no se dibuja tras el último) */}
            {idx < pasos.length - 1 && (
              <div className="w-24 h-4 pt-4 inline-flex flex-col justify-start items-start">
                <div
                  className={cn(
                    'self-stretch h-0.5',
                    separadores[idx].estado === 'activo'
                      ? 'bg-primary-light'
                      : 'bg-button-stroke',
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Círculo visual del paso según su estado. */
function PasoCirculo({ estado }: { estado: 'hecho' | 'proceso' | 'falta' }) {
  const isDone = estado === 'hecho' || estado === 'proceso';
  return (
    <div
      className={cn(
        'size-8 rounded-full inline-flex justify-center items-center',
        isDone ? 'bg-primary-light' : 'bg-button-stroke',
      )}
    >
      {isDone && (
        <svg
          viewBox="0 0 16 16"
          className="size-4 text-text-invert-primary"
          aria-hidden="true"
        >
          <path
            d="M3 8.5L6.5 12L13 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  );
}