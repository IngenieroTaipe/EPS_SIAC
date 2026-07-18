import type { ComponentesResponse } from '../types/componente';

/**
 * Mock de componentes para la EPS Selva Central. Extendido con
 * `criticidad`, `unidadOperativa`, `especificacion` y `fechaActualizacion`.
 *
 * Estructura del grafo simulado:
 *
 *   [CAP-001 Captación Río Pichanaqui] (sur)
 *     ├── TRM-001 → [PLA-001 Planta Norte]
 *     │              ├── TRM-005 → [RES-001 Reservorio Central]
 *     │              └── TRM-006 → [RES-002 Reservorio Sur]
 *     ├── TRM-002 → [PLA-002 Planta Este] (con desviación)
 *     │              └── TRM-007 → [RES-003 Reservorio Periferia]
 *     └── TRM-003 → [PLA-003 Planta Oeste]
 *                   └── TRM-004 → [RES-002 Reservorio Sur] (con desviación larga)
 */
export const mockComponentes: ComponentesResponse = {
  componentes: [
    {
      id: 'CPT-001',
      tipo: 'captacion',
      lat: -11.06,
      lng: -75.31,
      codigo: 'CAP-001',
      nombre: 'Captación Río Pichanaqui',
      estado: 'normal',
      criticidad: 'baja',
      unidadOperativa: 'Pichanaqui',
      especificacion: 'Captación - Río Pichanaqui',
      fechaActualizacion: '2026-07-08T10:00:00-05:00',
    },
    {
      id: 'PLT-001',
      tipo: 'planta-tratamiento',
      lat: -11.0,
      lng: -75.30,
      codigo: 'PLA-001',
      nombre: 'Planta de Tratamiento Norte',
      estado: 'normal',
      criticidad: 'media',
      unidadOperativa: 'Pichanaqui',
      especificacion: 'Planta - Tratamiento Norte',
      fechaActualizacion: '2026-07-07T15:00:00-05:00',
    },
    {
      id: 'PLT-002',
      tipo: 'planta-tratamiento',
      lat: -11.01,
      lng: -75.27,
      codigo: 'PLA-002',
      nombre: 'Planta de Tratamiento Este',
      estado: 'alerta',
      criticidad: 'alta',
      unidadOperativa: 'Pichanaqui',
      especificacion: 'Planta - Tratamiento Este',
      fechaActualizacion: '2026-07-09T08:30:00-05:00',
    },
    {
      id: 'PLT-003',
      tipo: 'planta-tratamiento',
      lat: -11.005,
      lng: -75.325,
      codigo: 'PLA-003',
      nombre: 'Planta de Tratamiento Oeste',
      estado: 'normal',
      criticidad: 'baja',
      unidadOperativa: 'Pichanaqui',
      especificacion: 'Planta - Tratamiento Oeste',
      fechaActualizacion: '2026-07-06T14:00:00-05:00',
    },
    {
      id: 'RSV-001',
      tipo: 'reservorio',
      lat: -10.97,
      lng: -75.29,
      codigo: 'RES-001',
      nombre: 'Reservorio Central',
      estado: 'normal',
      criticidad: 'media',
      unidadOperativa: 'Pichanaqui',
      especificacion: 'Reservorio - Central',
      fechaActualizacion: '2026-07-05T12:00:00-05:00',
    },
    {
      id: 'RSV-002',
      tipo: 'reservorio',
      lat: -10.98,
      lng: -75.34,
      codigo: 'RES-002',
      nombre: 'Reservorio Sur',
      estado: 'critico',
      criticidad: 'alta',
      unidadOperativa: 'Pichanaqui',
      especificacion: 'Reservorio - Sur',
      fechaActualizacion: '2026-07-09T11:00:00-05:00',
    },
    {
      id: 'RSV-003',
      tipo: 'reservorio',
      lat: -10.955,
      lng: -75.245,
      codigo: 'RES-003',
      nombre: 'Reservorio Periferia',
      estado: 'normal',
      criticidad: 'baja',
      unidadOperativa: 'Pichanaqui',
      especificacion: 'Reservorio - Periferia',
      fechaActualizacion: '2026-07-02T18:00:00-05:00',
    },
  ],

  tramos: [
    {
      id: 'TRM-001',
      origenId: 'CPT-001',
      destinoId: 'PLT-001',
      codigo: 'LDC-001',
      nombre: 'Línea Captación → Planta Norte',
      puntos: [
        [-11.06, -75.31],
        [-11.045, -75.312],
        [-11.03, -75.308],
        [-11.015, -75.302],
        [-11.0, -75.30],
      ],
    },
    {
      id: 'TRM-002',
      origenId: 'CPT-001',
      destinoId: 'PLT-002',
      codigo: 'LDC-002',
      nombre: 'Línea Captación → Planta Este',
      puntos: [
        [-11.06, -75.31],
        [-11.05, -75.295],
        [-11.04, -75.28],
        [-11.03, -75.272],
        [-11.02, -75.27],
        [-11.01, -75.27],
      ],
    },
    {
      id: 'TRM-003',
      origenId: 'CPT-001',
      destinoId: 'PLT-003',
      codigo: 'LDC-003',
      nombre: 'Línea Captación → Planta Oeste',
      puntos: [
        [-11.06, -75.31],
        [-11.055, -75.32],
        [-11.04, -75.322],
        [-11.025, -75.327],
        [-11.01, -75.325],
        [-11.005, -75.325],
      ],
    },
    {
      id: 'TRM-004',
      origenId: 'PLT-003',
      destinoId: 'RSV-002',
      codigo: 'LDC-004',
      nombre: 'Línea Planta Oeste → Reservorio Sur',
      puntos: [
        [-11.005, -75.325],
        [-10.99, -75.33],
        [-10.985, -75.335],
        [-10.98, -75.34],
      ],
    },
    {
      id: 'TRM-005',
      origenId: 'PLT-001',
      destinoId: 'RSV-001',
      codigo: 'LDC-005',
      nombre: 'Línea Planta Norte → Reservorio Central',
      puntos: [
        [-11.0, -75.30],
        [-10.99, -75.298],
        [-10.98, -75.295],
        [-10.97, -75.29],
      ],
    },
    {
      id: 'TRM-006',
      origenId: 'PLT-001',
      destinoId: 'RSV-002',
      codigo: 'LDC-006',
      nombre: 'Línea Planta Norte → Reservorio Sur',
      puntos: [
        [-11.0, -75.30],
        [-10.99, -75.315],
        [-10.985, -75.325],
        [-10.98, -75.34],
      ],
    },
    {
      id: 'TRM-007',
      origenId: 'PLT-002',
      destinoId: 'RSV-003',
      codigo: 'LDC-007',
      nombre: 'Línea Planta Este → Reservorio Periferia',
      puntos: [
        [-11.01, -75.27],
        [-10.995, -75.265],
        [-10.98, -75.26],
        [-10.965, -75.255],
        [-10.955, -75.245],
      ],
    },
  ],
};