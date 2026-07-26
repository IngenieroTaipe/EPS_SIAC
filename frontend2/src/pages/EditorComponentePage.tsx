import { useParams } from 'react-router-dom';
import { EditorComponente } from '@/features/componentes/components/EditorComponente';
import { mockComponentes } from '@/features/mapa/data/mockComponentes';

/**
 * EditorComponentePage — ruta `/componentes/:id/editar` (y `/componentes/nuevo`).
 *
 * Busca el componente por ID en el mock. Si no existe, crea uno nuevo.
 * El componente seleccionado se pasa como `initial` al editor.
 *
 * Cuando el backend esté listo: `httpClient.get('/components/' + id).then(...)`.
 */
export function EditorComponentePage() {
  const { id } = useParams<{ id: string }>();
  const existing = id
    ? mockComponentes.componentes.find((c) => c.id === id)
    : undefined;

  return <EditorComponente initial={existing} />;
}