import { useState, useEffect } from "react"
import { CircleMarker, Popup, GeoJSON, Marker, Polygon } from "react-leaflet"
import L from "leaflet"
import MainLayout from "../components/layout/MainLayout"
import BaseMap from "../components/map/BaseMap"
import HeatLayer from "../components/map/HeatLayer"
import * as turf from "@turf/turf"

// Cargar el GeoJSON de límites de Pichanaki de manera estática
import pichanakiGeoJson from "../data/pichanakiBoundary.json"

// Crear un icono transparente para el marcador de texto del título del distrito

const transparentIcon = L.divIcon({
  className: "bg-transparent border-transparent",
  html: `<div style="transform: translate(-50%, -50%);" class="font-extrabold text-slate-800/20 tracking-widest text-2xl uppercase select-none pointer-events-none">Pichanaki</div>`,
  iconSize: [120, 40],
  iconAnchor: [0, 0]

})



function getColor(value) {

  if (value > 15) return { bg: "bg-red-500", label: "Extremadamente lluvioso", color: "#ef4444" }

  if (value > 5) return { bg: "bg-orange-400", label: "Muy lluvioso", color: "#fb923c" }

  if (value >= 1) return { bg: "bg-yellow-300", label: "Lluvia leve", color: "#fde047" }

  return { bg: "bg-blue-200", label: "Sin lluvia", color: "#bfdbfe" }

}



export default function MapaClimatico() {

  const [heatData, setHeatData] = useState([])

  const [quadrants, setQuadrants] = useState([])

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState(null)

  const [searchVal, setSearchVal] = useState("")



 useEffect(() => {
    const fetchClimaData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Cargar datos
        const responseClima = await import("../data/mockClima.json");
        const geojsonData = responseClima.default;

        // 2. Preparar el polígono de Pichanaki (asegurar que es un Feature válido)
        const pichanakiFeature = pichanakiGeoJson.features[0];
        
        // 3. Generar la grilla dinámica
        const grid = turf.squareGrid(turf.bbox(pichanakiFeature), 10, { units: 'kilometers' });

        // 4. Procesar cuadrantes
        const parsedQuadrants = grid.features
          .filter(cell => turf.booleanIntersects(cell, pichanakiFeature))
          .map((cell, index) => {
            const intersection = turf.intersect(turf.featureCollection([cell, pichanakiFeature]));
            if (!intersection) return null;

            const centerPoint = turf.centerOfMass(intersection);
            
            // Lógica IDW
            let totalWeight = 0;
            let weightedValue = 0;
            geojsonData.features
              .filter(f => f.geometry.type === "Point")
              .forEach(p => {
                const point = turf.point(p.geometry.coordinates);
                const dist = turf.distance(centerPoint, point, { units: 'kilometers' });
                const weight = 1 / (Math.max(dist, 0.1) ** 2);
                weightedValue += (p.properties.value * weight);
                totalWeight += weight;
              });

            const finalValue = weightedValue / totalWeight;

            // Extraer coords correctamente
            const coords = intersection.geometry.coordinates[0];

            return {
              id: `C${index + 1}`, // ID autogenerado
              value: finalValue,
              center: [centerPoint.geometry.coordinates[1], centerPoint.geometry.coordinates[0]],
              polygonCoords: coords.map(([lng, lat]) => [lat, lng])
            };
          })
          .filter(q => q !== null);

        setHeatData(geojsonData.features
          .filter(f => f.geometry.type === "Point")
          .map(f => ({
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0],
            value: f.properties.value || 0,
            label: f.properties.label || "Sin descripción"
          }))
        );

        setQuadrants(parsedQuadrants);

      } catch (err) {
        console.error(err);
        setError("Error al procesar los datos climáticos.");
      } finally {
        setLoading(false);
      }
    };

    fetchClimaData();
  }, []);// <-- Solo un useEffect aquí



  // ... resto de tu renderizado (return) sin cambios



  return (

    <MainLayout>

      <div className="p-6 flex flex-col gap-6 h-full select-none">

        {/* Header */}

        <div className="flex items-center justify-between">

          <div>

            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Sistema de Alertas Climáticas</h2>

            <p className="text-sm text-slate-500 mt-0.5">

              <span className="font-semibold text-slate-700">Muestra:</span> Mapa de calor y posibles fenómenos climáticos futuros

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

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden flex-1 min-h-[460px]">

          {loading ? (

            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-[1000]">

              <div className="flex flex-col items-center gap-2">

                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>

                <span className="text-sm text-gray-500">Cargando mapa climático...</span>

              </div>

            </div>

          ) : error ? (

            <div className="absolute inset-0 flex items-center justify-center bg-white z-[1000] p-4">

              <span className="text-red-500 font-medium">{error}</span>

            </div>

          ) : (

            <BaseMap center={[-10.90, -74.87]} zoom={11}>

              {/* Capa de Limite de Pichanaki (Polígono verde base) */}

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



              {/* Capa de Cuadrantes (Pintados según el umbral) */}

              {quadrants.map((quad) => {

                const colorInfo = getColor(quad.value)

                return (

                  <Polygon

                    key={quad.id}

                    positions={quad.polygonCoords}

                    pathOptions={{

                      fillColor: colorInfo.color,

                      fillOpacity: 0.45,

                      color: "#334155", // Borde del cuadrante (slate-700)

                      weight: 1.5,

                      dashArray: "3",

                    }}

                  >

                    <Popup>

                      <div className="text-xs">

                        <strong className="text-sm block">Cuadrante {quad.id}</strong>

                        <span>Intensidad Lluvia: {quad.value} mm/h</span><br/>

                        <span>Umbral: <strong className="font-bold">{colorInfo.label}</strong></span>

                      </div>

                    </Popup>

                  </Polygon>

                )

              })}



              {/* Marcador de texto con el ID del cuadrante en su centroide */}

              



              {/* Capa de calor (L.heatLayer) */}

              <HeatLayer points={heatData} />



              {/* Puntos de calor (círculos interactivos de lluvia) */}

              {heatData.map((point, index) => {

                const colorInfo = getColor(point.value)

                return (

                  <CircleMarker

                    key={index}

                    center={[point.lat, point.lng]}

                    pathOptions={{

                      color: colorInfo.color,

                      fillColor: colorInfo.color,

                      fillOpacity: 0.8,

                      weight: 1,

                    }}

                    radius={5}

                  >

                    <Popup>
        <div className="text-xs">
          {/* Aquí point.label funcionará perfectamente */}
          <strong className="text-sm block">{point.label}</strong> 
          <span>Intensidad: {point.value} mm/h</span>
        </div>
      </Popup>

                  </CircleMarker>

                )

              })}

            </BaseMap>

          )}

        </div>



        {/* Leyenda */}

        <div className="flex gap-6 flex-wrap bg-white p-4 rounded-xl border border-slate-100 shadow-sm">

          {[

            { color: "bg-yellow-300", label: "Moderadamente lluvioso (1-5 mm/h)" },

            { color: "bg-orange-400", label: "Lluvioso (6-15 mm/h)" },

            { color: "bg-red-500", label: "Muy lluvioso (>15 mm/h)" },

          ].map((item) => (

            <div key={item.label} className="flex items-center gap-2.5 text-sm font-semibold text-slate-600">

              <div className={`w-4 h-4 rounded-full ${item.color} shadow-inner border border-slate-200`} />

              {item.label}

            </div>

          ))}

        </div>

      </div>

    </MainLayout>

  )

}