import { UserCircle } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext.hooks';

/**
 * UserBadge — widget pequeño y persistente que muestra al usuario
 * autenticado y su rol. Vive en el Sidebar (sobre el botón "Cerrar
 * Sesión"), por lo que se adapta al fondo blanco del panel.
 *
 * Estilo:
 *   - Card con outline gris (`button-stroke`) sobre fondo blanco.
 *   - Icono `UserCircle` a la izquierda (navy `primary-main`).
 *   - Dos líneas: nombre legible (arriba, semibold) y rol (abajo, normal).
 *
 * El rol se deriva así:
 *   - Si `is_staff`/`is_superuser` → "Administrador".
 *   - Si no, el primer grupo del usuario (traído por `/auth/user/`).
 *   - Si no hay grupo → "Sin rol".
 *
 * Si no hay usuario cargado todavía (bootstrap en curso), no renderiza
 * nada para evitar flicker.
 *
 * `collapsed`: cuando el sidebar está colapsado (solo iconos), muestra
 * únicamente el avatar centrado con un tooltip (`title`) con nombre+rol.
 */
interface UserBadgeProps {
  collapsed?: boolean;
}

export function UserBadge({ collapsed = false }: UserBadgeProps) {
  const { user, isAdmin } = useAuth();
  if (!user) return null;

  const rol = isAdmin ? 'Administrador' : (user.groups?.[0] ?? 'Sin rol');
  const display = (user.first_name || user.username).trim() || user.username;
  const title = `${display} · ${rol}`;

  if (collapsed) {
    return (
      <div
        className="self-stretch flex justify-center"
        title={title}
        aria-label={`Sesión iniciada: ${title}`}
        role="status"
      >
        <UserCircle
          className="size-7 text-primary-main"
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div
      className="self-stretch inline-flex items-center gap-2.5 px-3 py-2 rounded-md
                 outline outline-1 outline-offset-[-1px] outline-button-stroke
                 bg-background-main"
      aria-label={`Sesión iniciada: ${title}`}
      role="status"
    >
      <UserCircle
        className="size-7 text-primary-main shrink-0"
        strokeWidth={2}
        aria-hidden="true"
      />
      <div className="flex flex-col leading-tight overflow-hidden">
        <span className="text-text-primary text-sm font-semibold font-sans truncate">
          {display}
        </span>
        <span className="text-text-secondary text-xs font-normal font-sans truncate">
          {rol}
        </span>
      </div>
    </div>
  );
}