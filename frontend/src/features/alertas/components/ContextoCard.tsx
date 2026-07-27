import { formatFechaHora } from '../stepper-utils';
import type { AlertaHistorica, UmbralPrecipitacion } from '../types';

/** Etiquetas legibles para los umbrales. */
const UMBRAL_LABEL: Record<UmbralPrecipitacion, string> = {
  'moderadamente-lluvioso': 'Moderadamente Lluvioso',
  'lluvioso': 'Lluvioso',
  'muy-lluvioso': 'Muy Lluvioso',
  'extremadamente-lluvioso': 'Extremadamente Lluvioso',
};

/**
 * Tarjeta "Contexto Meteorológico".
 * Muestra:
 *   - Fenómeno climático
 *   - Fecha y Hora de Creación de la alerta
 *   - Umbral de precipitación (con su etiqueta legible)
 *   - Fecha y Hora de Notificación
 *   - Fecha y Hora de Predicción (inicio del fenómeno)
 *
 * Todos read-only (estilo campo- disabled).
 */
interface ContextoCardProps {
  alerta: AlertaHistorica;
}

export function ContextoCard({ alerta }: ContextoCardProps) {
  return (
    <div className="self-stretch bg-background-main rounded-2xl outline outline-1 outline-offset-[-1px] outline-input-stroke-main px-6 py-5 flex flex-col items-start gap-4">
      <h2 className="self-stretch text-text-primary text-base font-bold font-sans leading-6">
        Contexto Meteorológico
      </h2>

      <div className="self-stretch inline-flex justify-center items-start gap-4">
        <Campo label="Fenómeno climático" value={alerta.fenomeno} />
        <Campo
          label="Fecha y Hora de Creación de la alerta"
          value={formatFechaHora(alerta.fechaCreacion)}
          withClock
        />
      </div>

      <div className="self-stretch inline-flex justify-center items-start gap-4">
        <Campo
          label="Umbral de precipitación"
          value={UMBRAL_LABEL[alerta.umbral]}
          withDropdown
        />
        <Campo
          label="Fecha y Hora de notificación de la alerta"
          value={formatFechaHora(alerta.fechaNotificacion)}
          withClock
        />
      </div>

      <Campo
        label="Fecha y Hora de Predicción · Inicio del fenómeno climático"
        value={formatFechaHora(alerta.fechaPrediccionInicio)}
      />
    </div>
  );
}

function Campo({
  label,
  value,
  withClock = false,
  withDropdown = false,
}: {
  label: string;
  value: string;
  withClock?: boolean;
  withDropdown?: boolean;
}) {
  return (
    <div className="flex-1 inline-flex flex-col items-start gap-1.5 self-stretch">
      <span className="self-stretch text-text-primary text-sm font-normal font-sans leading-5">
        {label}
      </span>
      <div className="self-stretch bg-button-fill-button rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke px-4 py-2.5 inline-flex justify-between items-center">
        <span className="text-text-status-placeholder text-sm font-normal font-sans leading-5">
          {value}
        </span>
        {withClock && (
          <svg viewBox="0 0 16 16" className="size-4 text-icon-main" aria-hidden="true">
            <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.33" />
            <path d="M8 4.5V8L10.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" />
          </svg>
        )}
        {withDropdown && (
          <svg viewBox="0 0 16 16" className="size-4 text-icon-main" aria-hidden="true">
            <path d="M4 6L8 10L12 6" fill="none" stroke="currentColor" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </div>
  );
}