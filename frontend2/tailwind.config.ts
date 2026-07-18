import type { Config } from 'tailwindcss';

/**
 * Design System tokens — EPS_SIAC (Sistema de Alertas Climáticas).
 *
 * Fuente única de verdad exportada desde Figma vía Tokens Studio.
 * Archivos originales (paleta de colores.json, formato.json, tipografia.json)
 * viven junto al diseño en Figma y fueron consolidados aquí.
 *
 * Referencias Figma resueltas:
 *   background.main       = {text.invertPrimary}      → #ffffff
 *   button.stroke         = {input.stroke.main}       → #abb5be
 *   typography.h1         = {fontSize.3rem}           → 30px
 *   typography.h2         = {fontSize.2rem}           → 20px
 *
 * Convención: TODAS las claves multi-palabra van en kebab-case (con guion).
 * Tailwind preserva las claves tal cual al generar utilidades, así que
 * `text: { 'invert-primary': '#fff' }` produce `text-text-invert-primary`.
 * No usar camelCase aquí — rompería la coincidencia con el JSX en kebab.
 *
 * Para hovers/selección en JSX se prefiere el modificador `bg-primary-main/40`
 * (sintaxis idiomática con `--tw-bg-opacity`) sobre hex8 con alpha embebida.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Marca: primary / secondary / background ───────────────────────
        primary: {
          main: '#070b5b',
          light: '#3238ab',
          dark: '#32386d',
          'extra-light': '#696db8',
          'hover-dark': '#1f2347',
          states: {
            'hover-main': '#070b5b66',
            'hover-light': '#3238ab66',
            'selected-main': '#070b5b80',
            'selected-light': '#3238ab80',
          },
        },
        secondary: {
          main: '#ff0000',
          background: '#ff6262',
          hover: '#ff000033',
        },
        background: {
          main: '#ffffff',
        },

        // ── Texto ─────────────────────────────────────────────────────────
        text: {
          primary: '#21272a',
          'invert-primary': '#ffffff',
          secondary: '#6f6c8f',
          terciary: '#170f49',
          status: {
            placeholder: '#d9dbe9',
          },
        },

        // ── Controles: input / icon / button ──────────────────────────────
        input: {
          stroke: { main: '#abb5be' },
        },
        icon: {
          main: '#626262',
        },
        button: {
          stroke: '#abb5be',
          'fill-button': '#f8fafc',
        },

        // ── Estados semánticos: danger / warning / success ────────────────
        danger: {
          main: '#d32f2f',
          light: '#ef5350',
          dark: '#c62828',
          states: {
            hover: '#d32f2f4d',
            selected: '#d32f2f66',
            'focus-visible': '#d32f2f80',
            'outline-border': '#d32f2f99',
          },
        },
        warning: {
          main: '#ef6c00',
          light: '#e3aa4e',
          dark: '#cb5c00',
          states: {
            hover: '#ef6c004d',
            selected: '#ef6c0066',
            'focus-visible': '#ef6c0080',
            'outline-border': '#ef6c0099',
          },
        },
        success: {
          main: '#11b95a',
          light: '#78e09e',
          dark: '#00550c',
          states: {
            hover: '#11b95a4d',
            selected: '#11b95a66',
            'focus-visible': '#11b95a80',
            'outline-border': '#11b95a99',
          },
        },

        // ── Dominio: alertas ── estado (status) y precipitaciones ────────
        alerts: {
          status: {
            predicho: '#f9d800',
            'no-confirmado': '#7b818a',
            'confirmado-reporte': '#ff3737',
            atendido: '#1eff6b',
            'en-espera-confirmacion': '#ffb03d',
            'en-proceso-atencion': '#0daec9',
            fill: {
              predicho: '#f9d80080',
              'no-confirmado': '#7b818a80',
              'confirmado-reporte': '#ff373780',
              atendido: '#1eff6b80',
              'en-espera-confirmacion': '#ffb03d80',
              'en-proceso-atencion': '#0daec980',
            },
          },
          precipitaciones: {
            'moderadamente-lluvioso': '#77e5ff',
            lluvioso: '#252ad5',
            'muy-lluvioso': '#59257d',
            'extremadamente-lluvioso': '#7a1a23',
            states: {
              'moderadamente-lluvioso-hover': '#77e5ff66',
              lluvioso: '#252ad580',
              'muy-lluvioso': '#59257d80',
              'extremadamente-lluvioso': '#5d030c80',
            },
          },
        },
      },

      // ── Tipografía (Instrument Sans) ───────────────────────────────────
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // '1rem' token Figma = 10px (base de su DS).
        '1rem': ['10px', { lineHeight: '1.2' }],
        '2rem': ['20px', { lineHeight: '1.4' }],
        '3rem': ['30px', { lineHeight: '1.5' }],
        h1: ['30px', { lineHeight: '1.5' }],
        h2: ['20px', { lineHeight: '1.4' }],
      },

      // ── Formato (radii y paddings por componente) ──────────────────────
      borderRadius: {
        DEFAULT: '6px',
        button: '5px',
        section: '10px',
      },
      padding: {
        'button-x': '10px',
        'table-x': '10px',
      },
      gap: {
        'table-y': '2px',
      },
    },
  },
  plugins: [],
};

export default config;