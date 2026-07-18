import type { EstadoAlertaHistorica } from './types';

/**
 * Determina si una alerta en `estado` debe mostrar el reporte de daños.
 *
 * El flujo abre el reporte de daños a partir de "en-espera-reporte" y se
 * mantiene visible (read-only en algunos casos) hasta el final.
 */
export function shouldShowReporteDanos(estado: EstadoAlertaHistorica): boolean {
  return (
    estado === 'en-espera-reporte' ||
    estado === 'en-proceso-atencion' ||
    estado === 'atendido'
  );
}

/**
 * Determina si el reporte de daños es editable.
 *
 * Es editable solo en "en-espera-reporte" (momento de clasificar daños).
 * En etapas posteriores ya está lleno y la spec dice que dentro de las
 * 2 horas posteriores al cambio a NO_CONFIRMADO se puede editar manualmente;
 * aquí simplificamos: read-only una vez guardado.
 */
export function isReporteDanosEditable(estado: EstadoAlertaHistorica): boolean {
  return estado === 'en-espera-reporte';
}

/**
 * Determina si una alerta en `estado` debe mostrar el reporte de acciones.
 *
 * Aparece a partir de "en-proceso-atencion" y se mantiene hasta el final.
 */
export function shouldShowReporteAcciones(estado: EstadoAlertaHistorica): boolean {
  return estado === 'en-proceso-atencion' || estado === 'atendido';
}

/**
 * Determina si el reporte de acciones es editable.
 *
 * Editable en "en-proceso-atencion" (cuando se está gestionando).
 * En "atendido", la spec permite editar el reporte dentro de los 2 días
 * siguientes; aquí simplificamos: read-only una vez cerrada.
 */
export function isReporteAccionesEditable(estado: EstadoAlertaHistorica): boolean {
  return estado === 'en-proceso-atencion';
}