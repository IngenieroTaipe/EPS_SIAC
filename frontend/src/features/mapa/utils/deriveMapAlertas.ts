import type { BackendAlertListItem } from '@/services/apiAlerts';
import { resolveEstadoFromStatusAndPhase } from '@/features/alertas/alertAdapters';
import type { Alerta, EstadoAlerta } from '../types/alerta';
import { ESTADOS_EN_MAPA } from '../types/alerta';

/**
 * Deriva un array de `Alerta` (para el ClusterAlertLayer del mapa) a
 * partir de los items del listado del backend.
 *
 * **1 marker por alerta**: si la alerta tiene varios `alert_clusters`
 * (varias zonas afectadas con su propio `representative_point`), se
 * calcula el centroide (promedio de LatLng) y se dibuja un único marker
 * allí.
 *
 * El `estado` se deriva del primer `historic_alert` (bitácora desc by
 * `created_at` desde el backend) usando el adapter del dominio. Las
 * alertas en estado `no-confirmado` NO se dibujan en el mapa (solo
 * aparecen en el tabular).
 */
export function deriveMapAlertas(items: BackendAlertListItem[]): Alerta[] {
  const alertas: Alerta[] = [];
  for (const item of items) {
    // Centroide de los representative_point no nulos.
    const points = item.alert_clusters
      .map((c) => c.representative_point?.coordinates)
      .filter((c): c is [number, number] => !!c);
    if (points.length === 0) continue;

    const sumLng = points.reduce((s, c) => s + c[0], 0);
    const sumLat = points.reduce((s, c) => s + c[1], 0);
    const lng = sumLng / points.length;
    const lat = sumLat / points.length;

    // Estado actual = primera entrada del historial (desc por created_at).
    const latest = item.historic_alert?.[0];
    const estadoHistorico = latest
      ? resolveEstadoFromStatusAndPhase(latest.status_name, latest.phase_name)
      : 'predicho';
    const estado = estadoHistorico as EstadoAlerta;

    // Las alertas en `no-confirmado` solo viven en el tabular.
    if (!ESTADOS_EN_MAPA.has(estado)) continue;

    alertas.push({
      id: item.code,
      componenteId: '',
      estado,
      lat,
      lng,
      mensaje: `Intensidad: ${item.max_intensity_mm_h} mm/h`,
      nivel: item.max_threshold ?? item.natural_phenomena_name ?? 'Precipitación',
      fecha: item.start_time_local ?? new Date().toISOString(),
    });
  }
  return alertas;
}