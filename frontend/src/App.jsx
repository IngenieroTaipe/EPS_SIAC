import AppRouter from "./router/AppRouter"
import { AuthProvider } from "./context/AuthContext"
import { UnidadOperativaProvider } from "./context/UnidadOperativaContext"

export default function App() {
  return (
    <AuthProvider>
      <UnidadOperativaProvider>
        <AppRouter />
      </UnidadOperativaProvider>
    </AuthProvider>
  )
}