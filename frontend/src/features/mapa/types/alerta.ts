/**
 * Tipos de dominio "Alertas" de la EPS.
 *
 * Las alertas representan eventos ocurridos en componentes de la red
 * de agua (p.ej. precipitaciones extremas que afectan captaciones,
 * reservorios, etc.). Cada alerta se asocia a un componente y tiene
 * un estado del flujo de trabajo.
 *
 * Contrato esperado del backend (cuando se integre):
 *   GET /api/alerts/?unidad=ID
 *   → { alertas: Alerta[] }
 *
 *   Alerta = {
 *     id: string,
 *     componente_id: string,   // Referencia a un Componente
 *     estado: 'no-confirmado' | 'confirmado' | 'en-espera' | 'en-proceso' | 'atendido' | 'predicho',
 *     nivel: string,           // p.ej. "precipitacion"
 *     mensaje: string,
 *     lat: number, lng: number, // Posición de la alerta (igual a la del componente o de la zona afectada)
 *     fecha: string,           // ISO 8601
 *   }
 *
 * Visualización en el mapa (ver `AlertLayer.tsx`):
 *   - Zoom ALTO (>= ALERT_ZOOM_DETAIL): marcadores individuales con
 *     `danger.svg`, `warning.svg`, `success.svg`, `in-process-resolve.svg`.
 *   - Zoom BAJO (< ALERT_ZOOM_DETAIL): marcadores agregados/clúster con
 *     `danger-number.svg`, `warning-number.svg`, `success-number.svg` (sin
 *     resolve) y número total encima indicando cuántas alertas hay en la zona.
 */

/** Estado de la alerta — coincide con los tokens `alerts.status.*` de Tailwind. */
export type EstadoAlerta =
  | 'no-confirmado'
  | 'confirmado'
  | 'en-espera-confirmacion'
  | 'en-proceso-atencion'
  | 'atendido'
  | 'predicho';

/**
 * Tipo de vista de la alerta — lo decide el AlertLayer según el zoom.
 * Sirve por si necesitas lógica condicional en otros sitios.
 */
export type VistaAlerta = 'detalle' | 'agrupada';

/** Alerta completa, una por cada evento sobre un componente. */
export interface Alerta {
  /** ID estable (ej. "ALT-001"). */
  id: string;
  /** ID del componente afectado (FK a `Componente.id`). */
  componenteId: string;
  /** Estado del flujo de trabajo. */
  estado: EstadoAlerta;
  /** Latitud (WGS84) — normalmente = componente.lat. */
  lat: number;
  /** Longitud (WGS84) — normalmente = componente.lng. */
  lng: number;
  /** Mensaje descriptivo de la alerta. */
  mensaje: string;
  /** Nivel/Categoría de la alerta (texto libre, futuro enum). */
  nivel: string;
  /** Fecha ISO 8601. */
  fecha: string;
}

/** Respuesta empaquetada del endpoint backend. */
export interface AlertasResponse {
  alertas: Alerta[];
}

/**
 * Nivel de zoom a partir del cual se muestran alertas y componentes en
 * su vista DETALLE (marcadores individuales).
 *
 * Por debajo de este zoom:
 *   - Componencias: se ocultan por completo (no se ve nada de su capa).
 *   - Alertas: pasan a vista AGRUPADA (clusters con número).
 *
 * Threshold único para ambas capas — así al alejar el mapa ambos
 * componentes desaparecen y las alertas se transforman al mismo tiempo.
 * Decision: 12 (barrio aprox.). Ajusta aquí para ambas.
 */
export const ALERT_ZOOM_DETAIL = 11;
export const COMPONENT_ZOOM_MIN = 5;