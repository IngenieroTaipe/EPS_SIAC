import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from '@/shared/context/AuthContextProvider';
import { UnidadOperativaProvider } from '@/shared/context/UnidadOperativaContextProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <UnidadOperativaProvider>
        <App />
      </UnidadOperativaProvider>
    </AuthProvider>
  </StrictMode>,
);