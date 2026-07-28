
## Instrucciones de Ejecución
1. Prendemos los servicios de la Base de Datos (Todo lo necesario para el funcionamiento del backend ya se encuentra registrado por el docker-compose.yml y docker-compose.dev.yml, así como el dockerfile: Migraciones, seeders, etc.)

```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Documentación del backend
Para acceder a la documentación del backend debemos dirigirnos a los siguientes endpoints:
    
- Documentación vista **Redoc**: `http://localhost:8000/redoc/`
- Documentación vista **Swagger UI**: `http://localhost:8000/docs/`
- Documentación **JSON**:`http://localhost:8000/schema/`

## Credenciales
`"Credenciales de Acceso"`:
<table>
    <thead>
        <tr>
            <th>Cargo</th>
            <th>Email</th>
            <th>Password</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>admin</td>
            <td>admin@eps-siac.gob.pe</td>
            <td>AdminPassword123!</td>
        </tr>
        <tr>
            <td>operador</td>
            <td>operador.chanchamayo@eps-siac.gob.pe</td>
            <td>OperatorPassword123!</td>
        </tr>
    </tbody>
</table>


# **PENDIENTES**

Realizar las nuevas relaciones de la tabla alertas con los clústers y después con los componentes.

Actualizar la relación de los componentes con las branches

Desarrollar el endpoint para recuperar el último archivo geojson (el más actualizado)

Evaluar si el geojson está bien estructurado a nivel de horas (parece que en un punto pasa de la hora 12 del dia de hoy a la hora 0 del dia de ayer, a pesar de que se le envie la data en el orden correcto)

Verificar si es más sencillo utilizar la tabla AlertsStatusesPhases o por separado las tablas Statuses y Phases.

Verificar si los polígonos dentro del geojson pueden ser suavizados, porque actualmente son muy cuadráticos.

establecer de qué manera se generarán los clúster de las 6 horas (si se crearán todo cuando el nuevo archivo geojson sea creado o por medio de un job a cada hora).

Desarrollar el motor de notificaciones mediante botfather de telegram.

Establecer la manera de asociar al clúster su nivel de threshold.