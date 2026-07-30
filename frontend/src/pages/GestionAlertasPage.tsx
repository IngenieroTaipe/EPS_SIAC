import { GestionAlertas } from '@/features/alertas/components/GestionAlertas';

/**
 * GestionAlertasPage — ruta `/alertas/:id/editar` (EDITOR de estados).
 *
 * El componente `GestionAlertas` extrae el `:id` (code de la alerta)
 * directamente de `useParams` y carga el detalle desde la API.
 */
export function GestionAlertasPage() {
  return <GestionAlertas />;
}