import type { EstadoAlertaHistorica } from './types';

/**
 * Determina si una alerta en `estado` debe mostrar el reporte de daños.
 *
 * Visible desde `en-espera-reporte` inclusive, pero allí viene como
 * read-only (vacío, "Pendiente de evaluar"). Recién se vuelve editable
 * en `en-proceso-atencion` (ver `isReporteDanosEditable`).
 *
 * Razón: el backend (`AlertTransitionSerializer.validate` línea 499)
 * exige `taken_actions` siempre que mandes `damage_report` sin importar
 * la fase; nos obliga a persistir daño y acciones juntos en el PATCH
 * final a ATENDIDO. Por eso no se permite editar daño en `en-espera-reporte`.
 */
export function shouldShowReporteDanos(estado: EstadoAlertaHistorica): boolean {
  return (
    estado === 'en-espera-reporte' ||
    estado === 'en-proceso-atencion' ||
    estado === 'atendido'
  );
}

/**
 * El daño es editable en `en-espera-reporte`: el operador describe los
 * daños mientras espera resultados. Se persiste recién en el PATCH final
 * hacia `atendido` (mandado junto con `taken_actions`), porque el backend
 * tiene un check en `AlertTransitionSerializer.validate` línea 499 que
 * exige `taken_actions` siempre que se mande `damage_report` sin importar
 * la fase. Mientras tanto el daño queda en state local del componente
 * GestionAlertas (se pierde si el usuario recarga; aceptable mientras
 * el backend no arregle el bug).
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
 * Las acciones son editables en `en-proceso-atencion`, mientras el
 * operador gestiona la alerta. En `atendido` ya está sellado (solo el
 * endpoint de update-results dentro de 48h lo desbloquearía).
 */
export function isReporteAccionesEditable(estado: EstadoAlertaHistorica): boolean {
  return estado === 'en-proceso-atencion';
}