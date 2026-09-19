import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EditorComponente } from '@/features/componentes/components/EditorComponente';
import { apiComponentes, type BackendComponent, type BackendComponentListCoord } from '@/services/apiComponentes';
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
    /** Coords embebidas traidas desde el retrieve (con id, criticality, geojson). */
    coords?: BackendComponentListCoord[];
  } | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [notFound, setNotFound] = useState<boolean>(false);

  useEffect(() => {
    if (!id) {
      /* eslint-disable react-hooks/set-state-in-effect -- reset sincrono al
         desmontar la edicion (mismo patron que el resto del codigo). */
      setInitial(undefined);
      setInitialBackend(undefined);
      setNotFound(false);
      setLoading(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    apiComponentes
      .getComponente(Number(id))
      .then((comp: BackendComponent) => {
        if (cancelled) return;
        // Tras el último pull del backend, `ComponentSerializer` trae
        // `coords[]` embebido (BackendComponentListCoord) — no se necesita
        // un segundo fetch a `/component-coords/`. Pasamos el array
        // completo al editor para que gestione 1 (punto) o N (línea).
        const coords: BackendComponentListCoord[] = comp.coords ?? [];
        const first = coords[0];
        const lat = first?.geojson?.coordinates?.[1] ?? 0;
        const lng = first?.geojson?.coordinates?.[0] ?? 0;
        // criticality llega como objeto {id, name} desde el retrieve
        // (siempre); toleramos string por si el backend la envía plana.
        const critName =
          (typeof first?.criticality === 'string'
            ? first.criticality
            : first?.criticality?.name) ?? '';

        setInitial({
          id: String(comp.id),
          tipo: mapTipo(comp.type.name),
          lat,
          lng,
          codigo: comp.code,
          nombre: comp.name,
          estado: 'normal',
          criticidad:
            critName.toUpperCase().includes('ALT')
              ? 'alta'
              : critName.toUpperCase().includes('MED')
                ? 'media'
                : 'baja',
          unidadOperativa: comp.district.name,
          especificacion: comp.specification ?? '',
        });

        setInitialBackend({
          typeId: comp.type?.id,
          districtUbigeo: comp.district?.ubigeo,
          operationalStatusCode: comp.operational_status?.code,
          physicalStatusCode: comp.physical_status?.code,
          coords,
        });

        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setInitial(undefined);
        setInitialBackend(undefined);
        setNotFound(true);
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

  if (notFound) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-text-secondary">
        <p className="text-base font-sans">
          Componente no encontrado (puede haber sido eliminado).
        </p>
        <Link
          to="/componentes/gestion"
          className="px-4 py-2 rounded-lg outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary text-sm font-medium font-sans hover:bg-primary-states-hover-main/30 transition-colors"
        >
          Volver a gestión
        </Link>
      </div>
    );
  }

  return <EditorComponente initial={initial} initialBackend={initialBackend} />;
}