import { useState, useEffect } from "react"
import { Marker, Popup, GeoJSON } from "react-leaflet"
import L from "leaflet"
import MainLayout from "../components/layout/MainLayout"
import BaseMap from "../components/map/BaseMap"
import alertsData from "../data/mockAlerts.json"
import pichanakiGeoJson from "../data/pichanakiBoundary.json"

// --- CONSTANTES DE CONFIGURACIÓN (Fuera del componente) ---
const UMBLAR_CONFIG = {
  "Moderadamente lluvioso": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "Lluvioso": "bg-orange-100 text-orange-800 border-orange-200",
  "Muy lluvioso": "bg-red-100 text-red-800 border-red-200"
};

const ESTADO_CONFIG = {
  "PREDICHO": "bg-yellow-200 text-black border-yellow-300",
  "EN ESPERA DE CONFIRMACIÓN": "bg-orange-200 text-black border-orange-300",
  "NO CONFIRMADO": "bg-red-600 text-white border-red-700",
  "CONFIRMADO": "bg-blue-500 text-white border-blue-600",
  "EN ESPERA DE REPORTE": "bg-purple-600 text-white border-purple-700",
  "EN PROCESO DE ATENCION": "bg-orange-500 text-white border-orange-600",
  "ATENDIDO": "bg-green-500 text-white border-green-600"
};

// --- ICONOS ---
const redMarkerIcon = L.divIcon({
  className: "bg-transparent border-transparent",
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" style="transform: translate(-50%, -100%);" class="w-8 h-8 drop-shadow-md"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>`,
  iconSize: [32, 32],
  iconAnchor: [0, 0]
});

const transparentIcon = L.divIcon({
  className: "bg-transparent border-transparent",
  html: `<div style="transform: translate(-50%, -50%);" class="font-extrabold text-slate-800/20 tracking-widest text-2xl uppercase select-none">Pichanaki</div>`,
  iconSize: [120, 40],
  iconAnchor: [0, 0]
});

// --- FUNCIONES AUXILIARES ---
const getUmbralBadge = (umbral) => {
  const classes = UMBLAR_CONFIG[umbral] || "bg-slate-100 text-slate-800 border-slate-200";
  return (
    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border whitespace-nowrap ${classes}`}>
      {umbral}
    </span>
  );
};

const getEstadoBadge = (estado) => {
  const key = estado ? estado.toUpperCase() : "";
  const classes = ESTADO_CONFIG[key] || "bg-slate-100 text-slate-800 border-slate-200";
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${classes}`}>
      {estado}
    </span>
  );
};

export default function MapaAlertas() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchVal, setSearchVal] = useState("")

  // Puntos geográficos aproximados de las alertas en Pichanaki para mostrarlas sobre el mapa
  const alertPoints = [
    { lat: -10.88, lng: -74.85, code: "PK-0001" },
    { lat: -10.95, lng: -74.82, code: "PK-0003" },
    { lat: -10.85, lng: -74.80, code: "PK-0004" },
    { lat: -10.98, lng: -74.87, code: "PK-0006" }
  ]

  useEffect(() => {
    // Simular carga de base de datos
    setTimeout(() => {
      setAlerts(alertsData)
      setLoading(false)
    }, 400)
  }, [])

  return (
    <MainLayout>
      <div className="p-6 flex flex-col gap-6 relative select-none">
        
        {/* Contenedor Sticky para el Header y el Mapa */}
        <div className="bg-slate-50 -mx-6 px-6 pb-4 pt-1 flex flex-col gap-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Mapa de Alertas</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                <span className="font-semibold text-slate-700">Muestra:</span> Alertas notificadas en sus ubicaciones geográficas
              </p>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Unidad Operativa"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64 transition-all duration-200"
                />
                <span className="absolute left-3 top-2.5 text-slate-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.637 10.637Z" />
                  </svg>
                </span>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg bg-white shadow-sm text-sm font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-[0.98]">
                <span>Filtrar</span>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mapa Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden h-[340px] min-h-[340px]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-[1000]">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <BaseMap center={[-10.92, -74.87]} zoom={12}>
                <GeoJSON
                data={pichanakiGeoJson}
                pathOptions={{
                  fillColor: "#8FB7EB", // Color neutro de fondo para ver los cuadrantes encima
                  fillOpacity: 0.15,
                  color: "#0056C7",
                  weight: 3,
                  dashArray: "2"
                }}
              />

              {/* Título flotante "PICHANAQUI" en el fondo */}
              <Marker position={[-10.90, -74.87]} icon={transparentIcon} interactive={false} />
              
                {/* Marcadores de alerta en el mapa */}
                {alertPoints.map((point, index) => {
                  const associatedAlert = alerts.find(a => a.codigo === point.code)
                  return (
                    <Marker key={index} position={[point.lat, point.lng]} icon={redMarkerIcon}>
                      <Popup>
                        <div className="text-xs">
                          <span className="font-extrabold text-sm text-slate-800 block mb-1">{point.code}</span>
                          <span><strong>Fenómeno:</strong> {associatedAlert?.fenomeno || "Lluvia"}</span><br/>
                          <span><strong>Intensidad:</strong> {associatedAlert?.umbral || "Moderado"}</span>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </BaseMap>
            )}
          </div>
        </div>

        {/* Tabla Container (Se desplaza por debajo del mapa) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mt-2 z-10">
          {/* Tabla Title */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h3 className="font-bold text-slate-800 text-lg">Información de las alertas</h3>
              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-indigo-100">
                {alerts.length} alertas
              </span>
            </div>
            
            {/* Opciones extra */}
            <button className="text-slate-400 hover:text-slate-600 transition">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
              </svg>
            </button>
          </div>

          {/* Tabla Body */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-3.5">Código</th>
                  <th className="px-6 py-3.5">Fenómeno Climático</th>
                  <th className="px-6 py-3.5">Fecha y Hora (Predicción)</th>
                  <th className="px-6 py-3.5">Unidad Operativa</th>
                  <th className="px-6 py-3.5">Umbral</th>
                  <th className="px-6 py-3.5">Estado / Fase</th>
                  <th className="px-6 py-3.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                {alerts.map((row) => (
                  <tr key={row.codigo} className="hover:bg-slate-50/50 transition duration-150">
                    
                    <td className="px-6 py-3.5 font-semibold text-slate-700">{row.codigo}</td>
                    <td className="px-6 py-3.5">{row.fenomeno}</td>
                    <td className="px-6 py-3.5 font-mono text-slate-500 text-xs">{row.fecha}</td>
                    <td className="px-6 py-3.5">{row.unidad}</td>
                    <td className="px-6 py-3.5">{getUmbralBadge(row.umbral)}</td>
                    <td className="px-6 py-3.5">{getEstadoBadge(row.estado)}</td>
  
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-center gap-3">
                        <button className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Ver detalle">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Editar alerta">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tabla Footer (Paginación) */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-sm text-slate-500">
            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg bg-white shadow-sm font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-[0.98]">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              <span>Previous</span>
            </button>

            <div className="flex items-center gap-1">
              <span className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 font-bold text-indigo-700">1</span>
              <button className="px-3 py-1.5 rounded-lg hover:bg-slate-100 transition">2</button>
              <span className="px-2 text-slate-400">..</span>
              <button className="px-3 py-1.5 rounded-lg hover:bg-slate-100 transition">4</button>
              <button className="px-3 py-1.5 rounded-lg hover:bg-slate-100 transition">5</button>
            </div>

            <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg bg-white shadow-sm font-semibold text-slate-700 hover:bg-slate-50 transition active:scale-[0.98]">
              <span>Next</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>

        </div>

      </div>
    </MainLayout>
  )
}