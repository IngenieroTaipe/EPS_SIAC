import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext.hooks';

/**
 * LoginPage — formulario de inicio de sesión.
 *
 * Layout según Figma:
 *   [Form (left) | Image placeholder (right)]
 *
 * Esta página no usa `GuestLayout` (no muestra TopBar) porque el login no
 * necesita encabezado: el propio título "Inicio de Sesión" actúa como
 * encabezado visual. Si el usuario ya está autenticado y entra a `/login`
 * manualmente, se redirige a `/alertas`.
 *
 * Derecha: <div> vacío con fondo placeholder donde el usuario colocará
 * una imagen (hero del login) cuando la elija.
 *
 * Tras autenticar correctamente, redirige a `/alertas` (Mapa de Alertas
 * Climáticas), según los requisitos del usuario.
 */

const PRIMARY = 'bg-primary-main outline outline-2 outline-offset-[-2px] outline-primary-main';
const INPUT_BASE =
  'h-12 px-4 py-3 bg-slate-100 border-b border-neutral-300 inline-flex justify-start items-center gap-2 w-full text-zinc-500';
const LABEL = 'text-zinc-800 text-sm font-normal font-sans leading-5';

export function LoginPage() {
  const { isAuthenticated, login, isLoggingIn, loginError } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Si ya está autenticado, redirige a /alertas (no tiene caso ver el login).
  if (isAuthenticated) return <Navigate to="/alertas" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await login(username, password);
      navigate('/alertas', { replace: true });
    } catch {
      // El error ya queda en `loginError` del contexto; lo mostramos abajo.
    }
  }

  return (
    <div className="h-screen bg-background-main flex">
      {/* ── Lado izquierdo: formulario ─────────────────────────────────── */}
      <div className="flex-1 p-12 sm:p-20 inline-flex flex-col justify-center items-start gap-12">
        <div className="self-stretch flex flex-col justify-center items-center gap-2">
          <h2 className="self-stretch text-zinc-800 text-4xl font-bold font-sans leading-10">
            Inicio de Sesión
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="self-stretch flex flex-col justify-center items-start gap-4"
        >
          {/* Usuario */}
          <label className="self-stretch flex flex-col gap-2">
            <span className={LABEL}>Usuario</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuario"
              className={INPUT_BASE + ' font-sans text-base leading-6 text-zinc-500 placeholder:text-zinc-500 focus:outline-none focus:border-primary-main'}
            />
          </label>

          {/* Contraseña */}
          <label className="self-stretch flex flex-col gap-2">
            <span className={LABEL}>Contraseña</span>
            <div className={`${INPUT_BASE} relative`}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="flex-1 bg-transparent font-sans text-base leading-6 text-zinc-500 placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="text-zinc-500 hover:text-zinc-800 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="size-6" strokeWidth={2} />
                ) : (
                  <Eye className="size-6" strokeWidth={2} />
                )}
              </button>
            </div>
          </label>

          {/* Botón Ingresar */}
          <button
            type="submit"
            disabled={isLoggingIn}
            className={`self-stretch h-12 px-3 text-white text-base font-medium font-sans leading-4 tracking-wide ${PRIMARY}
            hover:bg-primary-light hover:outline-primary-light transition-colors
            focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-main focus-visible:ring-offset-2
            disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {isLoggingIn ? 'Ingresando…' : 'Ingresar'}
          </button>

          {loginError && (
            <p className="self-stretch text-red-600 text-sm font-sans">
              {loginError}
            </p>
          )}
        </form>

        <div className="self-stretch h-0 outline outline-1 outline-offset-[-0.5px] outline-zinc-200" />
      </div>

      {/* ── Lado derecho: imagen del login (placeholder vacío) ────────────────
          Sustituir el contenido por <img src="..." /> cuando el usuario
          decida qué imagen va aquí. */}
      <div className="flex-1 self-stretch bg-slate-100 hidden lg:block" aria-label="Imagen del login (pendiente)" />
    </div>
  );
}