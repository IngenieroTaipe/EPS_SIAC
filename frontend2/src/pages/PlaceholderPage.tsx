/**
 * PlaceholderPage — vista genérica para rutas internas pendientes de
 * implementar (`/climatico`, `/componentes`, etc.).
 *
 * Muestra el título de la página según `topBarConfig`. El contenido real
 * se sustituirá cuando se maquete cada mapa.
 */
import { useLocation } from 'react-router-dom';

export function PlaceholderPage() {
  const location = useLocation();
  return (
    <div className="text-text-primary">
      <p className="text-2xl font-bold text-primary-main font-sans">
        {location.pathname}
      </p>
      <p className="mt-2 text-text-secondary text-sm">
        Esta página está pendiente de maquetar. El TopBar ya muestra el
        título correcto (configurado en <code>topBarConfig.ts</code>).
      </p>
    </div>
  );
}