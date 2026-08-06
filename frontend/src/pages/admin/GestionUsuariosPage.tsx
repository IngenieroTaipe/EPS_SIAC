import { useEffect, useMemo, useState } from 'react';
import { UserPlus, X, Pencil, Trash2, ShieldCheck, ShieldOff, Eye, EyeOff } from 'lucide-react';
import { apiAuth } from '@/services/apiAuth';
import { FilterableSelect, type FilterableOption } from '@/shared/components/FilterableSelect';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { useAuth } from '@/shared/context/AuthContext.hooks';

/**
 * Validadores cliente que espejan `AUTH_PASSWORD_VALIDATORS` del backend
 * (settings.py):
 *   - UserAttributeSimilarityValidator  → ratio > 0.7 contra
 *     username/first_name/last_name/email.
 *   - MinimumLengthValidator            → min 8 caracteres.
 *   - CommonPasswordValidator           → lista de contraseñas comunes; en
 *     el cliente sólo bloqueamos las más obvias (delegamos el resto al
 *     backend, que mantiene la lista completa).
 *   - NumericPasswordValidator          → no 100% numérica.
 *
 * Devuelve un array de mensajes legibles; vacío = válida.
 */
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'qwerty', 'qwerty123', '12345678',
  'abc12345', 'iloveyou', 'admin123', 'letmein', 'welcome1', 'monkey123',
]);

function sequenceRatio(a: string, b: string): number {
  // SequenceMatcher simplificado (LCS / max(longitudes)) — proxy del
  // difflib.SequenceMatcher.ratio() usado por Django (suficiente para
  // filtrar casos patológicos como "benjamin" vs "benjamin123").
  if (!a || !b) return 0;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  const n = longer.length;
  const m = shorter.length;
  // DP de LCS.
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        shorter[i - 1] === longer[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const lcs = dp[m][n];
  return (2 * lcs) / (a.length + b.length);
}

function validatePassword(password: string, attrs: {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
}): string[] {
  const errors: string[] = [];
  if (!password) return [];
  if (password.length < 8) {
    errors.push('Debe tener al menos 8 caracteres.');
  }
  if (/^\d+$/.test(password)) {
    errors.push('No puede ser completamente numérica.');
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Es una contraseña demasiado común.');
  }
  const candidates = [attrs.username, attrs.email, attrs.first_name, attrs.last_name]
    .map((s) => (s ? s.trim().toLowerCase() : ''))
    .filter(Boolean);
  const pw = password.toLowerCase();
  for (const c of candidates) {
    if (c.length < 4) continue;
    if (sequenceRatio(pw, c) > 0.7) {
      errors.push(`Es demasiado similar a "${c}".`);
      break;
    }
  }
  return errors;
}

/**
 * GestionUsuariosPage — ruta `/admin/usuarios`.
 *
 * CRUD de usuarios (modelo `User` de Django) accesible solo para admin.
 * Permite:
 *   - Listar usuarios con su rol (grupo) y estado de staff.
 *   - Crear un nuevo usuario asignando grupos (roles).
 *   - Editar un usuario (nombre/email/activos/grupos) y, opcionalmente,
 *     restablecer la contraseña.
 *   - Eliminar un usuario (con confirmación).
 *
 * Los roles disponibles se cargan vía `Group.objects.all()` (no hay
 * endpoint CRUD de grupos expuesto; se piden directamente al serializer
 * embebido en el detalle de usuarios). En esta versión inicial
 * solicitamos los grupos a través del propio listado de usuarios y
 * dejamos la selección libre usando IDs conocidos (1=Administrator,
 * 2=Operator, 3=Worker) — ver `seed_auths.py` del backend. Es un
 * compromiso razonable mientras no se exponga `/auth/groups/`.
 */
const ROLE_GROUPS: FilterableOption[] = [
  { value: '1', label: 'Administrator' },
  { value: '2', label: 'Operator' },
  { value: '3', label: 'Worker' },
];

interface BackendUser {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff: boolean;
  is_active?: boolean;
  groups?: number[];
  groups_names?: string[];
}

interface UserForm {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_active: boolean;
  groupId: string; // 0 = sin grupo
  password: string; // solo create / opcional en edit
  passwordConfirm: string; // confirmación client-side
}

const EMPTY_FORM: UserForm = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  is_staff: false,
  is_active: true,
  groupId: '',
  password: '',
  passwordConfirm: '',
};

export function GestionUsuariosPage() {
  useAuth(); // guard via RequireAdmin

  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState<boolean>(false);
  const [editing, setEditing] = useState<BackendUser | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState<boolean>(false);

  const [form, setForm] = useState<UserForm>(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect */
    setLoading(true);
    apiAuth
      .listUsers()
      .then((list) => !cancelled && setUsers(list as BackendUser[]))
      .catch(() => {
        if (!cancelled) {
          setUsers([]);
          setError('No se pudieron cargar los usuarios.');
        }
      })
      .finally(() => !cancelled && setLoading(false));
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      cancelled = true;
    };
  }, []);

  const usersSorted = useMemo(
    () => [...users].sort((a, b) => a.username.localeCompare(b.username, 'es')),
    [users],
  );

  /** Errores de validación de contraseña en vivo (solo cuando se escribe). */
  const passwordHints = useMemo<string[]>(() => {
    if (!form.password) return [];
    return validatePassword(form.password, {
      username: form.username,
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
    });
  }, [form.password, form.username, form.email, form.first_name, form.last_name]);

  // ── Helpers ────────────────────────────────────────────────────────
  function resetForm() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowPassword(false);
    setShowPasswordConfirm(false);
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function openEdit(u: BackendUser) {
    setForm({
      username: u.username,
      email: u.email ?? '',
      first_name: u.first_name ?? '',
      last_name: u.last_name ?? '',
      is_staff: !!u.is_staff,
      is_active: u.is_active !== false,
      groupId: u.groups?.[0] !== undefined ? String(u.groups[0]) : '',
      password: '',
      passwordConfirm: '',
    });
    setFormError(null);
    setEditing(u);
  }

  async function handleSubmitCreate() {
    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError('Usuario, email y contraseña son obligatorios.');
      return;
    }
    // Usuarios sin flag staff DEBEN tener un rol (grupo) asignado,
    // si no quedan como literatura muerta en el sistema.
    if (!form.is_staff && !form.groupId) {
      setFormError('Asigna un rol a los usuarios que no son administrador.');
      return;
    }
    const pwErrors = validatePassword(form.password, {
      username: form.username,
      email: form.email,
      first_name: form.first_name,
      last_name: form.last_name,
    });
    if (pwErrors.length > 0) {
      setFormError(pwErrors[0]);
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setFormError('Las contraseñas no coinciden.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim() || undefined,
        last_name: form.last_name.trim() || undefined,
        is_staff: form.is_staff,
        is_active: form.is_active,
        groups: form.groupId ? [Number(form.groupId)] : [],
      };
      const created = (await apiAuth.createUser(payload)) as BackendUser;
      setUsers((prev) => [...prev, created]);
      setShowCreate(false);
      resetForm();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> | string } };
      const data = e?.response?.data;
      const msg =
        (typeof data === 'object' && data && JSON.stringify(data)) ||
        (typeof data === 'string' && data) ||
        'No se pudo crear el usuario.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmitEdit() {
    if (!editing) return;
    // Mismo chequeo que en create: si se quita staff, debe tener rol.
    if (!form.is_staff && !form.groupId) {
      setFormError('Asigna un rol a los usuarios que no son administrador.');
      return;
    }
    // Validación de contraseña solo si el admin está cambiándola.
    if (form.password.trim()) {
      const pwErrors = validatePassword(form.password, {
        username: form.username,
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
      });
      if (pwErrors.length > 0) {
        setFormError(pwErrors[0]);
        return;
      }
      if (form.password !== form.passwordConfirm) {
        setFormError('Las contraseñas no coinciden.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        is_staff: form.is_staff,
        is_active: form.is_active,
        groups: form.groupId ? [Number(form.groupId)] : [],
      };
      if (form.password.trim()) payload.password = form.password.trim();
      const updated = (await apiAuth.updateUser(
        editing.id,
        payload as Parameters<typeof apiAuth.updateUser>[1],
      )) as BackendUser;
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setEditing(null);
      resetForm();
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown> | string } };
      const data = e?.response?.data;
      const msg =
        (typeof data === 'object' && data && JSON.stringify(data)) ||
        (typeof data === 'string' && data) ||
        'No se pudo actualizar el usuario.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (confirmDeleteId === null) return;
    try {
      await apiAuth.deleteUser(confirmDeleteId);
      setUsers((prev) => prev.filter((u) => u.id !== confirmDeleteId));
    } catch {
      // best-effort (puede fallar si el usuario es el propio admin)
    } finally {
      setConfirmDeleteId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden p-6 text-text-primary">
      <div className="flex items-center justify-between shrink-0 mb-4">
        <p className="text-sm text-text-secondary font-sans">
          Crea, edita y elimina usuarios del sistema y asigna sus roles.
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
                     bg-primary-main text-text-invert-primary font-sans text-sm font-medium
                     hover:bg-primary-light transition-colors
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main"
        >
          <UserPlus className="size-4" strokeWidth={2} aria-hidden="true" />
          Nuevo Usuario
        </button>
      </div>

      {error && (
        <p className="text-sm font-sans text-secondary-main shrink-0 mb-3">{error}</p>
      )}

      {/* ── Tabla de usuarios ──────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto rounded-xl border border-input-stroke-main">
        <table className="w-full text-sm font-sans">
          <thead className="sticky top-0 bg-primary-main text-text-invert-primary">
            <tr>
              <th className="text-left px-4 py-3 font-semibold w-48">Usuario</th>
              <th className="text-left px-4 py-3 font-semibold">Nombre</th>
              <th className="text-left px-4 py-3 font-semibold">Email</th>
              <th className="text-left px-4 py-3 font-semibold w-44">Rol</th>
              <th className="text-left px-4 py-3 font-semibold w-28">Estado</th>
              <th className="text-right px-4 py-3 font-semibold w-32">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  Cargando usuarios…
                </td>
              </tr>
            ) : usersSorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                  No hay usuarios registrados.
                </td>
              </tr>
            ) : (
              usersSorted.map((u) => {
                const roleName =
                  u.groups_names?.[0] ||
                  ROLE_GROUPS.find((g) => g.value === String(u.groups?.[0] ?? ''))?.label ||
                  '—';
                return (
                  <tr
                    key={u.id}
                    className="border-t border-button-stroke hover:bg-primary-states-hover-main/10 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{u.username}</td>
                    <td className="px-4 py-3 text-text-secondary">
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{u.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        {u.is_staff ? (
                          <ShieldCheck
                            className="size-4 text-primary-main"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        ) : (
                          <ShieldOff
                            className="size-4 text-text-secondary"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        )}
                        {roleName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ' +
                          (u.is_active !== false
                            ? 'bg-success-main/15 text-success-dark'
                            : 'bg-secondary-main/15 text-secondary-main')
                        }
                      >
                        <span
                          className={
                            'size-1.5 rounded-full ' +
                            (u.is_active !== false
                              ? 'bg-success-main'
                              : 'bg-secondary-main')
                          }
                          aria-hidden="true"
                        />
                        {u.is_active !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          title="Editar"
                          className="p-1.5 rounded-md text-text-secondary hover:bg-primary-states-hover-main/30 hover:text-primary-main transition-colors"
                        >
                          <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(u.id)}
                          title="Eliminar"
                          className="p-1.5 rounded-md text-text-secondary hover:bg-secondary-background hover:text-text-invert-primary transition-colors"
                        >
                          <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal Crear / Editar ────────────────────────────────────── */}
      {(showCreate || editing) && (
        <div
          className="fixed inset-0 z-[900] flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreate(false);
              setEditing(null);
              resetForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-modal-title"
            className="w-full max-w-lg bg-background-main rounded-section shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] p-6 flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="user-modal-title"
                className="text-xl font-bold font-sans text-primary-main flex items-center gap-2"
              >
                <UserPlus className="size-5" strokeWidth={2} aria-hidden="true" />
                {editing ? 'Editar usuario' : 'Nuevo usuario'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                  resetForm();
                }}
                className="p-1.5 rounded-md text-text-secondary hover:bg-primary-states-hover-main/30"
                aria-label="Cerrar"
              >
                <X className="size-5" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-primary text-sm font-medium font-sans">
                    Usuario <span className="text-secondary-main">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, username: e.target.value }))
                    }
                    placeholder="jperez"
                    className="px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke
                               bg-background-main text-text-primary font-sans text-sm
                               focus:outline-2 focus:outline-primary-main"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-primary text-sm font-medium font-sans">
                    Rol
                  </label>
                  <FilterableSelect
                    value={form.groupId}
                    onChange={(v) => setForm((f) => ({ ...f, groupId: v }))}
                    options={ROLE_GROUPS}
                    placeholder="Buscar rol…"
                    emptyLabel="— Sin rol —"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-primary text-sm font-medium font-sans">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, first_name: e.target.value }))
                    }
                    placeholder="Juan"
                    className="px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke
                               bg-background-main text-text-primary font-sans text-sm
                               focus:outline-2 focus:outline-primary-main"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-text-primary text-sm font-medium font-sans">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, last_name: e.target.value }))
                    }
                    placeholder="Pérez"
                    className="px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke
                               bg-background-main text-text-primary font-sans text-sm
                               focus:outline-2 focus:outline-primary-main"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-text-primary text-sm font-medium font-sans">
                  Email <span className="text-secondary-main">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jperez@eps-siac.gob.pe"
                  className="px-4 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke
                             bg-background-main text-text-primary font-sans text-sm
                             focus:outline-2 focus:outline-primary-main"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-text-primary text-sm font-medium font-sans">
                  {editing ? 'Nueva contraseña (opcional)' : 'Contraseña'}{' '}
                  {!editing && <span className="text-secondary-main">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder={
                      editing
                        ? 'Dejar en blanco para mantener'
                        : 'Mínimo 8 caracteres'
                    }
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke
                               bg-background-main text-text-primary font-sans text-sm
                               focus:outline-2 focus:outline-primary-main"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                </div>

                {/* Criterios en vivo mientras se escribe */}
                {form.password && passwordHints.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs font-sans text-warning-dark">
                    {passwordHints.map((h) => (
                      <li key={h}>• {h}</li>
                    ))}
                  </ul>
                )}

                {/* Indicador visual match confirmación */}
                {form.passwordConfirm && (
                  <span
                    className={
                      'text-xs font-sans ' +
                      (form.password === form.passwordConfirm
                        ? 'text-success-dark'
                        : 'text-secondary-main')
                    }
                  >
                    {form.password === form.passwordConfirm
                      ? '✓ Las contraseñas coinciden'
                      : 'Las contraseñas no coinciden'}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-text-primary text-sm font-medium font-sans">
                  Confirmar contraseña {!editing && <span className="text-secondary-main">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    value={form.passwordConfirm}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, passwordConfirm: e.target.value }))
                    }
                    placeholder="Repite la contraseña"
                    className="w-full pl-4 pr-10 py-2.5 rounded-xl outline outline-1 outline-offset-[-1px] outline-button-stroke
                               bg-background-main text-text-primary font-sans text-sm
                               focus:outline-2 focus:outline-primary-main"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm((v) => !v)}
                    aria-label={
                      showPasswordConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {showPasswordConfirm ? (
                      <EyeOff className="size-4" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <Eye className="size-4" strokeWidth={2} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm font-sans text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_staff}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_staff: e.target.checked }))
                    }
                    className="size-4 accent-primary-main"
                  />
                  Administrador (staff)
                </label>
                <label className="flex items-center gap-2 text-sm font-sans text-text-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                    className="size-4 accent-primary-main"
                  />
                  Activo
                </label>
              </div>

              {formError && (
                <p className="text-sm font-sans text-secondary-main">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setEditing(null);
                  resetForm();
                }}
                disabled={submitting}
                className="px-4 py-2 rounded-md font-sans font-bold text-sm
                           bg-background-main outline outline-1 outline-offset-[-1px] outline-button-stroke text-text-primary
                           hover:bg-primary-states-hover-main transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={editing ? handleSubmitEdit : handleSubmitCreate}
                disabled={submitting}
                className="px-4 py-2 rounded-md font-sans font-bold text-sm
                           bg-primary-main text-text-invert-primary hover:bg-primary-light transition-colors
                           disabled:opacity-60"
              >
                {submitting
                  ? 'Guardando…'
                  : editing
                    ? 'Guardar cambios'
                    : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar eliminación ───────────────────────────────────── */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Eliminar usuario"
        message="¿Seguro que deseas eliminar este usuario? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}