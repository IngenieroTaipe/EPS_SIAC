import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function ChangePassword() {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const { changePassword } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!newPassword || !confirmPassword) {
      setError("Por favor complete todos los campos.")
      return
    }

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    const success = changePassword(newPassword)
    if (success) {
      navigate("/alertas")
    } else {
      setError("Error al cambiar la contraseña.")
    }
  }

  return (
    <div className="flex h-screen w-screen bg-slate-50 justify-center items-center font-sans select-none p-4">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg max-w-md w-full">
        <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight mb-2">
          Cambio Obligatorio
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Por medidas de seguridad de <strong className="text-slate-700 font-bold">EPS Selva Central</strong>, debes cambiar tu contraseña predeterminada en tu primer inicio de sesión.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-100 rounded-lg text-sm font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Nueva Contraseña
            </label>
            <input
              type="password"
              placeholder="Min. 8 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Confirmar Contraseña
            </label>
            <input
              type="password"
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white transition-all duration-200"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-bold shadow hover:bg-blue-700 hover:shadow-md transition duration-200 active:scale-[0.99] mt-2"
          >
            Guardar y Continuar
          </button>
        </form>
      </div>
    </div>
  )
}
