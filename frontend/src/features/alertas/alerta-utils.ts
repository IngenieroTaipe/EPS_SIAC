import type { EstadoAlertaHistorica, UmbralPrecipitacion } from './types';

/**
 * alerta-utils — utilidades visuales compartidas del dominio "alertas".
 *
 * Centraliza las etiquetas y los tokens de color por estado/umbral para que
 * la tabla, los chips de filtro, el detail sheet y la página de gestión
 * consuman la misma fuente y no diverjan (antes había `STATUS_BADGE` en
 * `AlertaRow`, `ESTADO_DOT` en `HistoricoAlertasPage`, `UMBRAL_LABEL`
 * duplicado en `ContextoCard`/`AlertaRow`, etc.).
 *
 * Los tokens de color provienen de `tailwind.config.ts > alerts.status` y
 * `alerts.status.fill-*` (ver `styles/variables.css`). Cada estado define:
 *   - `dot`:   color sólido del círculo/cuadro indicador (chips, sheet).
 *   - `badge`: clases `bg-* text-*` completas para el badge del estado en
 *              la tabla y en el sheet (mismas que usa `AlertaRow` hoy).
 */

/** Etiquetas legibles para los umbrales de precipitación. */
export const UMBRAL_LABEL: Record<UmbralPrecipitacion, string> = {
  'moderadamente-lluvioso': 'Moderadamente Lluvioso',
  'lluvioso': 'Lluvioso',
  'muy-lluvioso': 'Muy Lluvioso',
  'extremadamente-lluvioso': 'Extremadamente Lluvioso',
};

/** Estilos visuales unificados por estado. */
export const ESTADO_VISUAL: Record<
  EstadoAlertaHistorica,
  { dot: string; badge: string }
> = {
  'predicho': {
    dot: 'bg-alerts-status-predicho',
    badge: 'bg-alerts-status-predicho text-text-primary',
  },
  'en-espera-confirmacion': {
    dot: 'bg-alerts-status-en-espera-confirmacion',
    badge: 'bg-alerts-status-en-espera-confirmacion text-text-primary',
  },
  'no-confirmado': {
    dot: 'bg-alerts-status-no-confirmado',
    badge: 'bg-alerts-status-no-confirmado text-text-invert-primary',
  },
  'confirmado': {
    dot: 'bg-alerts-status-confirmado-reporte',
    badge: 'bg-alerts-status-confirmado-reporte text-text-invert-primary',
  },
  'en-espera-reporte': {
    dot: 'bg-alerts-status-confirmado-reporte',
    badge: 'bg-alerts-status-confirmado-reporte text-text-invert-primary',
  },
  'en-proceso-atencion': {
    dot: 'bg-alerts-status-en-proceso-atencion',
    badge: 'bg-alerts-status-en-proceso-atencion text-text-invert-primary',
  },
  'atendido': {
    dot: 'bg-alerts-status-atendido',
    badge: 'bg-alerts-status-atendido text-text-primary',
  },
};

/** Estados filtrables individualmente en el histórico (orden legible). */
export const ESTADOS_FILTRABLES: EstadoAlertaHistorica[] = [
  'predicho',
  'en-espera-confirmacion',
  'no-confirmado',
  'confirmado',
  'en-espera-reporte',
  'en-proceso-atencion',
  'atendido',
];