import { useParams } from 'react-router-dom';
import { GestionAlertas } from '@/features/alertas/components/GestionAlertas';
import { mockAlertasHistoricas } from '@/features/alertas/data/mockAlertasHistoricas';

/**
 * GestionAlertasPage — ruta `/alertas/:id/editar` (EDITOR de estados).
 *
 * Para recibir una alerta específica desde el sidebar "Gestionar Alertas"
 * (que en realidad va al Histórico) y desde allı el botón "Editar"
 * navega aquí con el ID de alerta correspondiente.
 *
 * La route se diferencia de `/alertas/gestion` (Histórico con filtros).
 *
 * El componente `GestionAlertas` espera recibir la alerta a editar como
 * prop `alerta` (mocked por ahora). Cuando el backend esté listo, hacer
 * aquí el fetch: `httpClient.get('/alerts/' + id).then(...)`.
 */
export function GestionAlertasPage() {
  const { id } = useParams<{ id: string }>();
  // Buscar en el mock histórico por ID. Si no existe, fallback al primero.
  const alerta =
    mockAlertasHistoricas.find((a) => a.id === id) ?? mockAlertasHistoricas[0];

  return <GestionAlertas initialAlerta={alerta} />;
}