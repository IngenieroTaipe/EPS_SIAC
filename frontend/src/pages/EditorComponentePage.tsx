import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EditorComponente } from '@/features/componentes/components/EditorComponente';
import { apiComponentes, type BackendComponent } from '@/services/apiComponentes';
import { mapTipo } from '@/services/adaptadores';
import type { Componente } from '@/features/mapa/types/componente';

/**
 * EditorComponentePage — ruta `/componentes/:id/editar` (y `/componentes/nuevo`).
 *
 * Si recibe `id`, hace fetch al backend (`GET /components/{id}/`) para
 * precargar el formulario. Si no hay `id`, abre el editor en blanco
 * para crear un componente nuevo.
 */
export function EditorComponentePage() {
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<Componente | undefined>(undefined);
  const [initialBackend, setInitialBackend] = useState<{
    typeId?: number;
    districtUbigeo?: string;
    operationalStatusCode?: string;
    physicalStatusCode?: string;
    criticalityId?: number;
    coordId?: number;
    criticalityIdFromCoord?: number;
    /** Nombre de la criticidad traido desde la coordenada embebida (StringRelatedField). */
    criticalityName?: string;
  } | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(!!id);

  useEffect(() => {
    if (!id) {
      setInitial(undefined);
      setInitialBackend(undefined);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    apiComponentes
      .getComponente(Number(id))
      .then((comp: BackendComponent) => {
        if (cancelled) return;
        // Tras el último pull del backend, `ComponentSerializer` trae
        // `coords[]` embebido (BackendComponentListCoord) — no se necesita
        // un segundo fetch a `/component-coords/`.
        const coord = comp.coords?.[0];
        const lat = coord?.coords?.coordinates?.[1] ?? 0;
        const lng = coord?.coords?.coordinates?.[0] ?? 0;

        setInitial({
          id: String(comp.id),
          tipo: mapTipo(comp.type.name),
          lat,
          lng,
          codigo: comp.code,
          nombre: comp.name,
          estado: 'normal',
          criticidad:
            (coord?.criticality ?? '').toUpperCase().includes('ALT')
              ? 'alta'
              : (coord?.criticality ?? '').toUpperCase().includes('MED')
                ? 'media'
                : 'baja',
          unidadOperativa: comp.district.name,
          especificacion: comp.specification ?? '',
        });

        // `BackendComponentListCoord` expone `id` del ComponentCoord y el
        // nombre de la criticidad como StringRelatedField (no el id). Pasamos
        // el nombre al editor via `criticalityName` para que pueda mapearlo
        // al id del catalogo una vez cargado.
        setInitialBackend({
          typeId: comp.type?.id,
          districtUbigeo: comp.district?.ubigeo,
          operationalStatusCode: comp.operational_status?.code,
          physicalStatusCode: comp.physical_status?.code,
          criticalityId: undefined,
          coordId: coord?.id,
          criticalityIdFromCoord: undefined,
          criticalityName: coord?.criticality,
        });

        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setInitial(undefined);
        setInitialBackend(undefined);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-text-secondary">
        Cargando componente…
      </div>
    );
  }

  return <EditorComponente initial={initial} initialBackend={initialBackend} />;
}