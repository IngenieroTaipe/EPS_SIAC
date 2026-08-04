/**
 * Tipos del dominio "Componentes" de la EPS.
 *
 * Estructura alineada con lo que el backend devolverá (cuando se integre):
 *
 *   GET /api/components/?unidad=ID
 *   → { componentes: Componente[], tramos: TramoConduccion[] }
 *
 * El frontend arma mentalmente el grafo así:
 *
 *     [Captación] → (Tramo 1, varios segmentos) → [Planta de Tratamiento]
 *                                                          ↓
 *     [Reservorio] ← (Tramo 2, varios segmentos) ←
 *
 * Tener países captación / planta / reservorio como puntos (lat,lng),
 * y los tramos de conducción como secuencias de puntos (lat,lng) que van
 * desde un componente de salida hasta un componente de llegada. Un mismo
 * tramo puede pasar por varios puntos intermedios (desviaciones).
 */

/**
 * Identificadores de tipo de componente del dominio.
 *
 * Mapean a los tipos definidos en el backend (`ComponentType.name`):
 *   - CAPTACIÓN, FUENTE         → 'captacion' (ícono captacion.svg)
 *   - RESERVORIO                → 'reservorio' (ícono reservorio.svg)
 *   - PLANTA DE TRATAMIENTO DE AGUA POTABLE
 *     / AGUAS RESIDUALES        → 'planta-tratamiento' (ícono planta-tratamiento.svg)
 *   - LÍNEA DE CONDUCCIÓN       → 'linea-conduccion' (ícono linea-conduccion.svg, polyline)
 *   - LÍNEA DE ADUCCIÓN         → 'linea-aduccion' (ícono linea-conduccion.svg, polyline)
 *   - ESTACIÓN DE BOMBEO Y REBOMBEO, UNIDADES DE DESINFECCIÓN,
 *     PUNTO DE PURGADO          → 'otro' (ícono circle.svg fallback)
 */
export type TipoComponente =
  | 'captacion'
  | 'fuente'
  | 'reservorio'
  | 'planta-tratamiento'
  | 'planta-aguas-residuales'
  | 'linea-conduccion'
  | 'linea-aduccion'
  | 'estacion-bombeo'
  | 'desinfeccion'
  | 'purgado-redes'
  | 'otro';

/** Nivel de criticidad del componente — usarse para badges y filtros. */
export type CriticidadComponente = 'alta' | 'media' | 'baja';

/** Etiquetas legibles para tipos (para tablas, badges, etc.). */
export const TIPO_LABEL: Record<TipoComponente, string> = {
  'captacion': 'Captación',
  'fuente': 'Fuente',
  'reservorio': 'Reservorio',
  'planta-tratamiento': 'Planta de Tratamiento',
  'planta-aguas-residuales': 'Planta de Tratamiento de Aguas Residuales',
  'linea-conduccion': 'Línea de Conducción',
  'linea-aduccion': 'Línea de Aducción',
  'estacion-bombeo': 'Estación de Bombeo y Rebombeo de Agua Potable',
  'desinfeccion': 'Unidades de Desinfección',
  'purgado-redes': 'Punto de Purgado de Redes',
  'otro': 'Otro',
};

/** Tipos que se renderizan como una polyline (varios puntos por componente). */
export const TIPO_LINEA: ReadonlyArray<TipoComponente> = [
  'linea-conduccion',
  'linea-aduccion',
];

/** Etiquetas legibles para criticidad (para badges y filtros). */
export const CRITICIDAD_LABEL: Record<CriticidadComponente, string> = {
  'alta': 'Alta',
  'media': 'Media',
  'baja': 'Baja',
};

/** Componente del sistema de agua potable. */
export interface Componente {
  /** ID estable en el backend (ej. "CPT-001"). */
  id: string;
  /** Tipo de componente — define el icono a renderizar (punto) o si es polyline. */
  tipo: TipoComponente;
  /** Latitud (WGS84). Para componentes tipo línea, es la del primer punto. */
  lat: number;
  /** Longitud (WGS84). Para componentes tipo línea, es la del primer punto. */
  lng: number;
  /** Código legible para el usuario (ej. "CAP-001"). */
  codigo: string;
  /** Nombre del componente (ej. "Captación Río Pichanaqui"). */
  nombre: string;
  /** Estado del componente: normal / alerta / critico. */
  estado: 'normal' | 'alerta' | 'critico';
  /** Nivel de criticidad (para badges + filtros del histórico). */
  criticidad: CriticidadComponente;
  /** Unidad operativa a la que pertenece. */
  unidadOperativa: string;
  /**
   * Especificación legible para tablas (ej. "Línea de conducción - Tramo 1").
   * Permite describir una sub-división del componente sin tocar el nombre principal.
   */
  especificacion: string;
  /** Fecha de última actualización (ISO 8601). Sirve para filtrado histórico. */
  fechaActualizacion?: string;
  /**
   * Solo para tipos línea (conducción/aducción): secuencia de [lat, lng]
   * que definen el trazado. Para componentes puntuales se omite.
   * Los puntos extremos coinciden con `lat`/`lng` del primer punto.
   */
  puntos?: Array<[number, number]>;
  /**
   * Coordenadas UTM (Este/Norte) del primer vértice. Para tipo línea
   * corresponde al extremo inicial; los demás vértices viven en `puntos`
   * y el sheet los puede expandir uno a uno (con su propio UTM derivado).
   * Opcional: si el backend no lo trae, las columnas UTM de la tabla se
   * muestran vacías.
   */
  utmEasting?: number;
  utmNorthing?: number;
  /** Zona UTM del primer vértice (ej. "18S") — informativa. */
  utmZone?: string;
  /**
   * Vertices UTM completos cuando el componente es de línea (N puntos).
   * Se rellena desde el adaptador con los `utm_coords` de cada coord.
   * Para componentes puntuales se omite (o tiene un solo elemento).
   */
  verticesUtm?: Array<{ easting: number; northing: number; zone?: string }>;
}

/**
 * Tramo de línea de conducción: una secuencia de 2 o más puntos que
 * conectan dos componentes.
 *
 * El `origenId` y `destinoId` se usan para mostrar tooltips con nombre
 * de extremos. Los puntos intermedios modelan desviaciones (curvas)
 * que el tramo hace entre origen y destino.
 *
 * El backend puede devolverlo como una lista de [lng, lat] (GeoJSON
 * LineString) o como una lista de objetos { lat, lng } — aquí usamos
 * el formato local [lat, lng] para no mezclar convenciones con Leaflet,
 * que también usa [lat, lng] en sus props.
 */
export interface TramoConduccion {
  /** ID estable (ej. "TRM-001"). */
  id: string;
  /** ID del componente de origen (debe existir en el array `componentes`). */
  origenId: string;
  /** ID del componente de destino (debe existir en el array `componentes`). */
  destinoId: string;
  /**
   * Secuencia de puntos del tramo. Incluye los extremos (origen y destino)
   * como primer y último punto, más los intermedios si los tiene.
   * Formato: [lat, lng] (Leaflet-friendly).
   */
  puntos: Array<[number, number]>;
  /** Código legible (ej. "LDC-001"). */
  codigo: string;
  /** Nombre descriptivo del tramo. */
  nombre: string;
}

/** Empaque que el endpoint `/api/components/` devolverá. */
export interface ComponentesResponse {
  componentes: Componente[];
  tramos: TramoConduccion[];
}