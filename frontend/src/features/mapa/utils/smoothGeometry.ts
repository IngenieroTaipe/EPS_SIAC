import { polygonSmooth, union, featureCollection, polygon } from '@turf/turf';
import type {
  Feature,
  Geometry,
  MultiPolygon,
  Polygon,
} from 'geojson';

/**
 * Disuelve (union) los sub-polígonos de un MultiPolygon que comparten bordes.
 * Evita que el suavizado de Chaikin se aplique sub-polígono por sub-polígono
 * (celda por celda) generando burbujas o monedas individuales con huecos.
 */
function dissolveGeometry(
  geom: Polygon | MultiPolygon,
): Feature<Polygon | MultiPolygon> {
  if (geom.type === 'Polygon') {
    return polygon(geom.coordinates);
  }
  const polys = geom.coordinates.map((coords) => polygon(coords));
  if (polys.length === 0) return polygon([]);
  if (polys.length === 1) return polys[0];

  try {
    let merged: Feature<Polygon | MultiPolygon> = polys[0];
    for (let i = 1; i < polys.length; i++) {
      const res = union(featureCollection([merged, polys[i]]));
      if (res && res.geometry) {
        merged = res as Feature<Polygon | MultiPolygon>;
      }
    }
    return merged;
  } catch {
    return polygon(geom.coordinates[0]);
  }
}

/**
 * smoothGeometry — suavizado visual de geometrías mediante disolución de celdas
 * contiguas + algoritmo de Chaikin (corner-cutting / B-spline).
 *
 * 1. Fusiona (union) todos los sub-polígonos o celdas contiguas que forman el
 *    clúster para eliminar fronteras internas y bordes celda-a-celda.
 * 2. Aplica el suavizado de Chaikin únicamente sobre el contorno exterior
 *    unificado del clúster resultante.
 *
 * @param geometry   Geometría GeoJSON Polygon o MultiPolygon a suavizar.
 * @param iterations Nº de iteraciones de Chaikin (default 2).
 * @returns          Geometría suavizada (Polygon | MultiPolygon).
 */
export function smoothGeometry(
  geometry: Geometry | null | undefined,
  iterations = 2,
): Polygon | MultiPolygon | null {
  if (!geometry) return null;
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
    return null;
  }

  const iterCount =
    typeof iterations === 'number' && Number.isFinite(iterations)
      ? Math.max(1, Math.min(4, Math.round(iterations)))
      : 2;

  try {
    // 1) Fusionar primero (union/dissolve) las celdas o partes contiguas
    const mergedFeature = dissolveGeometry(geometry);

    // 2) Suavizar el contorno exterior fusionado con Chaikin
    const smoothedFC = polygonSmooth(mergedFeature, { iterations: iterCount });
    const smoothed = smoothedFC?.features?.[0]?.geometry;

    if (
      smoothed &&
      (smoothed.type === 'Polygon' || smoothed.type === 'MultiPolygon')
    ) {
      return smoothed as Polygon | MultiPolygon;
    }

    return geometry as Polygon | MultiPolygon;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[smoothGeometry] excepción de Turf polygonSmooth:', err, {
      type: geometry.type,
      iterations: iterCount,
    });
    return geometry as Polygon | MultiPolygon;
  }
}