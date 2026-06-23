/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react"

export const UnidadOperativaContext = createContext()

export function UnidadOperativaProvider({ children }) {
  const [unidadActiva, setUnidadActiva] = useState("Pichanaki")

  return (
    <UnidadOperativaContext.Provider value={{ unidadActiva, setUnidadActiva }}>
      {children}
    </UnidadOperativaContext.Provider>
  )
}

export function useUnidadOperativa() {
  return useContext(UnidadOperativaContext)
}