import type { AlertaHistorica } from '../types';

/**
 * Mock de una alerta histórica en estado "en-proceso-atencion".
 *
 * Esto significa que el stepper mostrará:
 *   - Notificado → HECHO (con fecha)
 *   - Confirmado → HECHO (con fecha)
 *   - Atendido   → PROCESO
 *
 * El reporte de daños ya debe estar lleno (llenado en EN_ESPERA_REPORTE).
 * El reporte de acciones también está abierto (invoke el flujo actual).
 *
 * Para probar otros estados, cambia `estado` y ajusta los campos
 * (`fechaRealInicio`, `fechaFinalizacion`, `reporteDanos`, `reporteAcciones`).
 *
 * Si cambias el estado, los componentes dependientes reaccionan
 * automáticamente (Stepper, estado actual, reportes condicionales).
 */
export const mockAlertaHistorica: AlertaHistorica = {
  id: 'PK-0001',
  unidadOperativa: 'Pichanaqui',
  distrito: 'Pichanaqui',
  estado: 'en-espera-confirmacion',
  fenomeno: 'Lluvia',
  umbral: 'moderadamente-lluvioso',
  fechaCreacion: '2026-06-22T15:40:00-05:00',
  fechaNotificacion: '2026-06-22T15:45:00-05:00',
  fechaPrediccionInicio: '2026-06-22T16:45:00-05:00',
  fechaRealInicio: '2026-06-22T16:50:00-05:00',
  // fechaFinalizacion no está: la alerta sigue en curso.
  historico: [
    { estado: 'predicho', fecha: '2026-06-22T15:45:00-05:00' },
    { estado: 'en-espera-confirmacion', fecha: '2026-06-22T16:45:00-05:00' },
    { estado: 'confirmado', fecha: '2026-06-22T17:10:00-05:00' },
    { estado: 'en-espera-reporte', fecha: '2026-06-22T17:30:00-05:00' },
    { estado: 'en-proceso-atencion', fecha: '2026-06-22T18:00:00-05:00' },
  ],
  reporteDanos: {
    descripcion:
      'Inundación menor en captación Río Pichanaqui. Sedimentos en el reservorio central.',
    huboDanos: true,
    fechaRegistro: '2026-06-22T17:30:00-05:00',
  },
  // reporteAcciones se llena solo al pasar a ATENDIDO (no está aquí todavía).
};