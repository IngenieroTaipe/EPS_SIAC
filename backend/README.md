## Instrucciones de Instalación
1. **Habilitar el entorno virtual:**

```bash
    python -m venv .venv
```

2. **Acceder al entorno virtual:**

- **Windows**
```bash
   .venv\Scripts\activate
```

- **Linux / MacOS**

```bash
   source .venv/bin/activate
```

3. **Descargar dependencias**

```python
    pip install -r requirements.txt
```

## Instrucciones de Ejecución
1. Prendemos los servicios de la Base de Datos

```bash
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

2. Ejecutamos las migraciones

```bash
    python manage.py makemigrations
    python manage.py migrate
```

3. Agregamos al superadmin para poder trabajar

```bash
    python manage.py createsuperuser
```

Después de aquí debemos ingresar el username, correo y la contraseña (en caso de que se mencione que la contraseña es demasiado débil, solo poner `Y` **para confirmar**)

4. Ejecutar el proyecto
```bash
    python manage.py runserver
```

## Documentación del backend
Para acceder a la documentación del backend debemos dirigirnos a los siguientes endpoints:
    
- Documentación vista **Redoc**: `http://localhost:8000/redoc/`
- Documentación vista **Swagger UI**: `http://localhost:8000/docs/`
- Documentación **JSON**:`http://localhost:8000/schema/`

## Copias de archivos de configuración
