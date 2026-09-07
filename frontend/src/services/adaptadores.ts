import type {
  BackendComponentListItem,
  BackendComponentListCoord,
  BackendMapComponent,
  BackendMapCoord,
} from '@/services/apiComponentes';
import type {
  Componente,
  ComponentesResponse,
  CriticidadComponente,
  TipoComponente,
} from '@/features/mapa/types/componente';
import { TIPO_LINEA } from '@/features/mapa/types/componente';

const TIPO_NAME_TO_ID: Record<string, TipoComponente> = {
  FUENTE: 'fuente',
  CAPTACIÓN: 'captacion',
  CAPTACION: 'captacion',
  RESERVORIO: 'reservorio',
  'ESTACIÓN DE BOMBEO Y REBOMBEO DE AGUA POTABLE': 'estacion-bombeo',
  'ESTACION DE BOMBEO Y REBOMBEO DE AGUA POTABLE': 'estacion-bombeo',
  'PLANTA DE TRATAMIENTO DE AGUA POTABLE': 'planta-tratamiento',
  'PLANTA DE TRATAMIENTO DE AGUAS RESIDUALES': 'planta-aguas-residuales',
  'UNIDADES DE DESINFECCIÓN': 'desinfeccion',
  'UNIDADES DE DESINFECCION': 'desinfeccion',
  'PUNTO DE PURGADO DE REDES': 'purgado-redes',
  'LÍNEA DE CONDUCCIÓN': 'linea-conduccion',
  'LINEA DE CONDUCCION': 'linea-conduccion',
  'LÍNEA DE ADUCCIÓN': 'linea-aduccion',
  'LINEA DE ADUCCION': 'linea-aduccion',
};

export function mapTipo(backendName: string): TipoComponente {
  const upper = backendName.toUpperCase();
  return TIPO_NAME_TO_ID[upper] ?? 'otro';
}

function mapCriticidad(name: string | undefined): CriticidadComponente {
  if (!name) return 'baja';
  const u = name.toUpperCase();
  if (u.includes('ALT')) return 'alta';
  if (u.includes('MED')) return 'media';
  return 'baja';
}

/**
 * Extrae el nombre de criticidad de una coord del listado/retrieve.
 * Tolerante a ambas formas del backend: objeto `{ id, name }`
 * (retrieve / CriticalityLightSerializer) o string `"ALTA"`
 * (StringRelatedField, si se reincorpora al light serializer).
 */
function critNameFromCoord(c: BackendComponentListCoord | undefined): string | undefined {
  if (!c?.criticality) return undefined;
  if (typeof c.criticality === 'string') return c.criticality;
  return c.criticality.name;
}

/**
 * Criticidad dominante de un componente = la peor (más alta) entre todos
 * sus vértices. Práctica estándar en GIS/monitoreo (rolls-up "worst-case"):
 * si cualquier vértice es ALTA, el componente entero se muestra como ALTA,
 * porque merece atención prioritaria aunque los demás vértices sean BAJA.
 *
 * Orden: alta > media > baja.
 */
function criticidadMaxima(criticidades: string[]): CriticidadComponente {
  let max: CriticidadComponente = 'baja';
  for (const c of criticidades) {
    const m = mapCriticidad(c);
    if (m === 'alta') return 'alta';
    if (m === 'media' && max === 'baja') max = 'media';
  }
  return max;
}

/**
 * Adapta la respuesta del listado de componentes al modelo del mapa/tabla.
 *
 * El `ComponentListSerializer` actual del backend NO incluye `geojson` ni
 * `criticality` en las coords (solo `utm_coords`). Por tanto:
 *   - `lat`/`lng` quedan `undefined` (la tabla no los necesita; el mapa
 *     usa el endpoint `/map` vía `adaptarComponentesMap`).
 *   - `criticidad` queda como 'baja' (default) cuando no viene.
 *   - UTM se conserva (viene en `utm_coords`).
 *   - Los componentes ya NO se descartan por falta de geojson: la tabla
 *     debe mostrarlos igual.
 */
export function adaptarComponentes(
  comps: BackendComponentListItem[],
): ComponentesResponse {
  const componentes: Componente[] = [];

  for (const comp of comps) {
    const tipo = mapTipo(comp.type);
    const coordList: BackendComponentListCoord[] = comp.coords ?? [];

    // UTM del primer vértice (si el backend lo trae).
    function utmFromCoord(c: BackendComponentListCoord) {
      const u = c.utm_coords;
      return u
        ? { easting: u.easting, northing: u.northing, zone: u.zone }
        : undefined;
    }
    const primerUtm = utmFromCoord(coordList[0]);
    const verticesUtm = coordList
      .map(utmFromCoord)
      .filter(
        (u): u is { easting: number; northing: number; zone: string } =>
          Boolean(u),
      );

    // Estados (operacional + físico) — labels legibles del backend.
    const estadoOperacional =
      comp.operational_status?.name && comp.operational_status.name.trim()
        ? comp.operational_status.name
        : undefined;
    const estadoFisico =
      comp.physical_status?.name && comp.physical_status.name.trim()
        ? comp.physical_status.name
        : undefined;

    // geojson del primer vértice (puede faltar en el listado normal).
    const primerGeo = coordList[0]?.geojson ?? null;
    const lat = primerGeo ? primerGeo.coordinates[1] : undefined;
    const lng = primerGeo ? primerGeo.coordinates[0] : undefined;

    // Para líneas: si hay geojson en todos los vértices, armamos puntos.
    const esLinea = TIPO_LINEA.includes(tipo) && coordList.length >= 2;
    const puntos: Array<[number, number]> | undefined = esLinea
      ? coordList
          .map((c) => c.geojson)
          .filter(
            (g): g is { type: 'Point'; coordinates: [number, number] } =>
              g !== null && g !== undefined,
          )
          .map((g) => [g.coordinates[1], g.coordinates[0]] as [number, number])
      : undefined;

    componentes.push({
      id: String(comp.id),
      tipo,
      lat,
      lng,
      codigo: comp.code,
      nombre: comp.name,
      estado: 'normal',
      // El listado no trae criticality (hasta que el backend la reincorpore
      // al light serializer) → undefined (la tabla muestra '—'). Cuando la
      // reincorpore, se muestra automáticamente (objeto o string, ambos
      // soportados). El endpoint /map siempre la trae (ver adaptarComponentesMap).
      criticidad: (() => {
        const critName = critNameFromCoord(coordList[0]);
        return critName ? mapCriticidad(critName) : undefined;
      })(),
      unidadOperativa: comp.district,
      especificacion: comp.specification ?? '',
      puntos: puntos && puntos.length >= 2 ? puntos : undefined,
      utmEasting: primerUtm?.easting,
      utmNorthing: primerUtm?.northing,
      utmZone: primerUtm?.zone,
      verticesUtm: verticesUtm.length > 0 ? verticesUtm : undefined,
      estadoOperacional,
      estadoFisico,
    });
  }

  return { componentes, tramos: [] };
}

/**
 * Adapta la respuesta del endpoint `/components/components/map` al modelo
 * del mapa. A diferencia del listado normal, aquí SÍ viene `geojson` y
 * `criticality` (como string "ALTA"), pero NO `utm_coords` ni
 * `specification`/`physical_status`.
 *
 * Sólo se incluyen componentes con al menos una coord con `geojson` no nulo
 * (sin geometría no hay nada que dibujar en el mapa).
 */
export function adaptarComponentesMap(
  comps: BackendMapComponent[],
): ComponentesResponse {
  const componentes: Componente[] = [];

  for (const comp of comps) {
    const tipo = mapTipo(comp.type);
    const coordList: BackendMapCoord[] = (comp.coords ?? []).filter(
      (c) => c.geojson !== null,
    );
    if (coordList.length === 0) continue;

    const esLinea = TIPO_LINEA.includes(tipo) && coordList.length >= 2;
    const primerGeo = coordList[0].geojson!;
    const lat = primerGeo.coordinates[1];
    const lng = primerGeo.coordinates[0];

    const puntos: Array<[number, number]> | undefined = esLinea
      ? coordList.map((c) => {
          const g = c.geojson!;
          return [g.coordinates[1], g.coordinates[0]] as [number, number];
        })
      : undefined;

    componentes.push({
      id: String(comp.id),
      tipo,
      lat,
      lng,
      codigo: comp.code,
      nombre: comp.name,
      estado: 'normal',
      // Criticidad dominante = peor vértice (ALTA > MEDIA > BAJA).
      criticidad: criticidadMaxima(coordList.map((c) => c.criticality)),
      unidadOperativa: comp.district,
      especificacion: '',
      puntos: puntos && puntos.length >= 2 ? puntos : undefined,
      estadoOperacional: comp.operational_status?.name,
    });
  }

  return { componentes, tramos: [] };
}