import { useContext } from 'react';
import { UnidadOperativaContext } from './UnidadOperativaContext';

export function useUnidadOperativa() {
  const ctx = useContext(UnidadOperativaContext);
  if (!ctx) {
    throw new Error('useUnidadOperativa debe usarse dentro de UnidadOperativaProvider');
  }
  return ctx;
}