/**
 * Utilidad de conversión bidireccional UTM ↔ Lat/Lon (WGS84).
 *
 * Para Perú, los husos UTM relevantes son:
 *   - Huso 17S (oeste de Perú,andin occidental)
 *   - Huso 18S (centro y parte del este de Perú)
 *   - Huso 19S (extremo este, selva)
 *
 * Pichanaqui (centro de la EPS Selva Central) está en el huso 18S.
 *
 * Las fórmulas implementadas siguen el estándar WGS84 (ellipsoide
 * WGS84) y son precisas hasta ~1 metro en la zona del Perú. Para uso
 * general sin precisión cotidal sirve perfectamente.
 *
 * Referencias:
 *   - USGS "Map Projections - A Working Manual" (Snyder, 1987)
 *   - Wikipedia: Universal Transverse Mercator coordinate system
 *
 * Funciones públicas:
 *   - `utmToLatLon(easting, northing, zoneNum, zoneLetter)`
 *   - `latLonToUtm(lat, lon, zoneNum?)`
 *
 * zona por defecto para Pichanaqui: 18S (hemisferio sur).
 */

const A = 6378137; // semieje mayor WGS84 (m)
const F = 1 / 298.257223563; // aplanamiento WGS84
const K0 = 0.9996; // factor de escala UTM
const RHO = 180 / Math.PI;

interface LatLon {
  latitude: number;
  longitude: number;
}

interface UTM {
  easting: number;
  northing: number;
  zoneNum: number;
  zoneLetter: string;
}

/** Convierte UTM → Lat/Lon (WGS84). */
export function utmToLatLon(
  easting: number,
  northing: number,
  zoneNum: number,
  zoneLetter: string,
): LatLon {
  const hemisphere = zoneLetter.toUpperCase() === 'N' ? 1 : -1;

  const e2 = 2 * F - F * F;
  const ePrim2 = e2 / (1 - e2);

  const x = easting - 500000;
  const y = hemisphere > 0 ? northing : northing - 10_000_000;

  const longOrigin = (zoneNum - 1) * 6 - 180 + 3;

  const m = y / K0;
  const mu = m / (A * (1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256));

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const phi1Rad =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

  const n1 = A / Math.sqrt(1 - e2 * Math.sin(phi1Rad) ** 2);
  const t1 = Math.tan(phi1Rad) ** 2;
  const c1 = ePrim2 * Math.cos(phi1Rad) ** 2;
  const r1 = A * (1 - e2) / (1 - e2 * Math.sin(phi1Rad) ** 2) ** 1.5;
  const d = x / (n1 * K0);

  const lat =
    phi1Rad -
    (n1 * Math.tan(phi1Rad) / r1) *
      (d ** 2 / 2 -
        (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * ePrim2) * d ** 4 / 24 +
        (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * ePrim2 - 3 * c1 ** 2) *
          d ** 6 / 720);

  const lon =
    longOrigin / RHO +
    (d -
      (1 + 2 * t1 + c1) * d ** 3 / 6 +
      (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * ePrim2 + 24 * t1 ** 2) *
        d ** 5 / 120) /
      Math.cos(phi1Rad);

  return {
    latitude: lat * RHO,
    longitude: lon * RHO,
  };
}

/** Convierte Lat/Lon → UTM (WGS84). */
export function latLonToUtm(latitude: number, longitude: number, zoneNum?: number): UTM {
  const lat = latitude / RHO;
  const lon = longitude / RHO;

  // Calcular zona automáticamente si no se especifica.
  let zone = zoneNum;
  if (!zone) {
    zone = Math.floor((longitude + 180) / 6) + 1;
  }
  const longOrigin = (zone - 1) * 6 - 180 + 3;
  const longOriginRad = longOrigin / RHO;

  const e2 = 2 * F - F * F;
  const ePrim2 = e2 / (1 - e2);

  const n = A / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const t = Math.tan(lat) ** 2;
  const c = ePrim2 * Math.cos(lat) ** 2;
  const ALocal = Math.cos(lat) * (lon - longOriginRad);

  const M =
    A *
    ((1 - e2 / 4 - (3 * e2 ** 2) / 64 - (5 * e2 ** 3) / 256) * lat -
      ((3 * e2) / 8 + (3 * e2 ** 2) / 32 + (45 * e2 ** 3) / 1024) * Math.sin(2 * lat) +
      ((15 * e2 ** 2) / 256 + (45 * e2 ** 3) / 1024) * Math.sin(4 * lat) -
      ((35 * e2 ** 3) / 3072) * Math.sin(6 * lat));

  const easting =
    K0 * n * (ALocal + ((1 - t + c) * ALocal ** 3) / 6 +
      ((5 - 18 * t + t ** 2 + 72 * c - 58 * ePrim2) * ALocal ** 5) / 120) +
    500000;

  const northing =
    K0 *
    (M +
      n *
        Math.tan(lat) *
        (ALocal ** 2 / 2 +
          ((5 - t + 9 * c + 4 * c ** 2) * ALocal ** 4) / 24 +
          ((61 - 58 * t + t ** 2 + 600 * c - 330 * ePrim2) * ALocal ** 6) / 720));

  // Letra de la zona para hemisferio (C-X para sur, N-X para norte).
  const zoneLetter = latitude >= 0 ? 'N' : 'S';

  return {
    easting: Math.round(easting * 100) / 100,
    northing: Math.round(northing * 100) / 100,
    zoneNum: zone,
    zoneLetter,
  };
}

/** Zona UTM por defecto para el sistema (Pichanaqui: 18 sur). */
export const ZONA_UTM_DEFAULT = 18;
export const ZONA_LETRA_DEFAULT = 'S';