import type {
  BackendComponent,
  BackendComponentCoord,
} from '@/services/apiComponentes';
import type {
  Componente,
  ComponentesResponse,
  CriticidadComponente,
  TipoComponente,
} from '@/features/mapa/types/componente';

const TIPO_NAME_TO_ID: Record<string, TipoComponente> = {
  CAPTACIÓN: 'captacion',
  CAPTACION: 'captacion',
  'PLANTA DE TRATAMIENTO DE AGUA POTABLE': 'planta-tratamiento',
  'PLANTA DE TRATAMIENTO': 'planta-tratamiento',
  RESERVORIO: 'reservorio',
  'LÍNEA DE CONDUCCIÓN': 'linea-conduccion',
  'LINEA DE CONDUCCION': 'linea-conduccion',
};

function mapTipo(backendName: string): TipoComponente {
  const upper = backendName.toUpperCase();
  return TIPO_NAME_TO_ID[upper] ?? 'captacion';
}

function mapCriticidad(name: string | undefined): CriticidadComponente {
  if (!name) return 'baja';
  const u = name.toUpperCase();
  if (u.includes('ALT')) return 'alta';
  if (u.includes('MED')) return 'media';
  return 'baja';
}

function derivarEstado(
  opCode: string | null | undefined,
  physCode: string | null | undefined,
): Componente['estado'] {
  if (opCode === '002') return 'critico';
  if (opCode === '003') return 'alerta';
  if (physCode === 'M') return 'critico';
  if (physCode === 'R') return 'alerta';
  return 'normal';
}

export function adaptarComponentes(
  comps: BackendComponent[],
  coords: BackendComponentCoord[],
): ComponentesResponse {
  const coordsPorComponente = new Map<number, BackendComponentCoord>();
  for (const c of coords) {
    coordsPorComponente.set(c.component.id, c);
  }

  const componentes: Componente[] = [];

  for (const comp of comps) {
    const tipo = mapTipo(comp.type.name);
    const coord = coordsPorComponente.get(comp.id);
    if (!coord || !coord.geojson) continue;

    const [lng, lat] = coord.geojson.coordinates;
    componentes.push({
      id: String(comp.id),
      tipo: tipo === 'linea-conduccion' ? 'captacion' : tipo,
      lat,
      lng,
      codigo: comp.code,
      nombre: comp.name,
      estado: derivarEstado(
        comp.operational_status?.code ?? null,
        comp.physical_status?.code ?? null,
      ),
      criticidad: mapCriticidad(coord.criticality.name),
      unidadOperativa: comp.district.name,
      especificacion: comp.specification ?? '',
    });
  }

  return { componentes, tramos: [] };
}