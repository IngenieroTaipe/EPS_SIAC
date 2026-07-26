import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GuestLayout } from '@/layouts/GuestLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { MapaAlertasPage } from '@/pages/MapaAlertasPage';
import { MapaComponentesPage } from '@/pages/MapaComponentesPage';
import { MapaClimaticoPage } from '@/pages/MapaClimaticoPage';
import { HistoricoAlertasPage } from '@/pages/HistoricoAlertasPage';
import { GestionAlertasPage } from '@/pages/GestionAlertasPage';
import { HistoricoComponentesPage } from '@/pages/HistoricoComponentesPage';
import { EditorComponentePage } from '@/pages/EditorComponentePage';

/**
 * Punto de entrada de la SPA.
 *
 * Flujo de navegación acordado:
 *
 *   1._visitante → `/` (público)      [GuestLayout]
 *      TopBar muestra "Sistema de Alertas Climáticas" + botón Iniciar Sesión.
 *   2. clic en "Iniciar Sesión" → `/login` (público)   [GuestLayout]
 *      Formulario Usuario/Contraseña, "Ingresar" → llama `login()` y navega a `/alertas`.
 *   3. tras login → cualquier ruta interna         [AppLayout]
 *      Sidebar + TopBar (con widgets según página).
 *      Si un no autenticado intenta entrar, AppLayout redirige a `/`.
 *
 * Para añadir una nueva página:
 *   1. Crea el componente en `src/pages/`.
 *   2. Si es pública, agregá una <Route> dentro de <GuestLayout>.
 *   3. Si es protegida, agregá una <Route> dentro de <AppLayout>.
 *   4. Si tiene header personalizado, agrégalo a `topBarConfig` en `TopBarConfig.ts`.
 */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Páginas públicas ─────────────────────────────────────────── */}
        {/* HomePage usa GuestLayout (con TopBar + botón Iniciar Sesión). */}
        <Route element={<GuestLayout />}>
          <Route path="/" element={<HomePage />} />
        </Route>

        {/* LoginPage NO usa GuestLayout (no tiene TopBar). */}
        <Route path="/login" element={<LoginPage />} />

        {/* ── Páginas protegidas (sidebar + topbar) ──────────────────── */}
        <Route element={<AppLayout />}>
          <Route path="/alertas" element={<MapaAlertasPage />} />
          <Route path="/climatico" element={<MapaClimaticoPage />} />
          <Route path="/componentes" element={<MapaComponentesPage />} />
          <Route path="/componentes/gestion" element={<HistoricoComponentesPage />} />
          <Route path="/componentes/:id/editar" element={<EditorComponentePage />} />
          <Route path="/componentes/nuevo" element={<EditorComponentePage />} />
          <Route path="/alertas/gestion" element={<HistoricoAlertasPage />} />
          <Route path="/alertas/:id/editar" element={<GestionAlertasPage />} />
        </Route>

        {/* ── Fallback ────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;