import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EditorComponente } from '@/features/componentes/components/EditorComponente';
import { apiComponentes, type BackendComponent, type BackendComponentCoord } from '@/services/apiComponentes';
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
        apiComponentes.listCoords({ component: Number(id) }).then((coords: BackendComponentCoord[]) => {
          if (cancelled) return;
          const coord = coords[0];
          const lat = coord?.geojson?.coordinates?.[1] ?? 0;
          const lng = coord?.geojson?.coordinates?.[0] ?? 0;

          setInitial({
            id: String(comp.id),
            tipo: 'captacion',
            lat,
            lng,
            codigo: comp.code,
            nombre: comp.name,
            estado: 'normal',
            criticidad: (coord?.criticality?.name?.toLowerCase().includes('alt')
              ? 'alta'
              : coord?.criticality?.name?.toLowerCase().includes('med')
                ? 'media'
                : 'baja') as Componente['criticidad'],
            unidadOperativa: comp.district.name,
            especificacion: comp.specification ?? '',
          });

          // Pasar los IDs/codes crudos del backend para precargar selects
          setInitialBackend({
            typeId: comp.type?.id,
            districtUbigeo: comp.district?.ubigeo,
            operationalStatusCode: comp.operational_status?.code,
            physicalStatusCode: comp.physical_status?.code,
            criticalityId: coord?.criticality?.id,
          });

          setLoading(false);
        });
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