/**
 * HomePage — la pestaña principal pública antes de iniciar sesión.
 *
 * Solo muestra TopBar (configurado para la ruta `/`) con
 * Unidad Operativa + botón "Iniciar Sesión". El contenido del main
 * es una bienvenida simple; se enriquecerá cuando se maquete el resto.
 *
 * El layout lo provee `GuestLayout`.
 */
export function HomePage() {
  return (
    <section className="p-8 sm:p-12 text-text-primary">
      <h1 className="text-3xl font-bold text-primary-main font-sans">
        Sistema de Alertas Climáticas
      </h1>
      <p className="mt-4 text-text-secondary max-w-2xl">
        EPS Selva Central — visualización de alertas, monitoreo de
        precipitaciones y gestión de componentes para la empresa de
        saneamiento y distribución de agua potable.
      </p>
      <p className="mt-6 text-sm text-icon-main">
        Para continuar, pulsa “Iniciar Sesión” en el encabezado superior.
      </p>
    </section>
  );
}