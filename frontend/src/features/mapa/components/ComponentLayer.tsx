import { useMemo, useState } from 'react';
import { Marker, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type {
  Componente,
  TramoConduccion,
} from '../types/componente';
import { COMPONENT_ZOOM_MIN } from '../types/alerta';

// Workaround de tipos: react-leaflet@5 + @types/leaflet@1.9 bajo TS6
// `moduleResolution: bundler` no resuelve correctamente las props
// (divIcon, position, icon, direction, sticky, etc.) a pesar de que sí
// existen en runtime. Casteamos a `any` solo en este archivo. Cuando la
// librería corrija sus definiciones, eliminar el cast y restablecer las
// importaciones con tipos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MarkerAny = Marker as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PolylineAny = Polyline as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TooltipAny = Tooltip as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Lany = L as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useMapEventsAny = useMapEvents as any;

// Importamos los SVG como URLs. Vite las servirá como assets estáticos.
// Cada SVG ya usa `currentColor`, así que el color del icono se hereda
// del `color` CSS del contenedor (lo definimos via `style` en el divIcon).
import CaptacionIconUrl from '@/assets/icons/captacion.svg?url';
import ReservorioIconUrl from '@/assets/icons/reservorio.svg?url';
import PlantaTratamientoIconUrl from '@/assets/icons/planta-tratamiento.svg?url';
import LineaConduccionIconUrl from '@/assets/icons/linea-conduccion.svg?url';
import CircleIconUrl from '@/assets/icons/circle.svg?url';
import { TIPO_LINEA } from '../types/componente';
import { useComponentes } from '@/services/useComponentes';

/**
 * ComponentLayer — capa con los componentes de la red de agua de la EPS:
 *   - Captaciones (puntos)
 *   - Plantas de tratamiento (puntos)
 *   - Reservorios (puntos)
 *   - Tramos de línea de conducción (polylines con potencialmente varios
 *     puntos intermedios para simular desviaciones)
 *
 * Cada componente puntual se renderiza con un `L.divIcon` que embedea
 * el SVG importado como `<img>`. El `color` del divIcon wrapper setea el
 * `currentColor` del SVG, así el color cambia según el estado del componente
 * (normal = navy primary-main, alerta = warning-main, critico = danger-main).
 *
 * Contrato esperado del backend:
 *   GET /api/components/?unidad=ID
 *   → { componentes: Componente[], tramos: TramoConduccion[] }
 *
 * Si no se pasa `data`, el componente no renderiza nada (los llamadores
 * deben pasarle datos via el hook `useComponentes`).
 */

const ICON_BY_TIPO: Record<Componente['tipo'], string> = {
  captacion: CaptacionIconUrl,
  fuente: CaptacionIconUrl,
  reservorio: ReservorioIconUrl,
  'planta-tratamiento': PlantaTratamientoIconUrl,
  'planta-aguas-residuales': PlantaTratamientoIconUrl,
  'linea-conduccion': LineaConduccionIconUrl,
  'linea-aduccion': LineaConduccionIconUrl,
  'estacion-bombeo': CircleIconUrl,
  desinfeccion: CircleIconUrl,
  'purgado-redes': CircleIconUrl,
  otro: CircleIconUrl,
};

const COLOR_BY_ESTADO: Record<Componente['estado'], string> = {
  normal: 'var(--eps-primary-main)',
  alerta: 'var(--eps-warning-main)',
  critico: 'var(--eps-danger-main)',
};

const TRAMO_COLOR = 'var(--eps-secondary-main)';
const TRAMO_WEIGHT = 3;

/**
 * Crea un Leaflet `divIcon` con el SVG embebido como `<img>`.
 * Tamaño base 40×40 (img interna 60×60 para relleno visual).
 */
function makeDivIcon(tipo: Componente['tipo'], estado: Componente['estado']) {
  return makeDivIconVariant(tipo, estado, false);
}

/**
 * Versión "seleccionada": 1.4× tamaño + anillo amarillo translúcido de fondo
 * (token `--eps-background-selected`) para resaltar el componente en el mapa.
 * Análogo al `makeDetalleIconSelected` del AlertLayer.
 */
function makeDivIconSelected(tipo: Componente['tipo'], estado: Componente['estado']) {
  return makeDivIconVariant(tipo, estado, true);
}

function makeDivIconVariant(
  tipo: Componente['tipo'],
  estado: Componente['estado'],
  selected: boolean,
) {
  const url = ICON_BY_TIPO[tipo];
  const color = COLOR_BY_ESTADO[estado];
  // Tamaño del contenedor. En selected crece de 40 → 56 para abarcar
  // el anillo amarillo; la IMAGEN interna se mantiene SIEMPRE en 40px
  // (ancho nativo de los SVG) y se centra con display:grid + place-items:
  // center. Así el punto lat/lng sigue coincidiendo con el centro visual
  // del marcador, sin desplazamiento (bug previo: la imagen era 60×60
  // siempre y sobresalía del contenedor, moviendo el centro visual).
  const size = selected ? 56 : 40;
  const imgSize = 40;
  const half = size / 2;
  const ringBackground = selected
    ? 'background: var(--eps-background-selected);'
    : '';
  const html = `
    <div style="
      color: ${color};
      width: ${size}px;
      height: ${size}px;
      display: grid;
      place-items: center;
      ${ringBackground}
      border-radius: 50%;
      filter: drop-shadow(0 ${selected ? 6 : 4}px ${selected ? 6 : 4}px rgba(0,0,0,${selected ? 0.35 : 0.25}));
    ">
      <img
        src="${url}"
        style="width: ${imgSize}px; height: ${imgSize}px;"
        alt=""
      />
    </div>
  `;
  return Lany.divIcon({
    html,
    className: selected ? 'eps-component-icon-selected' : 'eps-component-icon',
    iconSize: [size, size],
    iconAnchor: [half, half],
    tooltipAnchor: [0, -half],
  });
}

interface ComponentLayerProps {
  /**
   * Datos a renderizar. Si se omite, la capa consume `useComponentes()`
   * internamente (fetch al backend). Pasar `data` para sobreescribir
   * (ej. en páginas con selección sincronizada como MapaComponentes).
   */
  data?: { componentes: Componente[]; tramos: TramoConduccion[] };
  /** ID del componente seleccionado (resaltado + clic handler). */
  selectedComponentId?: string | null;
  /** Callback al hacer clic en un componente del mapa (toggle selección). */
  onComponenteClick?: (id: string) => void;
  /** ID de componente a excluir del render (ej. el que se está editando). */
  excludeId?: string;
}

export function ComponentLayer({
  data,
  selectedComponentId,
  onComponenteClick,
  excludeId,
}: ComponentLayerProps) {
  // Si el padre no pasa `data`, consumimos el backend aquí.
  // (Regla de hooks: siempre se llama al hook; el override es por data.)
  const fetched = useComponentes();
  const layerData = data ?? fetched.data;

  // Zoom actual — controlar visibilidad de componentes por nivel.
  const [zoom, setZoom] = useState(13); // Default del mapa (ver BaseMap).
  useMapEventsAny({
    zoomend: (e: { target: { getZoom: () => number } }) =>
      setZoom(e.target.getZoom()),
  });
  const showLayer = zoom >= COMPONENT_ZOOM_MIN;

  // Memo: índice por ID para referenciar extremos del tramo en tooltips.
  const componentesPorId = useMemo(() => {
    const map = new Map<string, Componente>();
    for (const c of (layerData?.componentes ?? [])) map.set(c.id, c);
    return map;
  }, [layerData]);

  const comps = (layerData?.componentes ?? []).filter((c) => c.id !== excludeId);
  const tramos = layerData?.tramos ?? [];

  if (!showLayer) return null;

  return (
    <>
      {/* ── Tramos de línea de conducción (dibujados primero, debajo) ──── */}
      {tramos.map((tramo) => {
        const origen = componentesPorId.get(tramo.origenId);
        const destino = componentesPorId.get(tramo.destinoId);
        return (
          <PolylineAny
            key={tramo.id}
            positions={tramo.puntos}
            pathOptions={{
              color: TRAMO_COLOR,
              weight: TRAMO_WEIGHT,
              opacity: 0.85,
            }}
          >
            <TooltipAny sticky>
              <div style={{ fontFamily: 'var(--eps-font-family-sans)' }}>
                <strong style={{ color: 'var(--eps-primary-main)' }}>
                  {tramo.codigo}
                </strong>
                <br />
                <span style={{ fontSize: '12px' }}>{tramo.nombre}</span>
                <br />
                <span style={{ fontSize: '11px', color: 'var(--eps-text-secondary)' }}>
                  {origen?.codigo ?? tramo.origenId} → {destino?.codigo ?? tramo.destinoId}
                </span>
              </div>
            </TooltipAny>
          </PolylineAny>
        );
      })}

      {/* ── Componentes tipo línea (conducción/aducción) como polyline ─ */}
      {comps
        .filter((c) => TIPO_LINEA.includes(c.tipo) && c.puntos && c.puntos.length >= 2)
        .map((comp) => {
          const isSelected = selectedComponentId === comp.id;
          return (
            <PolylineAny
              key={comp.id}
              positions={comp.puntos!}
              pathOptions={{
                color: COLOR_BY_ESTADO[comp.estado],
                weight: isSelected ? 5 : TRAMO_WEIGHT,
                opacity: 0.9,
              }}
              eventHandlers={{
                click: () => onComponenteClick?.(comp.id),
              }}
            >
              <TooltipAny sticky>
                <div style={{ fontFamily: 'var(--eps-font-family-sans)' }}>
                  <strong style={{ color: 'var(--eps-primary-main)' }}>
                    {comp.codigo}
                  </strong>
                  <br />
                  <span style={{ fontSize: '12px' }}>{comp.nombre}</span>
                  <br />
                  <span style={{ fontSize: '11px', color: COLOR_BY_ESTADO[comp.estado] }}>
                    ● {comp.estado.toUpperCase()}
                  </span>
                </div>
              </TooltipAny>
            </PolylineAny>
          );
        })}

      {/* ── Componentes puntuales (encima de las líneas) ─────────────── */}
      {comps
        .filter((c) => !(TIPO_LINEA.includes(c.tipo) && c.puntos && c.puntos.length >= 2))
        .map((comp) => {
          const isSelected = selectedComponentId === comp.id;
          return (
            <MarkerAny
              key={comp.id}
              position={[comp.lat, comp.lng]}
              icon={
                isSelected
                  ? makeDivIconSelected(comp.tipo, comp.estado)
                  : makeDivIcon(comp.tipo, comp.estado)
              }
              eventHandlers={{
                click: () => onComponenteClick?.(comp.id),
              }}
            >
              <TooltipAny direction="top" offset={[0, -20]}>
              <div style={{ fontFamily: 'var(--eps-font-family-sans)' }}>
                <strong style={{ color: 'var(--eps-primary-main)' }}>
                  {comp.codigo}
                </strong>
                <br />
                <span style={{ fontSize: '12px' }}>{comp.nombre}</span>
                <br />
                <span style={{ fontSize: '11px', color: COLOR_BY_ESTADO[comp.estado] }}>
                  ● {comp.estado.toUpperCase()}
                </span>
              </div>
            </TooltipAny>
            </MarkerAny>
          );
      })}
    </>
  );
}