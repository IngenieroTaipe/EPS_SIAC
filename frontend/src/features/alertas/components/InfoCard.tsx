import type { AlertaHistorica } from '../types';

/**
 * Tarjeta "Información de identificación".
 *
 * Muestra campos de solo lectura:
 *   - Código de alerta (ID, no editable)
 *   - Unidad Operativa
 *   - Distrito
 *
 * Campo estilizado como input-disabled según Figma:
 *   fondo `button-fill-button`, borde `button-stroke`, texto `text-status-placeholder`.
 */
interface InfoCardProps {
  alerta: AlertaHistorica;
}

export function InfoCard({ alerta }: InfoCardProps) {
  return (
    <div className="self-stretch bg-background-main rounded-2xl outline outline-1 outline-offset-[-1px] outline-input-stroke-main px-6 py-5 flex flex-col items-start gap-4">
      <h2 className="self-stretch text-text-primary text-base font-bold font-sans leading-6">
        Información de identificación
      </h2>

      <Campo label="Código de alerta (No editable)" value={alerta.id} />
      <Campo label="Unidad Operativa" value={alerta.unidadOperativa} />
      <Campo label="Distrito" value={alerta.distrito} />
    </div>
  );
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div className="self-stretch flex flex-col items-start gap-1.5">
      <span className="self-stretch text-text-primary text-xs font-normal font-sans leading-5">
        {label}
      </span>
      <div className="self-stretch bg-button-fill-button rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke px-4 py-2.5">
        <span className="text-text-status-placeholder text-sm font-normal font-sans leading-5">
          {value}
        </span>
      </div>
    </div>
  );
}