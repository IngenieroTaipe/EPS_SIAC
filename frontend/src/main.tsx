import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from '@/shared/context/AuthContextProvider';
import { UnidadOperativaProvider } from '@/shared/context/UnidadOperativaContextProvider';
import { apiUmbrales } from '@/services/apiUmbrales';
import { apiGFS } from '@/services/apiGFS';

/**
 * Prefetch de datos read-onlyHeavy: se lanza al arrancar la SPA (sin await)
 * para que cuando el usuario llegue a `/umbrales/gestion` los datos ya
 * estén cacheados y la página cargue instantáneamente. Las llamadas son
 * dedup/cachedadas, así que la página reutilizará la promesa en vuelo.
 *
 * No bloquea el render: si fallan, el error se descarta aquí (la página
 * volverá a intentarlo al montar, ver requestCache invalidación en error).
 */
void Promise.allSettled([apiUmbrales.listUmbrales(), apiGFS.getHistoricWindowClusters(), apiGFS.getHistoricWindowCells()]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <UnidadOperativaProvider>
        <App />
      </UnidadOperativaProvider>
    </AuthProvider>
  </StrictMode>,
);