import { createContext } from 'react';
import type { GfsClusterFeatureCollection } from '@/features/mapa/types/gfs';
import type { TimelineBarProps } from '@/features/mapa/components/TimelineBar';
import type { GfsFrame } from '@/features/mapa/timeline/types';

export interface PrecipitationTimelineContextValue {
  /** GeoJSON original (con `_smoothedGeometry` ya calculado por useGfsForecast). */
  data: GfsClusterFeatureCollection | null;
  /** `renderData` con la geometría de pintado swap a `_smoothedGeometry`. */
  renderData: GfsClusterFeatureCollection | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;

  frames: GfsFrame[];
  frameIndex: number;
  setFrameIndex: (i: number) => void;
  activeFrame: GfsFrame | undefined;

  /** Props listas para pasar a <TimelineBar />. */
  timelineProps: Pick<
    TimelineBarProps,
    'days' | 'currentRealHour' | 'selectedHour' | 'onSelectHour' | 'isPlaying' | 'onTogglePlay'
  >;
}

/** Context object (sin Provider; vive en `PrecipitationTimelineProvider.tsx`). */
export const PrecipitationTimelineContext = createContext<PrecipitationTimelineContextValue | null>(null);