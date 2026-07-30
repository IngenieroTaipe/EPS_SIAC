import type {
  BackendComponentListItem,
  BackendComponentListCoord,
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
 * Adapta la respuesta del listado de componentes al modelo del mapa.
 * El `ComponentListSerializer` actual del backend no devuelve los
 * operational/physical status, así que el estado se toma como 'normal'.
 */
export function adaptarComponentes(
  comps: BackendComponentListItem[],
): ComponentesResponse {
  const componentes: Componente[] = [];

  for (const comp of comps) {
    const tipo = mapTipo(comp.type);
    const coordList: BackendComponentListCoord[] = (comp.coords ?? []).filter(
      (c) => c.geojson !== null,
    );
    if (coordList.length === 0) continue;

    const esLinea = TIPO_LINEA.includes(tipo) && coordList.length >= 2;

    if (esLinea) {
      const puntos: Array<[number, number]> = coordList.map((c) => {
        const [lng, lat] = c.geojson!.coordinates;
        return [lat, lng] as [number, number];
      });
      const [lat0, lng0] = puntos[0];
      componentes.push({
        id: String(comp.id),
        tipo,
        lat: lat0,
        lng: lng0,
        codigo: comp.code,
        nombre: comp.name,
        estado: 'normal',
        criticidad: mapCriticidad(coordList[0].criticality?.name),
        unidadOperativa: comp.district,
        especificacion: comp.specification ?? '',
        puntos,
      });
    } else {
      const [lng, lat] = coordList[0].geojson!.coordinates;
      componentes.push({
        id: String(comp.id),
        tipo,
        lat,
        lng,
        codigo: comp.code,
        nombre: comp.name,
        estado: 'normal',
        criticidad: mapCriticidad(coordList[0].criticality?.name),
        unidadOperativa: comp.district,
        especificacion: comp.specification ?? '',
      });
    }
  }

  return { componentes, tramos: [] };
}