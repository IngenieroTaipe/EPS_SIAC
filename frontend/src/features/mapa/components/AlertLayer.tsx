import { useEffect, useMemo, useState } from 'react';
import { Marker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { apiAlerts, type BackendAlertListItem } from '@/services/apiAlerts';
import { deriveMapAlertas } from '@/features/mapa/utils/deriveMapAlertas';
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
const useMapEventsAny = useMapEvents as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Lany = L as any;

// Iconos de leyenda (vista detalle) — los mismos que aparecen en la leyenda
// del mapa. Tienen forma de "pin" con gota inferior.
import DangerLeyendaIconUrl from '@/assets/icons/danger-leyenda.svg?url';
import WarningLeyendaIconUrl from '@/assets/icons/warning-leyenda.svg?url';
import SuccessLeyendaIconUrl from '@/assets/icons/success-leyenda.svg?url';
import InProcessResolveLeyendaIconUrl from '@/assets/icons/in-process-resolve-leyenda.svg?url';

// Iconos con número (vista agrupada).
import DangerNumberIconUrl from '@/assets/icons/danger-number.svg?url';
import WarningNumberIconUrl from '@/assets/icons/warning-number.svg?url';
import SuccessNumberIconUrl from '@/assets/icons/success-number.svg?url';

/**
 * Mapa estado → icono URL (vista individual / detalle).
 * `no-confirmado` está contemplado en el tipo pero NO se dibuja en el
 * mapa (solo aparece en el tabular). `predicho` reusa el icono warning
 * igual que `en-espera-confirmacion`. `en-espera-reporte` se mapea al
 * mismo icono de `en-proceso-atencion` por decisión del equipo.
 */
const ICON_DETALLE: Record<EstadoAlerta, string> = {
  'confirmado': DangerLeyendaIconUrl,
  'en-espera-confirmacion': WarningLeyendaIconUrl,
  'en-espera-reporte': InProcessResolveLeyendaIconUrl,
  'atendido': SuccessLeyendaIconUrl,
  'en-proceso-atencion': InProcessResolveLeyendaIconUrl,
  'no-confirmado': WarningLeyendaIconUrl,
  'predicho': WarningLeyendaIconUrl,
};

/**
 * Mapa estado → icono URL (vista agrupada / cluster con número).
 * Nota: el `in-process` y `en-espera-reporte` no tienen variante "number"
 * (por decisión de diseño), así que se excluyen del agrupamiento.
 */
const ICON_AGRUPADO: Partial<Record<EstadoAlerta, string>> = {
  'confirmado': DangerNumberIconUrl,
  'en-espera-confirmacion': WarningNumberIconUrl,
  'predicho': WarningNumberIconUrl,
  'atendido': SuccessNumberIconUrl,
};

/**
 * Color del dato emergente (para el numero, baseline CSS var).
 */
const COLOR_NUMERO: Record<EstadoAlerta, string> = {
  'confirmado': 'var(--eps-danger-main)',
  'en-espera-confirmacion': 'var(--eps-warning-dark)',
  'en-espera-reporte': 'var(--eps-alerts-status-en-proceso-atencion)',
  'atendido': 'var(--eps-success-main)',
  'en-proceso-atencion': 'var(--eps-alerts-status-en-proceso-atencion)',
  'no-confirmado': 'var(--eps-text-primary)',
  'predicho': 'var(--eps-alerts-status-predicho)',
};

/**
 * AlertLayer — capa de alertas con dos vistas:
 *
 *   - Vista detalle (zoom >= ALERT_ZOOM_DETAIL): marcadores individuales
 *     con `danger-leyenda.svg`, `warning-leyenda.svg`, `success-leyenda.svg`,
 *     `in-process-resolve-leyenda.svg` sobre cada alerta. Cada icono tiene
 *     un pulso radial del color del estado que se expande y desvanece en
 *     1.8s, sincronizado entre todos los markers.
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
  /** Datos a renderizar (si se omite, se cargan desde el backend). */
  data?: { alertas: Alerta[] };
  /** ID de la alerta seleccionada (resaltar + evento de bloque). */
  selectedAlertId?: string | null;
  /** Callback al hacer clic en una alerta del mapa (toggle selección). */
  onAlertaClick?: (id: string) => void;
}

/** Estado dominante entre varios (para colorear el cluster). */
function estadoDominante(estados: EstadoAlerta[]): EstadoAlerta {
  if (estados.includes('confirmado')) return 'confirmado';
  if (estados.includes('en-proceso-atencion')) return 'en-proceso-atencion';
  if (estados.includes('en-espera-reporte')) return 'en-espera-reporte';
  if (estados.includes('en-espera-confirmacion')) return 'en-espera-confirmacion';
  if (estados.includes('predicho')) return 'predicho';
  if (estados.includes('atendido')) return 'atendido';
  // Para estados sin icono "number" (no-confirmado), se cae al último —
  // pero estos alertas no deberían formar parte del cluster.
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
  const hasPulse = ESTADOS_CON_PULSO.has(estado);
  const pulseColor = PULSE_COLOR[estado];
  const baseSize = ALERT_ICON_SIZE;
  const scale = 1.15; // menos aumento al seleccionar
  const size = Math.round(baseSize * scale);
  const imgSize = Math.round(ALERT_IMG_SIZE_ICON * scale);
  const half = size / 2;
  const pulseSize = Math.round(size * 0.6);
  const pulseHtml = hasPulse && pulseColor
    ? `<div class="eps-alert-pulse" style="background: ${pulseColor}; width: ${pulseSize}px; height: ${pulseSize}px;"></div>`
    : '';
  const html = `
    <div style="
      position: relative;
      width: ${size}px; height: ${size}px;
      display: grid; place-items: center;
      background: var(--eps-background-selected);
      border-radius: 50%;
      box-shadow: 0 0 0 2px var(--eps-background-selected);
      filter: drop-shadow(0 4px 4px rgba(0,0,0,0.25));
    ">
      ${pulseHtml}
      <img src="${url}" style="width: ${imgSize}px; height: ${imgSize}px; position: relative; z-index: 1;" alt="" />
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

/**
 * Color del pulso (círculo expansivo) — igual al color del estado.
 * Solo se aplica a estados que tienen pulso: confirmado, en-espera, atendido.
 * Los demás (en-proceso, no-confirmado, predicho) NO pulsan.
 */
const PULSE_COLOR: Partial<Record<EstadoAlerta, string>> = {
  'confirmado': 'var(--eps-danger-main)',
  'en-espera-confirmacion': 'var(--eps-warning-main)',
  'atendido': 'var(--eps-success-main)',
};

/** Estados que tienen pulso activo. */
const ESTADOS_CON_PULSO = new Set<EstadoAlerta>([
  'confirmado',
  'en-espera-confirmacion',
  'atendido',
]);

/**
 * Crea un `divIcon` para vista detalle (icono individual con pulso).
 *
 * El HTML incluye:
 *   1. Un div `.eps-alert-pulse` con `background` del color del estado
 *      que se expande y desvanece en 1.8s (definido en `index.css`).
 *   2. El icono `*-leyenda.svg` encima del pulso.
 *
 * Todos los markers comparten la misma animación CSS → pulsan sincronizados.
 */
function makeDetalleIcon(estado: EstadoAlerta) {
  const url = ICON_DETALLE[estado];
  const hasPulse = ESTADOS_CON_PULSO.has(estado);
  const pulseColor = PULSE_COLOR[estado];
  const size = ALERT_ICON_SIZE;
  const imgSize = ALERT_IMG_SIZE_ICON;
  const half = size / 2;
  const pulseHtml = hasPulse && pulseColor
    ? `<div class="eps-alert-pulse" style="background: ${pulseColor};"></div>`
    : '';
  const html = `
    <div style="
      position: relative;
      width: ${size}px; height: ${size}px;
      display: grid; place-items: center;
      filter: drop-shadow(0 4px 4px rgba(0,0,0,0.25));
    ">
      ${pulseHtml}
      <img src="${url}" style="width: ${imgSize}px; height: ${imgSize}px; position: relative; z-index: 1;" alt="" />
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

/**
 * Radio de agrupamiento en km, dependiente del zoom.
 *
 * Lógica: a partir de zoom 12 (detalle individual), cuando se baja:
 *   zoom 10-11 → radio 1.5 km
 *   zoom  8-9  → radio 3 km    (×2)
 *   zoom  6-7  → radio 6 km    (×2)
 *   zoom  4-5  → radio 12 km   (×2)
 *   zoom < 4   → radio 24 km   (×2)
 *
 * Fórmula: base 1.5 km × 2^floor((10 - min(zoom,10)) / 2)
 * Ej: zoom 11 → 1.5×2^0 = 1.5; zoom 9 → 1.5×2^1 = 3; zoom 7 → 1.5×2^2 = 6...
 */
function clusterRadiusKm(zoom: number): number {
  const BASE = 1.5;
  const clampedZoom = Math.min(zoom, 10);
  const exponent = Math.floor((10 - clampedZoom) / 1);
  return BASE * Math.pow(2, Math.max(0, exponent));
}

/** Cluster puntual agrupado para la vista agrupada. */
interface Cluster {
  lat: number;
  lng: number;
  estado: EstadoAlerta;
  count: number;
  alertas: Alerta[];
}

/**
 * Agrupa las alertas por cercanía geográfica usando un algoritmo iterativo.
 *
 * Solo agrupa alertas con icono "number" (confirmado / en-espera / atendido).
 *
 * Algoritmo:
 *   1. Inicia con cada alerta como un cluster individual.
 *   2. Busca el par de clusters más cercano que esté dentro del radio.
 *   3. Si lo encuentra, los fusiona: nuevo centroide = promedio, nuevo
 *      estado = estadoDominante, count = suma, alertas = concatenación.
 *   4. Repite 2-3 hasta que no haya más pares cercanos.
 *
 * Esto garantiza que al alejar el zoom (radio mayor), los clusters previos
 * se vuelven a fusionar entre ellos, recalculando el centroide cada vez.
 */
function agrupar(alertas: Alerta[], zoom: number): Cluster[] {
  const radio = clusterRadiusKm(zoom);
  const agrupables = alertas.filter((a) =>
    Object.prototype.hasOwnProperty.call(ICON_AGRUPADO, a.estado),
  );

  // Inicia con cada alerta como un cluster unitario.
  let clusters: Cluster[] = agrupables.map((a) => ({
    lat: a.lat,
    lng: a.lng,
    estado: a.estado,
    count: 1,
    alertas: [a],
  }));

  // Fusiona iterativamente el par más cercano dentro del radio.
  while (true) {
    let minDist = Infinity;
    let bestPair: [number, number] = [-1, -1];

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = distanciaKm(
          [clusters[i].lat, clusters[i].lng],
          [clusters[j].lat, clusters[j].lng],
        );
        if (d <= radio && d < minDist) {
          minDist = d;
          bestPair = [i, j];
        }
      }
    }

    // Si no hay par cercano, terminamos.
    if (bestPair[0] === -1) break;

    // Fusionar el par.
    const [i, j] = bestPair;
    const c1 = clusters[i];
    const c2 = clusters[j];
    const mergedAlertas = [...c1.alertas, ...c2.alertas];
    const mergedLat = mergedAlertas.reduce((s, a) => s + a.lat, 0) / mergedAlertas.length;
    const mergedLng = mergedAlertas.reduce((s, a) => s + a.lng, 0) / mergedAlertas.length;

    const merged: Cluster = {
      lat: mergedLat,
      lng: mergedLng,
      estado: estadoDominante(mergedAlertas.map((a) => a.estado)),
      count: mergedAlertas.length,
      alertas: mergedAlertas,
    };

    // Reemplazar: eliminar i y j, añadir merged.
    clusters = clusters.filter((_, idx) => idx !== i && idx !== j);
    clusters.push(merged);
  }

  return clusters;
}

export function AlertLayer({
  data,
  selectedAlertId,
  onAlertaClick,
}: AlertLayerProps) {
  // Si no se pasan datos externos, se cargan desde el backend.
  const [fetchedAlertas, setFetchedAlertas] = useState<Alerta[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiAlerts
      .listAlerts()
      .then((items: BackendAlertListItem[]) => {
        if (!cancelled) setFetchedAlertas(deriveMapAlertas(items));
      })
      .catch((err) => {
        console.error('Error cargando alertas:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const alertas = data?.alertas ?? fetchedAlertas;

  const [zoom, setZoom] = useState(() => {
    return 13;
  });

  useMapEventsAny({
    zoomend: (e: { target: { getZoom: () => number } }) => setZoom(e.target.getZoom()),
  });

  const showDetalle = zoom >= ALERT_ZOOM_DETAIL;

  const clusters = useMemo(() => {
    if (showDetalle) return [];
    return agrupar(alertas, zoom);
  }, [alertas, showDetalle, zoom]);

  return (
    <>
      {showDetalle
        ? (
            alertas.map((alerta) => {
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
                <TooltipAlerta alerta={alerta} />
                </MarkerAny>
              );
            })
          )
        : (
            clusters.map((cluster, idx) => (
              <MarkerAny
                key={`cluster-${idx}`}
                position={[cluster.lat, cluster.lng]}
                icon={makeAgrupadoIcon(cluster.estado, cluster.count)}
              >
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
  // Contar por estado dentro del cluster.
  const counts: Partial<Record<EstadoAlerta, number>> = {};
  for (const a of cluster.alertas) {
    counts[a.estado] = (counts[a.estado] ?? 0) + 1;
  }
  const desglose = Object.entries(counts)
    .map(([est, n]) => `${n} ${est.replace(/-/g, ' ')}`)
    .join(' · ');

  return (
    <TooltipAny direction="top" offset={[0, -17]}>
      <div style={{ fontFamily: 'var(--eps-font-family-sans)' }}>
        <strong style={{ color: COLOR_NUMERO[cluster.estado] }}>
          {cluster.count} alerta{cluster.count === 1 ? '' : 's'}
        </strong>
        <br />
        <span style={{ fontSize: '11px', color: 'var(--eps-text-secondary)' }}>
          {desglose}
        </span>
        <br />
        <span style={{ fontSize: '11px', color: 'var(--eps-text-secondary)' }}>
          Acerca el mapa para expandir.
        </span>
      </div>
    </TooltipAny>
  );
}