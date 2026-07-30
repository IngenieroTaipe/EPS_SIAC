import { GestionUmbrales } from '@/features/umbrales/components/GestionUmbrales';

/**
 * GestionUmbralesPage — ruta `/umbrales/gestion`.
 *
 * Vista de gestión de Umbrales de Fenómenos Naturales (equivalente al
 * "Gestionar Componentes" / "Gestionar Alertas"): selector de Unidad
 * Operativa, panel con el máximo umbral registrado en GFS Clusters y
 * lista de umbrales del distrito con la fila activa resaltada.
 */
export function GestionUmbralesPage() {
  return <GestionUmbrales />;
}