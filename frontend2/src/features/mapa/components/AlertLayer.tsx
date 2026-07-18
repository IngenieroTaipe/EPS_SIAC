import { useMemo, useState } from 'react';
import { Marker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { mockAlertas } from '../data/mockAlertas';
import type { Alerta, EstadoAlerta } from '../types/alerta';
import { ALERT_ZOOM_DETAIL } from '../types/alerta';

// Workaround de tipos: react-leaflet@5 + @types/leaflet@1.9 bajo TS6
// `moduleResolution: bundler` no resuelve correctamente las props de
// Marker / useMapEvents / L.divIcon. Casteamos a any solo en este archivo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MarkerAny = Marker as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TooltipAny = Tooltip as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Lany = L as any;

// Iconos normales (vista detalle).
import DangerIconUrl from '@/assets/icons/danger.svg?url';
import WarningIconUrl from '@/assets/icons/warning.svg?url';
import SuccessIconUrl from '@/assets/icons/success.svg?url';
import InProcessResolveIconUrl from '@/assets/icons/in-process-resolve.svg?url';

// Iconos con número (vista agrupada).
import DangerNumberIconUrl from '@/assets/icons/danger-number.svg?url';
import WarningNumberIconUrl from '@/assets/icons/warning-number.svg?url';
import SuccessNumberIconUrl from '@/assets/icons/success-number.svg?url';

/**
 * Mapa estado → icono URL (vista individual / detalle).
 */
const ICON_DETALLE: Record<EstadoAlerta, string> = {
  'confirmado': DangerIconUrl,
  'en-espera-confirmacion': WarningIconUrl,
  'atendido': SuccessIconUrl,
  'en-proceso-atencion': InProcessResolveIconUrl,
  'no-confirmado': WarningIconUrl, // fallback a warning (visualmente similar)
  'predicho': InProcessResolveIconUrl, // fallback a in-process (visualmente similar)
};

/**
 * Mapa estado → icono URL (vista agrupada / cluster con número).
 * Nota: el `in-process` y `predicho` no tienen variante "number"
 * (por decisión de diseño), así que se excluyen del agrupamiento.
 */
const ICON_AGRUPADO: Partial<Record<EstadoAlerta, string>> = {
  'confirmado': DangerNumberIconUrl,
  'en-espera-confirmacion': WarningNumberIconUrl,
  'atendido': SuccessNumberIconUrl,
};

/**
 * Color del dato emergente (para el numero, baseline CSS var).
 */
const COLOR_NUMERO: Record<EstadoAlerta, string> = {
  'confirmado': 'var(--eps-danger-main)',
  'en-espera-confirmacion': 'var(--eps-warning-dark)',
  'atendido': 'var(--eps-success-main)',
  'en-proceso-atencion': 'var(--eps-alerts-status-en-proceso-atencion)',
  'no-confirmado': 'var(--eps-text-primary)',
  'predicho': 'var(--eps-alerts-status-predicho)',
};

/**
 * AlertLayer — capa de alertas con dos vistas:
 *
 *   - Vista detalle (zoom >= ALERT_ZOOM_DETAIL): marcadores individuales
 *     con `danger.svg`, `warning.svg`, `success.svg`, `in-process-resolve.svg`
 *     sobre cada alerta. Se ven "encima" de los componentes porque comparten
 *     coordenadas (offset juega por separación visual en runtime si hace falta).
 *
 *   - Vista agrupada (zoom < ALERT_ZOOM_DETAIL): cluster por proximidad
 *     (radio fijo en kilómetros), agrupando alertas de estados `confirmado`,
 *     `en-espera-confirmacion` y `atendido` (los 3 con icon SVG `*-number`).
 *     Encima del icono aparece el número total de alertas del cluster.
 *
 *     El estado de cada cluster se decide por el "estado dominante" en este
 *     orden de prioridad: confirmado > en-espera > atendido.
 *
 * Las alertas `en-proceso-atencion` y `predicho` solo aparecen en vista detalle
 * (no se agrupan); cuando el zoom baja, se ocultan (porque al ser intermedias
 * no tienen icono "number" y agruparlas semánticamente no encaja).
 *
 * Contrato esperado del backend:
 *   GET /api/alerts/?unidad=ID → { alertas: Alerta[] }
 */
interface AlertLayerProps {
  /** Datos a renderizar (default: mock). */
  data?: { alertas: Alerta[] };
  /** ID de la alerta seleccionada (resaltar + evento de bloque). */
  selectedAlertId?: string | null;
  /** Callback al hacer clic en una alerta del mapa (toggle selección). */
  onAlertaClick?: (id: string) => void;
}

/** Estado dominante entre varios (para colorear el cluster). */
function estadoDominante(estados: EstadoAlerta[]): EstadoAlerta {
  if (estados.includes('confirmado')) return 'confirmado';
  if (estados.includes('en-espera-confirmacion')) return 'en-espera-confirmacion';
  if (estados.includes('atendido')) return 'atendido';
  // Para estados sin icono "number" (predicho, no-confirmado, en-proceso),
  // se cae al último — pero estos alertas no deberían formar parte del cluster.
  return estados[0] ?? 'no-confirmado';
}

/**
 * Tamaño de los iconos de alerta (alto nivel de detalle).
 *
 * Doblemente grande que los componentes: 64×64. Modificar aquí para ajustar
 * el tamaño de ambos tipos (detalle y cluster) en conjunto.
 */
const ALERT_ICON_SIZE = 64;
const ALERT_IMG_SIZE_ICON = 56;  // para el círculo del inner SVG
const ALERT_IMG_SIZE_NUMBER = 60; // para los *-number.svg que incluyen borde

/**
 * Crea un `divIcon` para vista detalle (icono individual).
 *
 * Tamaño = ALERT_ICON_SIZE (64×64). Imagen interna proporcional.
 * Ancla al centro horizontal y abajo vertical (estilo "pin").
 */
/**
 * Versión "seleccionada" del icono: 1.4× el tamaño + anillo amarillo de
 * fondo (token `--eps-background-selected`) para resaltar en el mapa.
 */
function makeDetalleIconSelected(estado: EstadoAlerta) {
  const url = ICON_DETALLE[estado];
  const baseSize = ALERT_ICON_SIZE;
  const scale = 1.4;
  const size = Math.round(baseSize * scale);
  const imgSize = Math.round(ALERT_IMG_SIZE_ICON * scale);
  const half = size / 2;
  const html = `
    <div style="
      width: ${size}px; height: ${size}px;
      display: grid; place-items: center;
      background: var(--eps-background-selected);
      border-radius: 50%;
      box-shadow: 0 0 0 4px var(--eps-background-selected);
      filter: drop-shadow(0 6px 6px rgba(0,0,0,0.35));
    ">
      <img src="${url}" style="width: ${imgSize}px; height: ${imgSize}px;" alt="" />
    </div>
  `;
  return Lany.divIcon({
    html,
    className: 'eps-alert-icon-detalle-selected',
    iconSize: [size, size],
    iconAnchor: [half, size],
    tooltipAnchor: [0, -size],
  });
}

function makeDetalleIcon(estado: EstadoAlerta) {
  const url = ICON_DETALLE[estado];
  const size = ALERT_ICON_SIZE;
  const imgSize = ALERT_IMG_SIZE_ICON;
  const half = size / 2;
  const html = `
    <div style="
      width: ${size}px; height: ${size}px;
      display: grid; place-items: center;
      filter: drop-shadow(0 4px 4px rgba(0,0,0,0.25));
    ">
      <img src="${url}" style="width: ${imgSize}px; height: ${imgSize}px;" alt="" />
    </div>
  `;
  return Lany.divIcon({
    html,
    className: 'eps-alert-icon-detalle',
    iconSize: [size, size],
    iconAnchor: [half, size],
    tooltipAnchor: [0, -size],
  });
}

/**
 * Crea un `divIcon` para vista agrupada (cluster con número encima).
 *
 * El icono base es `*-number.svg` (círculo con borde gris) en color del
 * estado dominante. Encima del icono se renderiza el número total de
 * alertas del cluster, perfectamente centrado usando flex + grid.
 *
 * Tamaño = ALERT_ICON_SIZE (64×64).
 */
function makeAgrupadoIcon(estado: EstadoAlerta, count: number) {
  const url = ICON_AGRUPADO[estado];
  const size = ALERT_ICON_SIZE;
  const imgSize = ALERT_IMG_SIZE_NUMBER;
  const half = size / 2;
  const html = `
    <div style="
      position: relative;
      width: ${size}px;
      height: ${size}px;
      display: grid;
      place-items: center;
      filter: drop-shadow(0 4px 4px rgba(0,0,0,0.25));
    ">
      <img
        src="${url}"
        style="width: ${imgSize}px; height: ${imgSize}px; display: block;"
        alt=""
      />
      <div style="
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        font-family: var(--eps-font-family-sans);
        font-weight: bold;
        font-size: 18px;
        line-height: 1;
        color: var(--eps-text-invert-primary);
        pointer-events: none;
        text-shadow: 0 1px 2px rgba(0,0,0,0.55);
        /* Pequeño offset hacia abajo porque el círculo del SVG tiene
           una gota inferior; así el número queda visualmente centrado
           dentro del círculo. */
        transform: translateY(1px);
      ">${count}</div>
    </div>
  `;
  return Lany.divIcon({
    html,
    className: 'eps-alert-icon-cluster',
    iconSize: [size, size],
    iconAnchor: [half, half],
    tooltipAnchor: [0, -half],
  });
}

/**
 * Distancia geográfica aproximada en km entre dos puntos [lat,lng]
 * (Haversine). Suficiente para clustering urbano.
 */
function distanciaKm(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Radio de agrupamiento en km. Ajusta para clusters más grandes/menores. */
const CLUSTER_RADIUS_KM = 1.5;

/** Cluster puntual agrupado para la vista agrupada. */
interface Cluster {
  lat: number;
  lng: number;
  estado: EstadoAlerta;
  count: number;
  alertas: Alerta[];
}

/**
 * Agrupa las alertas por cercanía geográfica y calcula el estado dominante.
 * Solo agrupa alertas con icono "number" (confirmado / en-espera / atendido).
 */
function agrupar(alertas: Alerta[]): Cluster[] {
  const agrupables = alertas.filter((a) =>
    Object.prototype.hasOwnProperty.call(ICON_AGRUPADO, a.estado),
  );
  const clusters: Cluster[] = [];
  const asignado = new Set<string>();

  for (const alerta of agrupables) {
    if (asignado.has(alerta.id)) continue;

    // Forma cluster con todas las alertas cercanas.
    const cercanas = agrupables.filter(
      (a) =>
        !asignado.has(a.id) &&
        distanciaKm([alerta.lat, alerta.lng], [a.lat, a.lng]) <=
          CLUSTER_RADIUS_KM,
    );
    for (const c of cercanas) asignado.add(c.id);

    // Centroide = promedio simple.
    const lat =
      cercanas.reduce((s, a) => s + a.lat, 0) / cercanas.length;
    const lng =
      cercanas.reduce((s, a) => s + a.lng, 0) / cercanas.length;

    const estado = estadoDominante(cercanas.map((c) => c.estado));
    clusters.push({
      lat,
      lng,
      estado,
      count: cercanas.length,
      alertas: cercanas,
    });
  }

  return clusters;
}

export function AlertLayer({
  data = mockAlertas,
  selectedAlertId,
  onAlertaClick,
}: AlertLayerProps) {
  const [zoom, setZoom] = useState(() => {
    // Inicialización diferida — evitar leer el contexto antes del mount.
    return 13; // Default zoom del mapa (ver BaseMap).
  });

  // Reaccionar a cambios de zoom.
  useMapEvents({
    zoomend: (e: { target: { getZoom: () => number } }) => setZoom(e.target.getZoom()),
  });

  const showDetalle = zoom >= ALERT_ZOOM_DETAIL;

  // Clusters computados solo cuando están necesarios (zoom bajo).
  const clusters = useMemo(() => {
    if (showDetalle) return [];
    return agrupar(data.alertas);
  }, [data, showDetalle]);

  return (
    <>
      {showDetalle
        ? (
            // ── Vista detalle: cada alerta con su icono individual ──
            data.alertas.map((alerta) => {
              const isSelected = selectedAlertId === alerta.id;
              return (
                <MarkerAny
                  key={alerta.id}
                  position={[alerta.lat, alerta.lng]}
                  icon={
                    isSelected
                      ? makeDetalleIconSelected(alerta.estado)
                      : makeDetalleIcon(alerta.estado)
                  }
                  eventHandlers={{
                    click: () => onAlertaClick?.(alerta.id),
                  }}
                >
                  {/* Tooltip del detalle */}
                <TooltipAlerta alerta={alerta} />
                </MarkerAny>
              );
            })
          )
        : (
            // ── Vista agrupada: clusters con número encima ──
            clusters.map((cluster, idx) => (
              <MarkerAny
                key={`cluster-${idx}`}
                position={[cluster.lat, cluster.lng]}
                icon={makeAgrupadoIcon(cluster.estado, cluster.count)}
              >
                {/* Tooltip del cluster */}
              <TooltipCluster cluster={cluster} />
              </MarkerAny>
            ))
          )}
    </>
  );
}

// ── Subcomponentes de Tooltip (separados para no ensuciar el render) ───
// TooltipAny declarado al inicio del archivo (cast del react-leaflet Tooltip).

function TooltipAlerta({ alerta }: { alerta: Alerta }) {
  return (
    <TooltipAny direction="top" offset={[0, -28]}>
      <div style={{ fontFamily: 'var(--eps-font-family-sans)' }}>
        <strong style={{ color: COLOR_NUMERO[alerta.estado] }}>
          {alerta.estado.toUpperCase()}
        </strong>
        <br />
        <span style={{ fontSize: '12px' }}>{alerta.mensaje}</span>
        <br />
        <span style={{ fontSize: '11px', color: 'var(--eps-text-secondary)' }}>
          {alerta.nivel} · {new Date(alerta.fecha).toLocaleString('es-PE')}
        </span>
      </div>
    </TooltipAny>
  );
}

function TooltipCluster({ cluster }: { cluster: Cluster }) {
  return (
    <TooltipAny direction="top" offset={[0, -17]}>
      <div style={{ fontFamily: 'var(--eps-font-family-sans)' }}>
        <strong style={{ color: COLOR_NUMERO[cluster.estado] }}>
          {cluster.count} alerta{cluster.count === 1 ? '' : 's'} {cluster.estado.replace(/-/g, ' ')}
        </strong>
        <br />
        <span style={{ fontSize: '11px', color: 'var(--eps-text-secondary)' }}>
          Aleja el mapa para ver detalle. Acerca para expandir.
        </span>
      </div>
    </TooltipAny>
  );
}