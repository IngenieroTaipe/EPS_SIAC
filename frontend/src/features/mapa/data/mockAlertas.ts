import type { AlertasResponse } from '../types/alerta';

/**
 * Mock de alertas.
 *
 * Las alertas se ubican sobre componentes existentes en `mockComponentes.ts`
 * (mismas coordenadas) para que cuando se vean ambos layers el efecto sea
 * "alerta encima del componente".
 *
 * Distribución simulada:
 *   - Confirmadas (3)    → captación + planta este + reservorio sur (estado critico)
 *   - Por confirmar (2)  → planta norte + planta oeste
 *   - Atendidas (2)     → reservorio central + reservorio periferia
 *   - En proceso (1)    → linea de conducción tramo-002 (punto intermedio)
 *
 * Total: 8 alertas. Cuando se agrupan por zoom bajo, se muestran 3 clusters:
 *   - Cluster rojo (danger-number) en zona sur: 3 confirmadas
 *   - Cluster naranja (warning-number) en zona norte: 2 por confirmar
 *   - Cluster verde (success-number) al noreste: 2 atendidas
 */
export const mockAlertas: AlertasResponse = {
  alertas: [
    {
      id: 'ALT-001',
      componenteId: 'CPT-001',
      estado: 'confirmado',
      lat: -11.06,
      lng: -75.31,
      mensaje: 'Precipitación extrema detectada en captación',
      nivel: 'precipitacion',
      fecha: '2026-07-18T07:30:00Z',
    },
    {
      id: 'ALT-002',
      componenteId: 'PLT-002',
      estado: 'confirmado',
      lat: -11.01,
      lng: -75.27,
      mensaje: 'Planta Este con sobrecarga por lluvias',
      nivel: 'precipitacion',
      fecha: '2026-07-18T07:45:00Z',
    },
    {
      id: 'ALT-003',
      componenteId: 'RSV-002',
      estado: 'confirmado',
      lat: -10.98,
      lng: -75.34,
      mensaje: 'Reservorio Sur al 95% de capacidad',
      nivel: 'capacidad',
      fecha: '2026-07-18T08:00:00Z',
    },
    {
      id: 'ALT-004',
      componenteId: 'PLT-001',
      estado: 'en-espera-confirmacion',
      lat: -11.0,
      lng: -75.30,
      mensaje: 'Posible sedimentación alta en Planta Norte',
      nivel: 'sedimentacion',
      fecha: '2026-07-18T08:10:00Z',
    },
    {
      id: 'ALT-005',
      componenteId: 'PLT-003',
      estado: 'en-espera-confirmacion',
      lat: -11.005,
      lng: -75.325,
      mensaje: 'Variación de presión en Planta Oeste',
      nivel: 'presion',
      fecha: '2026-07-18T08:15:00Z',
    },
    {
      id: 'ALT-006',
      componenteId: 'RSV-001',
      estado: 'atendido',
      lat: -10.97,
      lng: -75.29,
      mensaje: 'Mantenimiento completado en Reservorio Central',
      nivel: 'mantenimiento',
      fecha: '2026-07-18T06:00:00Z',
    },
    {
      id: 'ALT-007',
      componenteId: 'RSV-003',
      estado: 'atendido',
      lat: -10.955,
      lng: -75.245,
      mensaje: 'Reservorio Periferia operativo',
      nivel: 'mantenimiento',
      fecha: '2026-07-18T05:30:00Z',
    },
    {
      id: 'ALT-008',
      componenteId: 'TRM-002',
      estado: 'en-proceso-atencion',
      lat: -11.04,
      lng: -75.28,
      mensaje: 'Línea de conducción 2 en reparación',
      nivel: 'fisura',
      fecha: '2026-07-18T08:20:00Z',
    },
  ],
};