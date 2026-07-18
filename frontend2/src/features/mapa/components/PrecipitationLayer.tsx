import { GeoJSON as GeoJSONComponent } from 'react-leaflet';
import {
  PRECIP_FILL,
  PRECIP_FILL_OPACITY,
  PRECIP_STROKE,
  PRECIP_LABEL,
  type PrecipNivel,
} from '../types/precipitacion';
import mockGeoJson from '../data/mockPrecipitaciones.geojson.json';

/**
 * PrecipitationLayer — capa de precipitaciones renderizada como FeatureCollection
 * de polígonos (isohyets) sobre el mapa.
 *
 * Cada Feature del GeoJSON debe traer `properties.nivel` con uno de los 4
 * valores definidos en `PrecipNivel`. El color del polígono se asigna
 * automáticamente según ese nivel usando los tokens de marca (ver
 * `types/precipitacion.ts`).
 *
 * Por ahora consume un mock estático (`mockPrecipitaciones.geojson.json`).
 * Cuando el backend esté listo, sustituir el import por un fetch:
 *
 *   const [data, setData] = useState<FeatureCollection | null>(null);
 *   useEffect(() => {
 *     httpClient.get('/precipitations/current/').then(r => setData(r.data));
 *   }, []);
 *   if (!data) return null;
 *
 * Contrato esperado del backend (ECMWF → JSON):
 *   GET /api/precipitations/current/?unidad=ID
 *   → FeatureCollection con features Polygon. Cada feature:
 *     {
 *       "properties": {
 *         "nivel": "muy-lluvioso" | "lluvioso" |
 *                  "moderadamente-lluvioso" | "extremadamente-lluvioso",
 *         "mm_h": 18.7,
 *         "timestamp": "2026-07-18T08:00:00Z",
 *         "fuente": "ECMWF-ERA5"
 *       },
 *       "geometry": { "type": "Polygon", "coordinates": [[[lng, lat], ...]] }
 *     }
 *
 * IMPORTANTE — Workaround de tipos:
 *  `react-leaflet@5` y `@types/leaflet@1.9` no se ven bien bajo TS6/bundler.
 *  Casteamos el `<GeoJSON>` a `any` solo en este archivo. Sustituir cuando
 *  librería corrija sus definiciones.
 */

// Discreción: el cast ayuda tanto a props como a tipos internos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GeoJSONAny = GeoJSONComponent as any;

interface PrecipitationLayerProps {
  /** GeoJSON FeatureCollection a renderizar (default: mock). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

/**
 * Asigna estilo Leaflet según el `nivel` del feature.
 */
function featureStyle(feature?: { properties?: { nivel?: PrecipNivel } }) {
  const nivel = feature?.properties?.nivel ?? 'moderadamente-lluvioso';
  return {
    fillColor: PRECIP_FILL[nivel],
    fillOpacity: PRECIP_FILL_OPACITY[nivel],
    color: PRECIP_STROKE[nivel],
    weight: 2,
    opacity: 1,
  };
}

/**
 * Tooltip por feature: muestra nivel + mm/h al pasar el cursor.
 */
function bindTooltip(feature: { properties?: Record<string, unknown> }, layer: { bindTooltip: (s: string, o?: unknown) => void }) {
  const props = feature.properties ?? {};
  const nivel = (props.nivel as PrecipNivel) ?? 'moderadamente-lluvioso';
  const mmh = typeof props.mm_h === 'number' ? `${props.mm_h} mm/h` : '—';
  const label = PRECIP_LABEL[nivel];

  layer.bindTooltip(
    `<div style="font-family: var(--eps-font-family-sans); color: var(--eps-text-primary);">
       <strong style="color: var(--eps-primary-main);">${label}</strong><br/>
       <span style="font-size: 12px;">${mmh}</span>
     </div>`,
    { sticky: true, direction: 'top', offset: [0, -5] },
  );
}

export function PrecipitationLayer({ data = mockGeoJson }: PrecipitationLayerProps) {
  return (
    <GeoJSONAny
      data={data}
      style={featureStyle}
      onEachFeature={bindTooltip}
    />
  );
}