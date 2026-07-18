import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GuestLayout } from '@/layouts/GuestLayout';
import { AppLayout } from '@/layouts/AppLayout';
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { MapaAlertasPage } from '@/pages/MapaAlertasPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

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
        {/* ── Páginas públicas (sin sidebar) ─────────────────────────── */}
        <Route element={<GuestLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* ── Páginas protegidas (sidebar + topbar) ──────────────────── */}
        <Route element={<AppLayout />}>
          <Route path="/alertas" element={<MapaAlertasPage />} />
          <Route path="/climatico" element={<PlaceholderPage />} />
          <Route path="/componentes" element={<PlaceholderPage />} />
          <Route path="/componentes/gestion" element={<PlaceholderPage />} />
          <Route path="/alertas/gestion" element={<PlaceholderPage />} />
        </Route>

        {/* ── Fallback ────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;