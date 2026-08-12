import { useEffect, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import type { Alerta, EstadoAlerta } from '../types/alerta';
import { ALERT_ZOOM_DETAIL, ESTADOS_EN_MAPA } from '../types/alerta';

// Iconos de leyenda (vista detalle individual).
import DangerLeyendaIconUrl from '@/assets/icons/danger-leyenda.svg?url';
import WarningLeyendaIconUrl from '@/assets/icons/warning-leyenda.svg?url';
import SuccessLeyendaIconUrl from '@/assets/icons/success-leyenda.svg?url';
import InProcessResolveLeyendaIconUrl from '@/assets/icons/in-process-resolve-leyenda.svg?url';

// Iconos con número (vista cluster).
import DangerNumberIconUrl from '@/assets/icons/danger-number.svg?url';
import WarningNumberIconUrl from '@/assets/icons/warning-number.svg?url';
import SuccessNumberIconUrl from '@/assets/icons/success-number.svg?url';

// Cast a any: mismo workaround de tipos que el resto del proyecto.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Lany = L as any;

const ICON_DETALLE: Record<EstadoAlerta, string> = {
  'confirmado': DangerLeyendaIconUrl,
  'en-espera-confirmacion': WarningLeyendaIconUrl,
  'en-espera-reporte': InProcessResolveLeyendaIconUrl,
  'atendido': SuccessLeyendaIconUrl,
  'en-proceso-atencion': InProcessResolveLeyendaIconUrl,
  'no-confirmado': WarningLeyendaIconUrl,
  'predicho': WarningLeyendaIconUrl,
};

const ICON_CLUSTER: Partial<Record<EstadoAlerta, string>> = {
  'confirmado': DangerNumberIconUrl,
  'en-espera-confirmacion': WarningNumberIconUrl,
  'predicho': WarningNumberIconUrl,
  'atendido': SuccessNumberIconUrl,
};

const PULSE_COLOR: Partial<Record<EstadoAlerta, string>> = {
  'confirmado': 'var(--eps-danger-main)',
  'en-espera-confirmacion': 'var(--eps-warning-main)',
  'atendido': 'var(--eps-success-main)',
};

const ESTADOS_CON_PULSO = new Set<EstadoAlerta>([
  'confirmado',
  'en-espera-confirmacion',
  'atendido',
]);

/**
 * Prioridad del cluster: rojo > cyan > rojo-reportes > naranja > amarillo > verde.
 * Si el dominante no tiene icono `*-number.svg` (en-proceso-atencion /
 * en-espera-reporte), el `makeClusterIcon` cae al fallback DangerNumber.
 */
function estadoDominante(estados: EstadoAlerta[]): EstadoAlerta {
  if (estados.includes('confirmado')) return 'confirmado';
  if (estados.includes('en-proceso-atencion')) return 'en-proceso-atencion';
  if (estados.includes('en-espera-reporte')) return 'en-espera-reporte';
  if (estados.includes('en-espera-confirmacion')) return 'en-espera-confirmacion';
  if (estados.includes('predicho')) return 'predicho';
  if (estados.includes('atendido')) return 'atendido';
  return estados[0] ?? 'no-confirmado';
}

/** Crea un divIcon individual (con pulso si aplica). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeDetalleIcon(estado: EstadoAlerta, isSelected: boolean): any {
  const url = ICON_DETALLE[estado];
  const hasPulse = ESTADOS_CON_PULSO.has(estado);
  const pulseColor = PULSE_COLOR[estado];
  const baseSize = 64;
  const imgSize = 56;
  const scale = isSelected ? 1.15 : 1; // menos aumento al seleccionar
  const size = Math.round(baseSize * scale);
  const img = Math.round(imgSize * scale);
  const half = size / 2;
  const pulseSize = Math.round(size * 0.6);
  const pulseHtml = hasPulse && pulseColor
    ? `<div class="eps-alert-pulse" style="background: ${pulseColor};${isSelected ? ` width: ${pulseSize}px; height: ${pulseSize}px;` : ''}"></div>`
    : '';
  const selectedStyle = isSelected
    ? `background: var(--eps-background-selected); border-radius: 50%; box-shadow: 0 0 0 2px var(--eps-background-selected); filter: drop-shadow(0 4px 4px rgba(0,0,0,0.25));`
    : `filter: drop-shadow(0 4px 4px rgba(0,0,0,0.25));`;
  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px; display: grid; place-items: center; ${selectedStyle}">
      ${pulseHtml}
      <img src="${url}" style="width: ${img}px; height: ${img}px; position: relative; z-index: 1;" alt="" />
    </div>
  `;
  return Lany.divIcon({
    html,
    className: isSelected ? 'eps-alert-icon-detalle-selected' : 'eps-alert-icon-detalle',
    iconSize: [size, size],
    iconAnchor: [half, size],
    tooltipAnchor: [0, -size],
  });
}

/** Crea el divIcon del cluster con número centrado y color del estado dominante. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeClusterIcon(cluster: any): any {
  const alertas = cluster.getAllChildMarkers() as unknown as Array<{ options: { alt: string } }>;
  // Extraer estados de los child markers via el campo `alt` que guardamos.
  const estados: EstadoAlerta[] = alertas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((m) => (m as unknown as { options?: { alt?: string } }).options?.alt)
    .filter((s): s is string => !!s)
    .map((s) => s as EstadoAlerta);

  const dominante = estadoDominante(estados.length ? estados : ['no-confirmado']);
  const url = ICON_CLUSTER[dominante] ?? DangerNumberIconUrl;
  const count = cluster.getChildCount();
  const size = 64;
  const imgSize = 60;
  const half = size / 2;
  const html = `
    <div style="position: relative; width: ${size}px; height: ${size}px; display: grid; place-items: center; filter: drop-shadow(0 4px 4px rgba(0,0,0,0.25));">
      <img src="${url}" style="width: ${imgSize}px; height: ${imgSize}px; display: block;" alt="" />
      <div style="position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--eps-font-family-sans); font-weight: bold; font-size: 18px; line-height: 1; color: var(--eps-text-invert-primary); pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,0.55); transform: translateY(1px);">${count}</div>
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

interface ClusterAlertLayerProps {
  alertas: Alerta[];
  selectedAlertId?: string | null;
  onAlertaClick?: (id: string) => void;
}

/**
 * ClusterAlertLayer — capa de alertas con clustering visual basado en
 * superposición de iconos en píxeles (no distancia geográfica fija).
 *
 * Usa `leaflet.markercluster` (plugin oficial de Leaflet) que agrupa
 * markers automáticamente cuando sus iconos se sobreponen en pantalla,
 * y los separa cuando hay espacio suficiente al hacer zoom.
 *
 * Comportamiento:
 *   - A zoom alto (≥ ALERT_ZOOM_DETAIL): markers individuales con icono
 *     `*-leyenda.svg` + pulso (si aplica).
 *   - A zoom bajo: los markers que se sobreponen visualmente se agrupan
 *     en un cluster circular con número (`*-number.svg`).
 *   - El color del cluster sigue la prioridad: rojo > amarillo > verde.
 *   - `disableClusteringAtZoom`: a partir de ALERT_ZOOM_DETAIL, no agrupa.
 *   - `maxClusterRadius`: radio en píxeles para considerar sobreposición
 *     (default 80). Ajustable aquí.
 *
 * El plugin maneja automáticamente la animación de agrupar/desagrupar
 * al hacer zoom/pan — no necesitamos reaccionar manualmente a `zoomend`.
 */
export function ClusterAlertLayer({
  alertas,
  selectedAlertId,
  onAlertaClick,
}: ClusterAlertLayerProps) {
  const map = useMap();

  // Crear el cluster group una sola vez.
  const clusterGroup = useMemo(() => {
    return Lany.markerClusterGroup({
      disableClusteringAtZoom: ALERT_ZOOM_DETAIL,
      maxClusterRadius: 80,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: makeClusterIcon,
      spiderfyOnMaxZoom: false,
    });
  }, []);

  // Añadir/remover markers cuando cambian las alertas o la selección.
  useEffect(() => {
    clusterGroup.clearLayers();

    // Solo se dibujan las alertas que tienen icono de detalle asignado
    // (ver `ESTADOS_EN_MAPA` en types/alerta.ts). Excluye explícitamente
    // `no-confirmado`, que solo vive en el tabular.
    for (const alerta of alertas) {
      if (!ESTADOS_EN_MAPA.has(alerta.estado)) continue;

      const isSelected = selectedAlertId === alerta.id;
      const icon = makeDetalleIcon(alerta.estado, isSelected);
      const marker = Lany.marker([alerta.lat, alerta.lng], {
        icon,
        alt: alerta.estado, // guardamos el estado para el cluster icon
      });

      // Tooltip
      const dominante = alerta.estado;
      const colorMap: Record<EstadoAlerta, string> = {
        'confirmado': 'var(--eps-danger-main)',
        'en-espera-confirmacion': 'var(--eps-warning-main)',
        'en-espera-reporte': 'var(--eps-alerts-status-en-proceso-atencion)',
        'atendido': 'var(--eps-success-main)',
        'en-proceso-atencion': 'var(--eps-alerts-status-en-proceso-atencion)',
        'no-confirmado': 'var(--eps-text-primary)',
        'predicho': 'var(--eps-alerts-status-predicho)',
      };
      marker.bindTooltip(
        `<div style="font-family: var(--eps-font-family-sans);">
          <strong style="color: ${colorMap[dominante]};">${alerta.estado.toUpperCase()}</strong><br/>
          <span style="font-size: 12px;">${alerta.mensaje}</span><br/>
          <span style="font-size: 11px; color: var(--eps-text-secondary);">${alerta.nivel}</span>
        </div>`,
        { direction: 'top', offset: [0, -28], sticky: true },
      );

      // Click handler
      if (onAlertaClick) {
        marker.on('click', () => onAlertaClick(alerta.id));
      }

      clusterGroup.addLayer(marker);
    }
  }, [clusterGroup, alertas, selectedAlertId, onAlertaClick]);

  // Añadir el cluster group al mapa al montar, remover al desmontar.
  useEffect(() => {
    map.addLayer(clusterGroup);
    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, clusterGroup]);

  return null;
}