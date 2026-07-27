import { MapContainer, TileLayer } from 'react-leaflet';

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
 * cuando react-leafletublish una corrección a su .d.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MapContainerAny = MapContainer as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TileLayerAny = TileLayer as any;

/**
 * BaseMap — contenedor base de Leaflet para todas las páginas con mapa.
 *
 * Envuelve `<MapContainer>` con la configuración común:
 *   - TileLayer OSM por defecto (se puede sobreescribir pasando children).
 *   - Sin controles de zoom en la esquina (los pondremos custom o con
 *     zoomControl positionado).
 *   - `scrollWheelZoom` activo para uso desktop.
 *
 * Los hijos que se pasen (`children`) son las capas: `<ComponentLayer>`,
 * `<PrecipitationLayer>`, `<AlertLayer>`, etc.
 *
 * El mapa ocupa el 100% del contenedor padre. Por eso el padre debe tener
 * altura definida (en las páginas usamos `h-full` dentro de `AppLayout`).
 *
 * Props:
 *   - `center`: [lat, lng] del centro inicial.
 *   - `zoom`: nivel de zoom inicial.
 *   - `children`: capas Leaflet a renderizar dentro del mapa.
 *   - `className`: clase CSS para el contenedor.
 *
 * Default: centro de Pichanaqui (Perú) con zoom 13.
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

interface BaseMapProps {
  /** Centro inicial del mapa como [lat, lng]. */
  center?: [number, number];
  /** Zoom inicial (0..18). */
  zoom?: number;
  /** Capas Leaflet a renderizar dentro del mapa. */
  children?: React.ReactNode;
  /** Clase CSS para el contenedor del mapa. */
  className?: string;
}

export function BaseMap({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  children,
  className,
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
      className={className}
    >
      <TileLayerAny
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {children}
    </MapContainerAny>
  );
}