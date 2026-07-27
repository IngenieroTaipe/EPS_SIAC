/**
 * Tipos del dominio "Alerta Histórica" para la pantalla de Gestión de Alertas.
 *
 * Ciclo de vida del flujo (según especificación del usuario):
 *
 *   PREDICHO  ──►  EN_ESPERA_CONFIRMACION  ──┬──► NO_CONFIRMADO  (terminal)
 *                                            └──► CONFIRMADO
 *                                                       │
 *                                                       ▼
 *                                              EN_ESPERA_REPORTE
 *                                                       │
 *                                            ┌──────────┴──────────┐
 *                                            ▼                     ▼
 *                                  (no hubo daños)         (hubo daños)
 *                                       ATENDIDO          EN_PROCESO_ATENCION
 *                                       (terminal)              │
 *                                                                ▼
 *                                                            ATENDIDO
 *                                                            (terminal)
 *
 * Para el STEPPER visual se agrupa en 3 fases:
 *   1) Notificado   = PREDICHO | EN_ESPERA_CONFIRMACION | NO_CONFIRMADO
 *   2) Confirmado   = CONFIRMADO | EN_ESPERA_REPORTE | EN_PROCESO_ATENCION
 *   3) Atendido     = ATENDIDO
 *
 * El backend calculará y persistirá el estado actual; el frontend solo
 * actualiza el estado cuando el usuario hace "Guardar y Cambiar Estado"
 * (o cuando un timer automático corre: p.ej. EN_ESPERA → NO_CONFIRMADO
 * tras 60 min, EN_PROCESO → recordatorio a 72 h).
 *
 * Contrato esperado del backend:
 *   GET /api/alerts/:id/     → AlertaHistorica
 *   PATCH /api/alerts/:id/   → { estado, fecha_real_inicio?, reporte_danos?, reporte_acciones?, ... }
 *                              → devuelve la AlertaHistorica actualizada
 */

/** Estado interno del flujo de vida de una alerta. */
export type EstadoAlertaHistorica =
  | 'predicho'
  | 'en-espera-confirmacion'
  | 'no-confirmado'
  | 'confirmado'
  | 'en-espera-reporte'
  | 'en-proceso-atencion'
  | 'atendido';

/** Fase visual del stepper (3 macros). */
export type FaseStepper = 'notificado' | 'confirmado' | 'atendido';

/** Estado visual de un paso del stepper. */
export type EstadoPaso = 'hecho' | 'proceso' | 'falta';

/** Sexo umbrales de precipitación usados en el contexto meteorológico. */
export type UmbralPrecipitacion =
  | 'moderadamente-lluvioso'
  | 'lluvioso'
  | 'muy-lluvioso'
  | 'extremadamente-lluvioso';

/** Registro de fecha de cada transición del flujo. */
export interface HistoricoEstado {
  estado: EstadoAlertaHistorica;
  fecha: string; // ISO 8601
}

/** Reporte de daños (aparece solo cuando el flujo lo pide). */
export interface ReporteDanos {
  descripcion: string;
  /** ¿Hubo daños? Si no, el flujo pasa directo a Atendido. */
  huboDanos: boolean;
  fechaRegistro: string;
}

/** Reporte de acciones tomadas (aparece solo cuando el flujo lo pide). */
export interface ReporteAcciones {
  descripcion: string;
  fechaFinalizacion: string;
}

/** Alerta histórica completa, así la devolverá el backend. */
export interface AlertaHistorica {
  /** ID estable, ej. "PK-0001". */
  id: string;
  /** Unidad operativa asignada. */
  unidadOperativa: string;
  /** Distrito afectado. */
  distrito: string;
  /** Estado actual del flujo. */
  estado: EstadoAlertaHistorica;
  /** Fenómeno climático detectado (ej. "Lluvia"). */
  fenomeno: string;
  /** Umbral de precipitación que activó la alerta. */
  umbral: UmbralPrecipitacion;
  /** Fecha y hora de CREACIÓN de la alerta (ISO 8601). */
  fechaCreacion: string;
  /** Fecha y hora de NOTIFICACIÓN al usuarios (ISO 8601). */
  fechaNotificacion: string;
  /** Fecha y hora de inicio del fenómeno según la PREDICCIÓN (ISO 8601). */
  fechaPrediccionInicio: string;
  /** Fecha y hora real en que inició el fenómeno (tras confirmar). */
  fechaRealInicio?: string;
  /** Fecha y hora en que se cerró la alerta (tras Atendido). */
  fechaFinalizacion?: string;
  /** Historial completo de transiciones de estado. */
  historico: HistoricoEstado[];
  /** Reporte de daños (se llena en EN_ESPERA_REPORTE / EN_PROCESO_ATENCION). */
  reporteDanos?: ReporteDanos;
  /** Reporte de acciones (se llena en EN_PROCESO_ATENCION / ATENDIDO). */
  reporteAcciones?: ReporteAcciones;
}

/** Mapa estado → siguiente estado válido al hacer "Guardar y Cambiar Estado". */
export const NEXT_ESTADO: Partial<Record<EstadoAlertaHistorica, EstadoAlertaHistorica>> = {
  'predicho': 'en-espera-confirmacion',
  'en-espera-confirmacion': 'confirmado', // el flujo normal; también puede ir a 'no-confirmado'
  'confirmado': 'en-espera-reporte',
  'en-espera-reporte': 'en-proceso-atencion', // si hubo daños; Dentro del flujo puede ir a 'atendido' si no hubo
  'en-proceso-atencion': 'atendido',
  // Estados terminales o sin next explícito.
  'no-confirmado': 'no-confirmado',
  'atendido': 'atendido',
};

/** Etiquetas legibles para el botón de estado. */
export const ESTADO_LABEL: Record<EstadoAlertaHistorica, string> = {
  'predicho': 'Predicho',
  'en-espera-confirmacion': 'En espera de confirmación',
  'no-confirmado': 'No confirmado',
  'confirmado': 'Confirmado',
  'en-espera-reporte': 'En espera de reporte',
  'en-proceso-atencion': 'En proceso de atención',
  'atendido': 'Atendido',
};