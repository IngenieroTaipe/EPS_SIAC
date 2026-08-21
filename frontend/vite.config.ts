import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import { fileURLToPath, URL } from 'node:url';

// Configuración Vite del frontend EPS_SIAC (Sistema de Alertas Climáticas).
// Alias `@/` → `src/` para imports absolutos.
// SVGR activado: `import Foo from 'foo.svg?react'` retorna un componente React.
// `import fooUrl from 'foo.svg'` (sin sufijo) sigue devolviendo la URL del asset.
export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app'],
    host: true,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://api:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});