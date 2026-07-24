
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
            <td>Admin</td>
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