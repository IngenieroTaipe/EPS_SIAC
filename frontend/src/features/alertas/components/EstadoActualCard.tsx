import {
  tiempoTranscurrido,
  fechaReferenciaTiempo,
  labelTiempoTranscurrido,
} from '../stepper-utils';
import { ESTADO_LABEL, type AlertaHistorica, type EstadoAlertaHistorica } from '../types';

/**
 * Tarjeta "Estado actual".
 *
 * Muestra:
 *   - Badge grande coloreado con el estado actual de la alerta (usando los
 *     tokens `alerts.status.*` de Tailwind). El badge incluye un círculo
 *     (token `circle.svg` conceptualmente) + el nombre del estado.
 *   - Tiempo transcurrido desde la creación de la alerta ("2 h 30 min")
 *     con icono de reloj + subtexto "Desde la creación de la alerta".
 *
 * Colores del badge por estado (de `tailwind.config.ts`):
 *   predicho                    → #f9d800 (amarillo)
 *   en-espera-confirmacion       → #ffb03d (naranja)
 *   no-confirmado               → #7b818a (gris)
 *   confirmado                  → #ff3737 (rojo) [label "confirmado-reporte"]
 *   en-proceso-atencion          → #0daec9 (cyan)
 *   atendido                    → #1eff6b (verde)
 *
 * Los tokens ya usan fill con 50% opacidad para el fondo y color sólido
 * para el borde + texto + círculo interno. Usamos las variantes `*_fill`
 * automáticamente vía la clase `bg-alerts-status-fill-<estado>`.
 */
interface EstadoActualCardProps {
  alerta: AlertaHistorica;
}

/** Mapa estado → clases Tailwind (color sólido + fill). */
const STATUS_CLASSES: Record<EstadoAlertaHistorica, {
  bgFill: string;
  outline: string;
  text: string;
  dot: string;
}> = {
  'predicho': {
    bgFill: 'bg-alerts-status-fill-predicho',
    outline: 'outline-alerts-status-predicho',
    text: 'text-alerts-status-predicho',
    dot: 'bg-alerts-status-predicho',
  },
  'en-espera-confirmacion': {
    bgFill: 'bg-alerts-status-fill-en-espera-confirmacion',
    outline: 'outline-alerts-status-en-espera-confirmacion',
    text: 'text-alerts-status-en-espera-confirmacion',
    dot: 'bg-alerts-status-en-espera-confirmacion',
  },
  'no-confirmado': {
    bgFill: 'bg-alerts-status-fill-no-confirmado',
    outline: 'outline-alerts-status-no-confirmado',
    text: 'text-alerts-status-no-confirmado',
    dot: 'bg-alerts-status-no-confirmado',
  },
  'confirmado': {
    bgFill: 'bg-alerts-status-fill-confirmado-reporte',
    outline: 'outline-alerts-status-confirmado-reporte',
    text: 'text-alerts-status-confirmado-reporte',
    dot: 'bg-alerts-status-confirmado-reporte',
  },
  'en-espera-reporte': {
    // Reusa los colores de confirmado (no hay token propio en paleta).
    bgFill: 'bg-alerts-status-fill-confirmado-reporte',
    outline: 'outline-alerts-status-confirmado-reporte',
    text: 'text-alerts-status-confirmado-reporte',
    dot: 'bg-alerts-status-confirmado-reporte',
  },
  'en-proceso-atencion': {
    bgFill: 'bg-alerts-status-fill-en-proceso-atencion',
    outline: 'outline-alerts-status-en-proceso-atencion',
    text: 'text-alerts-status-en-proceso-atencion',
    dot: 'bg-alerts-status-en-proceso-atencion',
  },
  'atendido': {
    bgFill: 'bg-alerts-status-fill-atendido',
    outline: 'outline-alerts-status-atendido',
    text: 'text-alerts-status-atendido',
    dot: 'bg-alerts-status-atendido',
  },
};

export function EstadoActualCard({ alerta }: EstadoActualCardProps) {
  const cls = STATUS_CLASSES[alerta.estado];
  const label = ESTADO_LABEL[alerta.estado];
  // El "tiempo transcurrido" se cuenta desde la fecha de referencia según
  // el estado: desde la predicción para los pre-confirmación, desde la
  // confirmación para los demás (ver `fechaReferenciaTiempo`).
  const tiempo = tiempoTranscurrido(fechaReferenciaTiempo(alerta));
  const tiempoLabel = labelTiempoTranscurrido(alerta);

  return (
    <div className="self-stretch bg-background-main rounded-2xl outline outline-1 outline-offset-[-1px] outline-input-stroke-main px-6 py-5 flex flex-col items-start gap-4">
      <h2 className="self-stretch text-text-primary text-base font-bold font-sans leading-6">
        Estado actual
      </h2>

      <div className="self-stretch inline-flex justify-start items-start gap-6">
        <div className="w-56 inline-flex flex-col items-start gap-1.5">
          <span className="self-stretch text-text-primary text-sm font-normal font-sans leading-5">
            Estado de la alerta
          </span>

          <div
            className={`self-stretch px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] inline-flex justify-start items-center gap-3 ${cls.bgFill} ${cls.outline}`}
          >
            <div className="flex justify-start items-center gap-1.5">
              {/* Círculo sólido del color del estado (token circle.svg conceptual) */}
              <span className={`size-2 rounded-full ${cls.dot}`} />
              <span className={`text-sm font-bold font-sans leading-5 ${cls.text}`}>
                {label}
              </span>
            </div>
          </div>

          {/* Tiempo transcurrido */}
          <div className="w-56 pt-5 flex flex-col items-start gap-0.5">
            <span className="self-stretch text-text-primary text-xs font-normal font-sans leading-5">
              Tiempo transcurrido
            </span>
            <div className="self-stretch pt-1 inline-flex justify-start items-center gap-2">
              <svg viewBox="0 0 20 20" className="size-5 text-icon-main" aria-hidden="true">
                <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.67" />
                <path d="M10 5V10L13 12" fill="none" stroke="currentColor" strokeWidth="1.67" strokeLinecap="round" />
              </svg>
              <span className="text-text-primary text-lg font-bold font-sans leading-7">
                {tiempo}
              </span>
            </div>
            <span className="self-stretch text-text-secondary text-xs font-normal font-sans leading-4">
              {tiempoLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}