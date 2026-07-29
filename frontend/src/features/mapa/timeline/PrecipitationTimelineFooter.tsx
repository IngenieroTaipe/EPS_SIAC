import { usePrecipitationTimeline } from '@/features/mapa/timeline/usePrecipitationTimeline';
import { TimelineBar } from '@/features/mapa/components/TimelineBar';

/**
 * PrecipitationTimelineFooter — wrapper que lee el contexto y decide si
 * renderizar la timeline (sólo cuando hay frames GFS disponibles). Si la
 * ventana está vacía (sin pronóstico) no muestra nada para no ocupar altura.
 *
 * Reutilizable en cualquier layout (AppLayout protegido / GuestLayout
 * público) — la única condición es que esté dentro de
 * `<PrecipitationTimelineProvider>`, que vive en `App.tsx`.
 */
export function PrecipitationTimelineFooter() {
  const { frames, timelineProps } = usePrecipitationTimeline();
  if (frames.length === 0) return null;
  return <TimelineBar {...timelineProps} />;
}