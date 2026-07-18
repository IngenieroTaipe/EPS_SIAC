/**
 * Utilidad `cn`: combina clases condicionales y resuelve conflictos de Tailwind.
 * Usa clsx para la lógica condicional y tailwind-merge para de-duplicar utilidades
 * contradictorias (p.ej. `p-2 p-4` → `p-4`).
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}