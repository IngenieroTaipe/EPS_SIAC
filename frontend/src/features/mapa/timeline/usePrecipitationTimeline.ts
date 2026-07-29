import { useContext } from 'react';
import { PrecipitationTimelineContext } from './PrecipitationTimelineContext';

export function usePrecipitationTimeline() {
  const ctx = useContext(PrecipitationTimelineContext);
  if (!ctx) {
    throw new Error(
      'usePrecipitationTimeline debe usarse dentro de <PrecipitationTimelineProvider>',
    );
  }
  return ctx;
}