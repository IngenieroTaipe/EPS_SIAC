import type { GfsFrameId, GfsTemporalStatus } from '@/features/mapa/types/gfs';

/**
 * Frame temporal dentro de la ventana 18h — agrupa los clústeres que
 * comparten `(temporal_status, time_step)`.
 */
export interface GfsFrame extends GfsFrameId {
  /** Etiqueta "HH:mm" en hora local PET (extraída de timestamp_str). */
  label: string;
  temporal_status: GfsTemporalStatus;
  time_step: number;
  /**
   * Fecha/hora real de Perú del frame (parseada de `timestamp_str`,
   * formato "YYYY-MM-DD HH:mm PET"). Wall-clock peruano interpretado en
   * el timezone del runtime (ver `parsePetTimestamp` para detalles).
   * Define el origen DEL FRAME en el eje del timeline — el slot 0 es
   * `frames[0].timestampDate`, no "hoy a las 20:00".
   */
  timestampDate: Date;
}