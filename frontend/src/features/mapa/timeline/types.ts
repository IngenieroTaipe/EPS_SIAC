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
}