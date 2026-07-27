import type { AlertaHistorica } from '../types';

/**
 * Mock de la lista histórica de alertas que alimenta tanto la tabla del
 * mapa (MapAlertsPanel) como la pantalla de histórico con filtros
 * (HistoricoAlertasPage).
 *
 * Decisiones de diseño:
 *   - Solo `predicho`, `en-espera-confirmacion`, `confirmado`, `en-proceso-atencion`,
 *     `atendido`, `no-confirmado` son los estados más comunes en el histórico.
 *   - `lat`/`lng` de cada alerta NO están en el tipo `AlertaHistorica` original
 *     (la alerta histórica no sabe dónde está en el mapa), pero el panel del
 *     mapa necesita lat/lng para mostrar el marcador. Por eso añadimos un
 *     helper `toMapAlerta()` que derive lat/lng del componente asociado.
 *
 * En el futuro, el endpoint backend será algo como:
 *   GET /api/alerts/?unidad=ID&estado=...&desde=ISO&hasta=ISO
 *   → { alertas: AlertaHistorica[] }
 *
 * Si necesitas lat/lng, pedirlo como campo adicional en la response o
 * resolver via componenteId → cache de componentes.
 */

export const mockAlertasHistoricas: AlertaHistorica[] = [
  {
    id: 'PK-0001',
    unidadOperativa: 'Pichanaqui',
    distrito: 'Pichanaqui',
    estado: 'en-proceso-atencion',
    fenomeno: 'Precipitación',
    umbral: 'muy-lluvioso',
    fechaCreacion: '2026-07-06T17:00:00-05:00',
    fechaNotificacion: '2026-07-06T17:10:00-05:00',
    fechaPrediccionInicio: '2026-07-06T17:16:00-05:00',
    fechaRealInicio: '2026-07-06T17:30:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-07-06T17:10:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-07-06T17:16:00-05:00' },
      { estado: 'confirmado', fecha: '2026-07-06T17:30:00-05:00' },
      { estado: 'en-espera-reporte', fecha: '2026-07-06T18:00:00-05:00' },
      { estado: 'en-proceso-atencion', fecha: '2026-07-06T18:30:00-05:00' },
    ],
    reporteDanos: {
      descripcion: 'Inundación menor en captación Río Pichanaqui.',
      huboDanos: true,
      fechaRegistro: '2026-07-06T18:00:00-05:00',
    },
  },
  {
    id: 'PK-0002',
    unidadOperativa: 'Pichanaqui',
    distrito: 'Pichanaqui',
    estado: 'atendido',
    fenomeno: 'Precipitación',
    umbral: 'lluvioso',
    fechaCreacion: '2026-07-05T08:00:00-05:00',
    fechaNotificacion: '2026-07-05T08:10:00-05:00',
    fechaPrediccionInicio: '2026-07-05T09:00:00-05:00',
    fechaRealInicio: '2026-07-05T09:10:00-05:00',
    fechaFinalizacion: '2026-07-05T12:00:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-07-05T08:10:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-07-05T09:00:00-05:00' },
      { estado: 'confirmado', fecha: '2026-07-05T09:10:00-05:00' },
      { estado: 'en-espera-reporte', fecha: '2026-07-05T10:00:00-05:00' },
      { estado: 'en-proceso-atencion', fecha: '2026-07-05T10:30:00-05:00' },
      { estado: 'atendido', fecha: '2026-07-05T12:00:00-05:00' },
    ],
    reporteDanos: {
      descripcion: 'Sedimentos en reservorio central.',
      huboDanos: true,
      fechaRegistro: '2026-07-05T10:00:00-05:00',
    },
    reporteAcciones: {
      descripcion: 'Limpieza de sedimentos y recalibración de válvulas.',
      fechaFinalizacion: '2026-07-05T12:00:00-05:00',
    },
  },
  {
    id: 'PK-0003',
    unidadOperativa: 'Pichanaqui',
    distrito: 'Pichanaqui',
    estado: 'predicho',
    fenomeno: 'Precipitación',
    umbral: 'moderadamente-lluvioso',
    fechaCreacion: '2026-07-08T15:00:00-05:00',
    fechaNotificacion: '2026-07-08T15:05:00-05:00',
    fechaPrediccionInicio: '2026-07-09T08:00:00-05:00',
    historico: [{ estado: 'predicho', fecha: '2026-07-08T15:05:00-05:00' }],
  },
  {
    id: 'PK-0004',
    unidadOperativa: 'Pichanaqui',
    distrito: 'Pichanaqui',
    estado: 'en-espera-confirmacion',
    fenomeno: 'Precipitación',
    umbral: 'muy-lluvioso',
    fechaCreacion: '2026-07-08T16:00:00-05:00',
    fechaNotificacion: '2026-07-08T16:05:00-05:00',
    fechaPrediccionInicio: '2026-07-08T17:00:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-07-08T16:05:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-07-08T17:00:00-05:00' },
    ],
  },
  {
    id: 'PK-0005',
    unidadOperativa: 'San Ramón',
    distrito: 'San Ramón',
    estado: 'confirmado',
    fenomeno: 'Precipitación',
    umbral: 'extremadamente-lluvioso',
    fechaCreacion: '2026-07-07T10:00:00-05:00',
    fechaNotificacion: '2026-07-07T10:05:00-05:00',
    fechaPrediccionInicio: '2026-07-07T11:00:00-05:00',
    fechaRealInicio: '2026-07-07T11:10:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-07-07T10:05:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-07-07T11:00:00-05:00' },
      { estado: 'confirmado', fecha: '2026-07-07T11:10:00-05:00' },
    ],
  },
  {
    id: 'PK-0006',
    unidadOperativa: 'La Merced',
    distrito: 'La Merced',
    estado: 'no-confirmado',
    fenomeno: 'Precipitación',
    umbral: 'moderadamente-lluvioso',
    fechaCreacion: '2026-07-04T05:00:00-05:00',
    fechaNotificacion: '2026-07-04T05:10:00-05:00',
    fechaPrediccionInicio: '2026-07-04T06:00:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-07-04T05:10:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-07-04T06:00:00-05:00' },
      { estado: 'no-confirmado', fecha: '2026-07-04T07:00:00-05:00' },
    ],
  },
  {
    id: 'PK-0007',
    unidadOperativa: 'Oxapampa',
    distrito: 'Oxapampa',
    estado: 'atendido',
    fenomeno: 'Precipitación',
    umbral: 'lluvioso',
    fechaCreacion: '2026-07-02T14:00:00-05:00',
    fechaNotificacion: '2026-07-02T14:05:00-05:00',
    fechaPrediccionInicio: '2026-07-02T15:00:00-05:00',
    fechaRealInicio: '2026-07-02T15:10:00-05:00',
    fechaFinalizacion: '2026-07-02T18:00:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-07-02T14:05:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-07-02T15:00:00-05:00' },
      { estado: 'confirmado', fecha: '2026-07-02T15:10:00-05:00' },
      { estado: 'en-espera-reporte', fecha: '2026-07-02T16:00:00-05:00' },
      { estado: 'en-proceso-atencion', fecha: '2026-07-02T16:30:00-05:00' },
      { estado: 'atendido', fecha: '2026-07-02T18:00:00-05:00' },
    ],
    reporteDanos: {
      descripcion: 'Daños menores en tubería de conducción.',
      huboDanos: true,
      fechaRegistro: '2026-07-02T16:00:00-05:00',
    },
    reporteAcciones: {
      descripcion: 'Reparación de tramo afectado.',
      fechaFinalizacion: '2026-07-02T18:00:00-05:00',
    },
  },
  {
    id: 'PK-0008',
    unidadOperativa: 'Satipo',
    distrito: 'Satipo',
    estado: 'en-proceso-atencion',
    fenomeno: 'Precipitación',
    umbral: 'muy-lluvioso',
    fechaCreacion: '2026-07-08T11:00:00-05:00',
    fechaNotificacion: '2026-07-08T11:05:00-05:00',
    fechaPrediccionInicio: '2026-07-08T12:00:00-05:00',
    fechaRealInicio: '2026-07-08T12:10:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-07-08T11:05:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-07-08T12:00:00-05:00' },
      { estado: 'confirmado', fecha: '2026-07-08T12:10:00-05:00' },
      { estado: 'en-espera-reporte', fecha: '2026-07-08T13:00:00-05:00' },
      { estado: 'en-proceso-atencion', fecha: '2026-07-08T13:30:00-05:00' },
    ],
    reporteDanos: {
      descripcion: 'Anegamiento en planta de tratamiento de Satipo.',
      huboDanos: true,
      fechaRegistro: '2026-07-08T13:00:00-05:00',
    },
  },
  {
    id: 'PK-0009',
    unidadOperativa: 'Pichanaqui',
    distrito: 'Pichanaqui',
    estado: 'atendido',
    fenomeno: 'Precipitación',
    umbral: 'extremadamente-lluvioso',
    fechaCreacion: '2026-06-30T22:00:00-05:00',
    fechaNotificacion: '2026-06-30T22:10:00-05:00',
    fechaPrediccionInicio: '2026-06-30T23:00:00-05:00',
    fechaRealInicio: '2026-06-30T23:10:00-05:00',
    fechaFinalizacion: '2026-07-01T05:00:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-06-30T22:10:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-06-30T23:00:00-05:00' },
      { estado: 'confirmado', fecha: '2026-06-30T23:10:00-05:00' },
      { estado: 'en-espera-reporte', fecha: '2026-07-01T01:00:00-05:00' },
      { estado: 'en-proceso-atencion', fecha: '2026-07-01T01:30:00-05:00' },
      { estado: 'atendido', fecha: '2026-07-01T05:00:00-05:00' },
    ],
    reporteDanos: {
      descripcion: 'Captación sur con daños severos por inundación.',
      huboDanos: true,
      fechaRegistro: '2026-07-01T01:00:00-05:00',
    },
    reporteAcciones: {
      descripcion: 'Reconstrucción del muro de contención y reforzamiento.',
      fechaFinalizacion: '2026-07-01T05:00:00-05:00',
    },
  },
  {
    id: 'PK-0010',
    unidadOperativa: 'Pichanaqui',
    distrito: 'Pichanaqui',
    estado: 'confirmado',
    fenomeno: 'Precipitación',
    umbral: 'lluvioso',
    fechaCreacion: '2026-07-09T07:00:00-05:00',
    fechaNotificacion: '2026-07-09T07:05:00-05:00',
    fechaPrediccionInicio: '2026-07-09T08:00:00-05:00',
    fechaRealInicio: '2026-07-09T08:10:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-07-09T07:05:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-07-09T08:00:00-05:00' },
      { estado: 'confirmado', fecha: '2026-07-09T08:10:00-05:00' },
    ],
  },
  {
    id: 'PK-0011',
    unidadOperativa: 'San Ramón',
    distrito: 'San Ramón',
    estado: 'en-espera-reporte',
    fenomeno: 'Precipitación',
    umbral: 'muy-lluvioso',
    fechaCreacion: '2026-07-09T09:00:00-05:00',
    fechaNotificacion: '2026-07-09T09:05:00-05:00',
    fechaPrediccionInicio: '2026-07-09T10:00:00-05:00',
    fechaRealInicio: '2026-07-09T10:10:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-07-09T09:05:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-07-09T10:00:00-05:00' },
      { estado: 'confirmado', fecha: '2026-07-09T10:10:00-05:00' },
      { estado: 'en-espera-reporte', fecha: '2026-07-09T11:00:00-05:00' },
    ],
  },
  {
    id: 'PK-0012',
    unidadOperativa: 'Pichanaqui',
    distrito: 'Pichanaqui',
    estado: 'no-confirmado',
    fenomeno: 'Precipitación',
    umbral: 'moderadamente-lluvioso',
    fechaCreacion: '2026-07-03T18:00:00-05:00',
    fechaNotificacion: '2026-07-03T18:05:00-05:00',
    fechaPrediccionInicio: '2026-07-03T19:00:00-05:00',
    historico: [
      { estado: 'predicho', fecha: '2026-07-03T18:05:00-05:00' },
      { estado: 'en-espera-confirmacion', fecha: '2026-07-03T19:00:00-05:00' },
      { estado: 'no-confirmado', fecha: '2026-07-03T20:00:00-05:00' },
    ],
  },
];

/**
 * Mock agregado: alias para no romper consumidores del mock "único".
 * Reapunta el primer item de la lista (el mismo que usa `mockAlertaHistorica.ts`).
 */
export const mockAlertaHistoricaFromList = mockAlertasHistoricas[0];