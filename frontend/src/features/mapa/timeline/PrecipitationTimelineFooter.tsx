import { useLocation } from 'react-router-dom';
import { usePrecipitationTimeline } from '@/features/mapa/timeline/usePrecipitationTimeline';
import { TimelineBar } from '@/features/mapa/components/TimelineBar';

/**
 * PrecipitationTimelineFooter — wrapper que lee el contexto y decide si
 * renderizar la timeline. Sólo aparece en las vistas que muestran un mapa
 * (Home público + Alertas + Climático + Componentes); en el resto de
 * rutas (histórico, gestión, editor, login) no se pinta. Además, si la
 * ventana está vacía (sin pronóstico) tampoco se muestra.
 */
const TIMELINE_ROUTES = new Set(['/', '/alertas', '/climatico', '/componentes']);

export function PrecipitationTimelineFooter() {
  const { frames, timelineProps } = usePrecipitationTimeline();
  const { pathname } = useLocation();
  if (frames.length === 0) return null;
  if (!TIMELINE_ROUTES.has(pathname)) return null;
  return <TimelineBar {...timelineProps} />;
}