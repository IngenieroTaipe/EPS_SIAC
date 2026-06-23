import { useEffect } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"

export default function HeatLayer({ points }) {
  const map = useMap()

  useEffect(() => {
    // Asegurar que Leaflet esté disponible globalmente para el plugin clásico
    window.L = L

    let heatLayerInstance = null

    // Cargar dinámicamente el plugin para evitar problemas de hoisting de importaciones
    import("leaflet.heat")
      .then(() => {
        if (!map) return

        const heatPoints = points.map((p) => [p.lat, p.lng, p.value / 25])

        // Aseguramos que L.heatLayer se haya registrado correctamente
        if (typeof L.heatLayer === "function") {
          heatLayerInstance = L.heatLayer(heatPoints, {
            radius: 40,
            blur: 30,
            maxZoom: 14,
            gradient: {
              0.0: "#bfdbfe",
              0.2: "#fde047",
              0.5: "#fb923c",
              1.0: "#ef4444",
            },
          })
          heatLayerInstance.addTo(map)
        } else {
          console.error("L.heatLayer no está definido después de cargar el plugin.")
        }
      })
      .catch((err) => {
        console.error("Error al cargar el plugin leaflet.heat:", err)
      })

    return () => {
      if (heatLayerInstance && map) {
        map.removeLayer(heatLayerInstance)
      }
    }
  }, [map, points])

  return null
}