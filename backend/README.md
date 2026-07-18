## Instrucciones de Instalación
1. **Habilitar el entorno virtual:**

```bash
    python -m venv .venv
```

2. **Acceder al entorno virtual:**

- **Windows**
```bash
   venv\Scripts\activate
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
1. Ejecutamos las migraciones

```bash
    python manage.py makemigrations tienda
    python manage.py migrate
```

2. Ejecutar el proyecto
```bash
    python manage.py runserver
```