/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react"

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("auth_user")
    return savedUser ? JSON.parse(savedUser) : null
  })

  const [mustChangePassword, setMustChangePassword] = useState(() => {
    const savedUser = localStorage.getItem("auth_user")
    if (!savedUser) return false
    const username = JSON.parse(savedUser).username
    const changed = localStorage.getItem(`password_changed_${username}`)
    return changed !== "true"
  })

  const login = (username, password) => {
    // Usamos las variables para evitar el error de no-unused-vars
    if (!username || !password) return false

    const userData = { username }
    setUser(userData)
    localStorage.setItem("auth_user", JSON.stringify(userData))
    
    const changed = localStorage.getItem(`password_changed_${username}`)
    setMustChangePassword(changed !== "true")
    return true
  }

  const changePassword = (newPassword) => {
    if (!user || !newPassword) return false
    localStorage.setItem(`password_changed_${user.username}`, "true")
    setMustChangePassword(false)
    return true
  }

  const logout = () => {
    setUser(null)
    setMustChangePassword(false)
    localStorage.removeItem("auth_user")
  }

  return (
    <AuthContext.Provider value={{ user, mustChangePassword, login, changePassword, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
