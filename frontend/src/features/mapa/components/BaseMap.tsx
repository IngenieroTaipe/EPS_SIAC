import { MapContainer, TileLayer, LayersControl } from 'react-leaflet';

/**
 * Workaround para un bug de resolución de tipos entre `react-leaflet@5` y
 * `@types/leaflet@1.9` bajo `moduleResolution: bundler` en TS 6: el
 * `MapContainerProps` extiende `MapOptions`, pero TS reporta que
 * `center` y `attribution` no existen. Los tipos son correctos en runtime
 * (definidos en `node_modules/@types/leaflet/index.d.ts:2456`); el check
 * estático falla porque `leaflet` no declara `types` en su package.json y
 * TS no resuelve los '@types/leaflet' bajo bundler mode.
 *
 * Solución adoptada: castear a `any` solo en este componente. Re-evaluar
 * cuando react-leaflet publique una corrección a su .d.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MapContainerAny = MapContainer as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TileLayerAny = TileLayer as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LayersControlAny = LayersControl as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BaseLayerAny = LayersControl.BaseLayer as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const OverlayAny = LayersControl.Overlay as any;

/**
 * BaseMap — contenedor base de Leaflet para todas las páginas con mapa.
 *
 * Envuelve `<MapContainer>` con la configuración común:
 *   - Dos capas base intercambiables: OSM (calles) y satelital (Esri World
 *     Imagery), controladas por un `LayersControl` nativo de Leaflet,
 *     posicionado en la esquina superior IZQUIERDA.
 *   - Overlay opcional de etiquetas/carreteras sobre el satélite, para
 *     lograr un modo "híbrido" similar a Google Earth.
 *   - `maxNativeZoom` calibrado en la capa satelital para evitar el tile
 *     de "Map data not yet available" de Esri: más allá de ese zoom,
 *     Leaflet hace upscaling del último tile real en vez de pedir uno
 *     inexistente.
 *   - Sin controles de zoom en la esquina (los pondremos custom o con
 *     zoomControl posicionado).
 *   - `scrollWheelZoom` activo para uso desktop.
 *
 * Los hijos que se pasen (`children`) son las capas de datos propias:
 * `<ComponentLayer>`, `<PrecipitationLayer>`, `<AlertLayer>`, etc.
 *
 * El mapa ocupa el 100% del contenedor padre. Por eso el padre debe tener
 * altura definida (en las páginas usamos `h-full` dentro de `AppLayout`).
 *
 * Props:
 *   - `center`: [lat, lng] del centro inicial.
 *   - `zoom`: nivel de zoom inicial.
 *   - `children`: capas Leaflet a renderizar dentro del mapa.
 *   - `className`: clase CSS para el contenedor.
 *   - `defaultLayer`: capa base activa al montar ('street' | 'satellite').
 *
 * Default: centro continental de Perú con zoom 5.
 */
const DEFAULT_CENTER = [-9.19, -75.016] as [number, number]; // Centro continental del Perú
const DEFAULT_ZOOM = 5;

/**
 * Límites geográficos del Perú (aproximados con padding).
 * Evita que el usuario se desplace fuera del territorio nacional.
 * Formato Leaflet: [[south, west], [north, east]]
 */
const PERU_BOUNDS: [[number, number], [number, number]] = [
  [-18.5, -81.5], // Suroeste
  [0.5, -68.5],   // Noreste
];

/**
 * Esri World Imagery: mosaico satelital gratuito, sin token ni riesgo de
 * facturación (a diferencia de Mapbox/Google). La resolución real varía
 * por región: zonas urbanas grandes pueden tener tiles nítidos hasta
 * zoom ~19-20, pero en zonas rurales/selva (como buena parte de Junín)
 * la imagen fuente se agota antes.
 *
 * `SATELLITE_MAX_ZOOM`: hasta dónde deja acercarse el usuario en el mapa.
 * `SATELLITE_MAX_NATIVE_ZOOM`: hasta dónde hay tiles REALES de Esri para
 * la zona de interés (Huancayo / Chupaca / Pichanaqui). Más allá de este
 * nivel, Leaflet reutiliza y escala (upscale) el último tile disponible
 * en vez de pedir un tile inexistente — así se evita el mensaje
 * "Map data not yet available".
 *
 * Si notas que el placeholder sigue apareciendo en alguna zona específica,
 * baja este número (ej. a 15) hasta que desaparezca en esa zona.
 */
const SATELLITE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELLITE_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
const SATELLITE_MAX_ZOOM = 20;
const SATELLITE_MAX_NATIVE_ZOOM = 16;

/**
 * Capa de referencia (carreteras, límites, topónimos) de Esri, pensada
 * para superponerse sobre World_Imagery y lograr un modo híbrido
 * (satélite + etiquetas), similar al de Google Earth.
 * Usa el mismo límite de zoom nativo que la capa satelital para
 * mantener consistencia visual entre ambas.
 */
const HYBRID_LABELS_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

interface BaseMapProps {
  /** Centro inicial del mapa como [lat, lng]. */
  center?: [number, number];
  /** Zoom inicial (0..18, limitado por la capa satelital). */
  zoom?: number;
  /** Capas Leaflet a renderizar dentro del mapa. */
  children?: React.ReactNode;
  /** Clase CSS para el contenedor del mapa. */
  className?: string;
  /** Capa base activa al montar. Default: 'street'. */
  defaultLayer?: 'street' | 'satellite';
}

export function BaseMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  children,
  className,
  defaultLayer = 'satellite',
}: BaseMapProps) {
  return (
    <MapContainerAny
      center={center}
      zoom={zoom}
      scrollWheelZoom
      zoomControl={false}
      maxBounds={PERU_BOUNDS}
      maxBoundsViscosity={0.7}
      minZoom={5}
      maxZoom={SATELLITE_MAX_ZOOM}
      className={className}
    >
      {/* position="topleft": el selector de capas queda del lado izquierdo */}
      <LayersControlAny position="topleft">
        <BaseLayerAny checked={defaultLayer === 'street'} name="Calles (OSM)">
          <TileLayerAny
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />
        </BaseLayerAny>

        <BaseLayerAny checked={defaultLayer === 'satellite'} name="Satelital">
          <TileLayerAny
            attribution={SATELLITE_ATTRIBUTION}
            url={SATELLITE_URL}
            maxZoom={SATELLITE_MAX_ZOOM}
            maxNativeZoom={SATELLITE_MAX_NATIVE_ZOOM}
          />
        </BaseLayerAny>

        {/* Overlay opcional: etiquetas/carreteras sobre el satélite (modo híbrido) */}
        <OverlayAny name="Etiquetas y carreteras">
          <TileLayerAny
            url={HYBRID_LABELS_URL}
            maxZoom={SATELLITE_MAX_ZOOM}
            maxNativeZoom={SATELLITE_MAX_NATIVE_ZOOM}
          />
        </OverlayAny>
      </LayersControlAny>

      {children}
    </MapContainerAny>
  );
}