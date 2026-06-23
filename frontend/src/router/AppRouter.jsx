import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import Login from "../pages/Login"
import ChangePassword from "../pages/ChangePassword"
import MapaClimatico from "../pages/MapaClimatico"
import MapaAlertas from "../pages/MapaAlertas"
import MapaComponentes from "../pages/MapaComponentes"

// Componente Guard para rutas protegidas generales
function ProtectedRoute({ children }) {
  const { user, mustChangePassword } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />
  }

  return children
}

// Componente Guard específico para el cambio de contraseña obligatorio
function ChangePasswordRoute({ children }) {
  const { user, mustChangePassword } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!mustChangePassword) {
    return <Navigate to="/alertas" replace />
  }

  return children
}

// Componente Guard para impedir entrar al Login si ya estás logeado
function AnonymousRoute({ children }) {
  const { user, mustChangePassword } = useAuth()

  if (user) {
    if (mustChangePassword) {
      return <Navigate to="/change-password" replace />
    }
    return <Navigate to="/alertas" replace />
  }

  return children
}

// Componentes marcadores de posición temporales para rutas en desarrollo
function PlaceholderPage({ title }) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-500 font-semibold">
      Página en Desarrollo: {title}
    </div>
  )
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Redirección inicial */}
        <Route path="/" element={<Navigate to="/climatico" replace />} />

        {/* Ruta Pública (Mapa Climático General) */}
        <Route path="/climatico" element={<MapaClimatico />} />

        {/* Ruta de Login (Anónima) */}
        <Route
          path="/login"
          element={
            <AnonymousRoute>
              <Login />
            </AnonymousRoute>
          }
        />

        {/* Ruta de Cambio Obligatorio de Contraseña */}
        <Route
          path="/change-password"
          element={
            <ChangePasswordRoute>
              <ChangePassword />
            </ChangePasswordRoute>
          }
        />

        {/* Rutas Protegidas (Requieren Login y Cambio de Contraseña previo) */}
        <Route
          path="/alertas"
          element={
            <ProtectedRoute>
              <MapaAlertas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/componentes"
          element={
            <ProtectedRoute>
              <MapaComponentes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/precipitacion"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Panel de Precipitación" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestion-alertas"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Gestión de Alertas" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gestion-componentes"
          element={
            <ProtectedRoute>
              <MapaComponentes />
            </ProtectedRoute>
          }
        />

        {/* Redirección para cualquier ruta inexistente */}
        <Route path="*" element={<Navigate to="/climatico" replace />} />
      </Routes>
    </BrowserRouter>
  )
}