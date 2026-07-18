/**
 * MapaAlertasPage — placeholder de la página interna "Mapa de Alertas Climáticas".
 *
 * Se renderiza dentro de `<AppLayout>` (con Sidebar + TopBar). Aquí vivirá
 * el mapa con la capa de alertas cuando se maquete esa interfaz.
 */
export function MapaAlertasPage() {
  return (
    <div className="text-text-primary">
      <p className="text-2xl font-bold text-primary-main font-sans">
        Mapa de Alertas Climáticas
      </p>
      <p className="mt-2 text-text-secondary text-sm">
        Aquí se renderizará el mapa Leaflet con la capa de alertas activas.
      </p>
    </div>
  );
}