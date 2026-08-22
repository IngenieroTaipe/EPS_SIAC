# **BACKEND**
## **Componentes**
1. En las coordenadas ya no incluye geojson o la criticidad

- `components/components/?page=1`
```json
        {
            "id": 1,
            "code": "0001",
            "name": "TORO",
            "type": "FUENTE",
            "district": "CHANCHAMAYO",
            "coords": [
                {
                    "utm_coords": {
                        "easting": 463417.378,
                        "northing": 8771284.297,
                        "srid": 32718,
                        "zone": "18S"
                    }
                },
                {
                    "utm_coords": {
                        "easting": 466687.012,
                        "northing": 8777590.461,
                        "srid": 32718,
                        "zone": "18S"
                    }
                }
            ],
            "specification": "Fuente superficial permanente. ANTES(CFAL_NOM=RIO TORO)",
            "operational_status": {
                "code": "001",
                "name": "OPERATIVO"
            },
            "physical_status": {
                "code": "B",
                "name": "BUENO"
            }
        }```

2. Se agrega el endpoint que incluye en las coordenadas la criticidad y el geojson, pero no los utm

- `components/components/map`
```json
    {
        "id": 1,
        "code": "0001",
        "name": "TORO",
        "type": "FUENTE",
        "coords": [
            {
                "id": 149,
                "geojson": {
                    "type": "Point",
                    "coordinates": [
                        -75.335,
                        -11.115
                    ]
                },
                "criticality": "ALTA"
            },
            {
                "id": 159,
                "geojson": {
                    "type": "Point",
                    "coordinates": [
                        -75.305,
                        -11.058
                    ]
                },
                "criticality": "MEDIA"
            }
        ],
        "district": "CHANCHAMAYO",
        "operational_status": {
            "code": "001",
            "name": "OPERATIVO"
        }
    },```
    
3. Y el último caso donde se presenta la información de cada componente individualmente presenta la siguiente info:

- `components/components/1/`

```json
{
    "id": 1,
    "code": "0001",
    "name": "TORO",
    "type": {
        "id": 1,
        "name": "FUENTE"
    },
    "district": {
        "ubigeo": "120301",
        "name": "CHANCHAMAYO"
    },
    "specification": "Fuente superficial permanente. ANTES(CFAL_NOM=RIO TORO)",
    "operational_status": {
        "code": "001",
        "name": "OPERATIVO"
    },
    "physical_status": {
        "code": "B",
        "name": "BUENO"
    },
    "coords": [
        {
            "id": 149,
            "criticality": {
                "id": 1,
                "name": "ALTA"
            },
            "utm_coords": {
                "easting": 463417.378,
                "northing": 8771284.297,
                "srid": 32718,
                "zone": "18S"
            },
            "geojson": {
                "type": "Point",
                "coordinates": [
                    -75.335,
                    -11.115
                ]
            }
        },
        {
            "id": 159,
            "criticality": {
                "id": 2,
                "name": "MEDIA"
            },
            "utm_coords": {
                "easting": 466687.012,
                "northing": 8777590.461,
                "srid": 32718,
                "zone": "18S"
            },
            "geojson": {
                "type": "Point",
                "coordinates": [
                    -75.305,
                    -11.058
                ]
            }
        }
    ]
}
```

## **Alertas**
1. La lista de alertas ahora no incluye los clúster ni el historial:

- `alerts/alerts/?on_page=1`
```json
        {
            "id": 1,
            "code": "000000001",
            "natural_phenomena_name": "LLUVIAS INTENSAS",
            "max_intensity_mm_h": "8.00",
            "max_threshold": "MUY LLUVIOSO (Nivel 3)",
            "start_time_local": "2026-08-22T10:00:00-05:00",
            "end_time_local": "2026-08-22T23:00:00-05:00"
        }
```

2. Al endpoint de alertas individuales se le quita la opción de tener los cluster y los component clusteres debido a su no-utilización, pero se agrega la propiedad alert_notification con el historial de las notificaciones (su re-programación u cancelación); a su vez, se cambia el nombre de historic_alert por alert_history.

- `alerts/alerts/1`
```json
{
{
    "count": 1,
    "next": null,
    "previous": null,
    "results": [
        {
            "id": 1,
            "code": "000000001",
            "natural_phenomena_name": "LLUVIAS INTENSAS",
            "max_intensity_mm_h": "8.00",
            "max_threshold": "MUY LLUVIOSO (Nivel 3)",
            "start_time_local": "2026-08-22T10:00:00-05:00",
            "end_time_local": "2026-08-22T23:00:00-05:00",
            "status_name": "NO CONFIRMADO",
            "phase_name": "Sin Fase",
            "operational_ubigeos": [
                {
                    "ubigeo": "120301",
                    "name": "CHANCHAMAYO"
                },
                {
                    "ubigeo": "120601",
                    "name": "SATIPO"
                },
                {
                    "ubigeo": "190307",
                    "name": "VILLA RICA"
                },
                {
                    "ubigeo": "120303",
                    "name": "PICHANAQUI"
                },
                {
                    "ubigeo": "120101",
                    "name": "HUANCAYO"
                },
                {
                    "ubigeo": "190301",
                    "name": "OXAPAMPA"
                }
            ]
        }
    ]
}
}
```

3. Para el mapa se recomienda utilizar el siguiente endpoint debido a que la información se relaciona con ello:

- `alerts/alerts/map`
```json
        {
            "id": 1,
            "code": "000000001",
            "natural_phenomena_name": "LLUVIAS INTENSAS",
            "max_intensity_mm_h": "8.00",
            "max_threshold": "MUY LLUVIOSO (Nivel 3)",
            "status_name": "CONFIRMADO",
            "phase_name": "SIN FASE",
            "start_time_local": "2026-08-22T10:00:00-05:00",
            "end_time_local": "2026-08-22T23:00:00-05:00"
        }
```

4.  Dentro del endpoint del tabular se agregaron los filtros por fenómeno natural, estado y fase:
- `alerts/alerts/`

Para aplicar el filtro de fenómeno natural se debe enviar el id:
- `alerts/alerts/?phenomena=1`

Para aplicar el filtro de estado se debe enviar el id:
- `alerts/alerts/?status=1`

Para aplicar el filtro de fase se debe enviar el id:

- `alerts/alerts/?phase=1`
```json
{
    "id": 1,
    "code": "000000001",
    "natural_phenomena_name": "LLUVIAS INTENSAS",
    "max_intensity_mm_h": "8.00",
    "max_threshold": "MUY LLUVIOSO (Nivel 3)",
    "start_time_local": "2026-08-22T10:00:00-05:00",
    "end_time_local": "2026-08-22T23:00:00-05:00"
}
```