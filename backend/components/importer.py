"""
Importer helpers para carga masiva de componentes desde CSV y GeoJSON.

Patrón:
  - `parse_csv(file_bytes)` y `parse_geojson(file_bytes)` leen el archivo y
    lo convierten en una lista de `ParsedComponent` dicts con TODOS los FK
    resueltos a IDs (district, type, operational_status, physical_status,
    criticality). Las coords vienen como lista de dicts:
        { 'easting': ..., 'northing': ..., 'srid_origin': int, 'criticality': int }
    o bien:
        { 'longitude': ..., 'latitude': ..., 'criticality': int }
    según venga en el archivo.

  - `ImportError` agrupa todos los errores de una fila/feature con su
    contexto (fila, código, mensaje). El caller decide cómo persistir.

  - Las FKs se resuelven por nombre (mayúsculas) o ubigeo, NUNCA por id.
    El usuario no conoce IDs; el archivo trae nombres legibles.

  - Para CSV de líneas (varios vértices por componente): el usuario
    repite filas con MISMO `code` y distinto `easting`/`northing`. El
    parser agrupa filas por `code` y produce un solo `ParsedComponent`
    con N coord entries. El `type` debe ser un tipo línea
    (`linea-conduccion`/`linea-aduccion`); si no, se reporta error.

Restricciones:
  - Encoding esperado: UTF-8 (acepta BOM vía utf-8-sig).
  - Si una fila/feature viola unique (district+type+code ya existe),
    se reporta error. El caller aborta la transacción completa y NO
    persiste NADA (rollback), reportando al usuario dónde está el
    conflicto. Es el patrón "abort-all-on-duplicate" elegido.
"""

from __future__ import annotations

import csv
import io
import json
from dataclasses import dataclass, field
from typing import Any

from django.contrib.gis.geos import Point
from rest_framework.exceptions import ErrorDetail, ValidationError

from components.models import (
    Component,
    ComponentType,
    Criticality,
)
from places.models import District
from core_shared.helpers import SpatialHelper

__all__ = [
    "ImportError",
    "ParsedComponent",
    "parse_csv",
    "parse_geojson",
    "persist_components",
]


# ── Tipos_linea definidos en el frontend como TipoComponente; en backend
# se mapean via el NAME del ComponentType. Aceptamos mayúsculas Según el
# esquema de `seed_*` puesto por el backend (`ComponentType.name`):
LINEA_TYPE_NAMES = {
    "LÍNEA DE CONDUCCIÓN",
    "LINEA DE CONDUCCION",
    "LÍNEA DE ADUCCIÓN",
    "LINEA DE ADUCCION",
}


@dataclass
class ImportError:
    """Error de una fila/feature con contexto para reportar al usuario."""
    row: int | None  # 1-based para CSV; idx para GeoJSON
    code: str | None
    message: str


@dataclass
class ParsedComponent:
    """Componente parseado listo para persistir (FKs resueltas a IDs)."""
    code: str
    name: str
    type_id: int
    district_ubigeo: str
    operational_status_code: str | None
    physical_status_code: str | None
    specification: str | None
    coords: list[dict[str, Any]] = field(default_factory=list)


def _resolve_fk(model, label: str, **lookup) -> int | str | None:
    """Busca un registro por `lookup` y retorna su PK; None si no existe."""
    try:
        return model.objects.get(**lookup).pk
    except model.DoesNotExist:
        return None


def _resolve_type(name: str) -> int:
    """Resuelve nombre del tipo → ID. Lanza ValueError si no existe."""
    n = name.strip().upper()
    qs = ComponentType.objects.filter(name__iexact=name)
    if not qs.exists():
        raise ValueError(f"Tipo de componente '{name}' no encontrado.")
    return qs.first().pk


def _resolve_criticality(name: str) -> int:
    """Resuelve nombre de criticidad → ID."""
    qs = Criticality.objects.filter(name__iexact=name)
    if not qs.exists():
        raise ValueError(f"Criticidad '{name}' no encontrada.")
    return qs.first().pk


def _resolve_district(ubigeo: str) -> str:
    """Resuelve ubigeo → ubigeo (sólo valida que el distrito exista)."""
    if not District.objects.filter(ubigeo=ubigeo).exists():
        raise ValueError(f"Distrito con ubigeo '{ubigeo}' no encontrado.")
    return ubigeo


def _parse_float(value: str, field_name: str, row: int | None) -> float:
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        raise ValueError(
            f"Fila {row}: campo '{field_name}'='{value}' no es numérico."
        )


# ──────────────────────────────────────────────────────────────────────
# CSV
# ──────────────────────────────────────────────────────────────────────

CSV_REQUIRED_HEADERS = [
    "code",
    "name",
    "type",
    "district_ubigeo",
    "criticality",
    "easting",
    "northing",
]
CSV_OPTIONAL_HEADERS = [
    "operational_status",
    "physical_status",
    "specification",
]


def parse_csv(
    file_bytes: bytes,
) -> tuple[list[ParsedComponent], list[ImportError]]:
    """
    Parsea un archivo CSV y retorna (componentes, errores).

    Filas con mismo `code` se agrupan en un solo componente; el `type`
    asociado determina si es válido tener múltiples vértices (debe ser
    línea de conducción/aducción).

    Cualquier error (header faltante, FK inexistente, coords no
    numéricas, tipo no-línea con múltiples filas) se reporta en
    `errores` y esa fila/feature se omite del resultado.
    """
    text = file_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text), delimiter=",", skipinitialspace=True)

    # Validar headers
    if reader.fieldnames is None:
        return [], [ImportError(row=1, code=None, message="CSV vacío.")]
    headers_lower = {h.strip().lower(): h for h in reader.fieldnames}
    missing = [h for h in CSV_REQUIRED_HEADERS if h not in headers_lower]
    if missing:
        return [], [ImportError(
            row=1,
            code=None,
            message=f"Headers faltantes: {', '.join(missing)}. "
                    f"Headers esperados: {', '.join(CSV_REQUIRED_HEADERS)}.",
        )]

    # Agrupar filas por `code` (mismo código → mismo componente).
    # Conservamos el orden del CSV.
    grouped: dict[str, list[dict]] = {}
    order: list[str] = []
    errors: list[ImportError] = []

    for idx, row in enumerate(reader, start=2):  # 1=header, base 2
        # Normalizar claves a lowercase
        norm = {k.strip().lower(): (v or "").strip() for k, v in row.items() if k}
        code = norm.get("code", "")
        if not code:
            errors.append(ImportError(
                row=idx, code=None, message="Campo 'code' vacío."
            ))
            continue
        if code not in grouped:
            grouped[code] = []
            order.append(code)
        grouped[code].append((idx, norm))

    # Convertir cada grupo en un ParsedComponent
    componentes: list[ParsedComponent] = []
    for code in order:
        rows = grouped[code]
        # Datos del componente (de la primera fila; el resto asume
        # mismos name/type/district; si hay inconsistencia se reporta)
        first_idx, first = rows[0]
        try:
            type_name = first["type"]
            type_id = _resolve_type(type_name)
            district_ubigeo = _resolve_district(first["district_ubigeo"])
            crit_id = _resolve_criticality(first["criticality"])
        except ValueError as e:
            errors.append(ImportError(row=first_idx, code=code, message=str(e)))
            continue

        # Verificar consistencia entre filas del mismo grupo
        inconsistent = None
        for ridx, r in rows[1:]:
            if r["type"].upper() != first["type"].upper():
                inconsistent = f"Fila {ridx}: 'type'='{r['type']}' difiere de la primera fila ('{first['type']}')."
                break
            if r["district_ubigeo"] != first["district_ubigeo"]:
                inconsistent = f"Fila {ridx}: 'district_ubigeo'='{r['district_ubigeo']}' difiere de la primera fila ('{first['district_ubigeo']}')."
                break
        if inconsistent:
            errors.append(ImportError(row=first_idx, code=code, message=inconsistent))
            continue

        # Si hay varias filas, el tipo debe ser línea
        es_linea_prep = first["type"].upper() in LINEA_TYPE_NAMES
        if len(rows) > 1 and not es_linea_prep:
            errors.append(ImportError(
                row=first_idx,
                code=code,
                message=(
                    f"Tipo '{first['type']}' no admite múltiples vértices "
                    f"({len(rows)} filas). Sólo líneas de conducción/aducción."
                ),
            ))
            continue

        # Build coords
        coords: list[dict[str, Any]] = []
        for ridx, r in rows:
            try:
                easting = _parse_float(r["easting"], "easting", ridx)
                northing = _parse_float(r["northing"], "northing", ridx)
            except ValueError as e:
                errors.append(ImportError(row=ridx, code=code, message=str(e)))
                # Invalidamos todo el componente si un vértice falla
                coords = []
                break
            # Criticidad por vértice (puede variar entre filas del mismo code)
            try:
                v_crit_id = _resolve_criticality(r["criticality"])
            except ValueError as e:
                errors.append(ImportError(row=ridx, code=code, message=str(e)))
                coords = []
                break
            coords.append({
                "criticality": v_crit_id,
                "easting": easting,
                "northing": northing,
                "srid_origin": 18,
            })

        if not coords:
            continue  # ya está en errors

        # FKs opcionales
        op_status_code = first.get("operational_status") or None
        fis_status_code = first.get("physical_status") or None
        spec = first.get("specification") or None

        componentes.append(ParsedComponent(
            code=code,
            name=first["name"],
            type_id=type_id,
            district_ubigeo=district_ubigeo,
            operational_status_code=op_status_code,
            physical_status_code=fis_status_code,
            specification=spec,
            coords=coords,
        ))

    return componentes, errors


# ──────────────────────────────────────────────────────────────────────
# GeoJSON
# ──────────────────────────────────────────────────────────────────────

def parse_geojson(
    file_bytes: bytes,
) -> tuple[list[ParsedComponent], list[ImportError]]:
    """
    Parsea un archivo GeoJSON FeatureCollection.

    Cada Feature.Properties debe tener:
      - code (str)
      - name (str)
      - type (str)              → nombre del ComponentType (ej. "CAPTACIÓN")
      - district_ubigeo (str)  → ubigeo del distrito
      - criticality (str)      → nombre de criticidad (ej. "ALTA")
      - operational_status (str, opcional) → code del estado operativo
      - physical_status (str, opcional)    → code del estado físico
      - specification (str, opcional)

    Cada Feature.Geometry puede ser:
      - Point: 1 coordenada por componente.
      - LineString: N coordenadas (1 por vértice) → para líneas de
        conducción/aducción. Cada vértice se convierte en un ComponentCoord.
      - MultiPoint: igual que LineString (cada punto = un vértice).

    Coordenadas siempre en WGS84 [lng, lat] (estándar GeoJSON).
    Internamente convertimos a UTM para pasarlas al backend = igual que CSV.
    En realidad, el backend también acepta longitude/latitude directo
    en el ComponentCoordItemSerializer, así que pasamos lat/lng en vez
    de easting/northing para preservar precisión original.
    """
    try:
        data = json.loads(file_bytes.decode("utf-8-sig"))
    except json.JSONDecodeError as e:
        return [], [ImportError(row=None, code=None, message=f"GeoJSON inválido: {e}")]

    if data.get("type") != "FeatureCollection":
        return [], [ImportError(
            row=None, code=None,
            message="El archivo debe ser un GeoJSON FeatureCollection.",
        )]

    features = data.get("features", [])
    if not features:
        return [], [ImportError(row=None, code=None, message="FeatureCollection vacío.")]

    componentes: list[ParsedComponent] = []
    errors: list[ImportError] = []

    # Agrupar features por `code` (por si un componente se divide en varios
    # features MultiPoint con mismo code). Comportamiento raro: GeoJSON
    # típicamente usa 1 feature = 1 componente. Pero soportamos el caso.
    grouped: dict[str, list[tuple[int, dict]]] = {}
    order: list[str] = []
    for idx, feat in enumerate(features, start=1):
        props = feat.get("properties", {}) or {}
        code = props.get("code")
        if not code:
            errors.append(ImportError(
                row=idx, code=None, message="Feature sin 'code' en properties."
            ))
            continue
        if code not in grouped:
            grouped[code] = []
            order.append(code)
        grouped[code].append((idx, feat))

    for code in order:
        feats = grouped[code]
        first_idx, first_feat = feats[0]
        props = first_feat.get("properties", {}) or {}

        try:
            type_name = props["type"]
            type_id = _resolve_type(type_name)
            district_ubigeo = _resolve_district(props["district_ubigeo"])
            crit_id = _resolve_criticality(props["criticality"])
        except KeyError as e:
            errors.append(ImportError(
                row=first_idx, code=code,
                message=f"Propiedad requerida faltante: {e}.",
            ))
            continue
        except ValueError as e:
            errors.append(ImportError(row=first_idx, code=code, message=str(e)))
            continue

        es_linea_prep = type_name.upper() in LINEA_TYPE_NAMES

        coords: list[dict[str, Any]] = []
        for fidx, feat in feats:
            props_local = feat.get("properties", {}) or {}
            geom = feat.get("geometry") or {}

            # ── Fuente de coordenadas ──
            # Preferimos UTM (East/Northing arrays en properties) porque es
            # la unidad de trabajo del editor. Si no están, fallback al
            # geometry.coordinates estándar GeoJSON (WGS84 [lng, lat]).
            utm_eastings = props_local.get("utm_eastings")
            utm_northings = props_local.get("utm_northings")
            utm_zone = props_local.get("utm_zone", 18)

            if utm_eastings is not None and utm_northings is not None:
                if not isinstance(utm_eastings, list) or not isinstance(utm_northings, list):
                    errors.append(ImportError(
                        row=fidx, code=code,
                        message="'utm_eastings' y 'utm_northings' deben ser arrays numéricos.",
                    ))
                    coords = []
                    break
                if len(utm_eastings) != len(utm_northings):
                    errors.append(ImportError(
                        row=fidx, code=code,
                        message="'utm_eastings' y 'utm_northings' tienen distinta longitud.",
                    ))
                    coords = []
                    break
                if len(utm_eastings) == 0:
                    errors.append(ImportError(
                        row=fidx, code=code,
                        message="Arrays 'utm_eastings'/'utm_northings' vacíos.",
                    ))
                    coords = []
                    break
                # Validar tipo línea vs 1 vértice
                if len(utm_eastings) > 1 and not es_linea_prep:
                    errors.append(ImportError(
                        row=fidx, code=code,
                        message=f"Tipo '{type_name}' no admite múltiples vértices; "
                                f"usa 1 solo en UTM arrays.",
                    ))
                    coords = []
                    break
                if len(utm_eastings) == 1 and es_linea_prep:
                    errors.append(ImportError(
                        row=fidx, code=code,
                        message="Tipo línea requiere al menos 2 vértices UTM.",
                    ))
                    coords = []
                    break
                for v_i, (e_str, n_str) in enumerate(zip(utm_eastings, utm_northings)):
                    try:
                        e = float(e_str)
                        n = float(n_str)
                    except (TypeError, ValueError):
                        errors.append(ImportError(
                            row=fidx, code=code,
                            message=f"Vértice {v_i + 1}: UTM no numérico (easting='{e_str}', northing='{n_str}').",
                        ))
                        coords = []
                        break
                    coords.append({
                        "criticality": crit_id,
                        "easting": e,
                        "northing": n,
                        "srid_origin": int(utm_zone) if utm_zone else 18,
                    })
                if not coords:
                    break
                continue  # próximo feature del mismo code

            # Fallback: geometry.coordinates en WGS84 [lng, lat]
            gtype = geom.get("type")
            coordinates = geom.get("coordinates")
            if not coordinates:
                errors.append(ImportError(
                    row=fidx, code=code,
                    message="Feature sin 'geometry.coordinates' ni 'utm_eastings'/'utm_northings' en properties.",
                ))
                coords = []
                break

            # Normalizar a lista de [lng, lat]
            if gtype == "Point":
                pts: list[list[float]] = [coordinates]
                if es_linea_prep:
                    errors.append(ImportError(
                        row=fidx, code=code,
                        message="Tipo línea requiere LineString/MultiPoint o varios UTM, recibí Point.",
                    ))
                    coords = []
                    break
            elif gtype in ("LineString", "MultiPoint"):
                pts = coordinates
                if not es_linea_prep:
                    errors.append(ImportError(
                        row=fidx, code=code,
                        message=f"Tipo '{type_name}' no admite múltiples vértices; usa Point.",
                    ))
                    coords = []
                    break
            else:
                errors.append(ImportError(
                    row=fidx, code=code,
                    message=f"Geometry type '{gtype}' no soportada. Usa Point, LineString o MultiPoint, o bien 'utm_eastings'/'utm_northings' en properties.",
                ))
                coords = []
                break

            # Por cada vértice: lon/lat → ComponentCoord entry
            for v_i, pair in enumerate(pts):
                if len(pair) < 2:
                    errors.append(ImportError(
                        row=fidx, code=code,
                        message=f"Vértice {v_i + 1} sin [lng, lat] válidos.",
                    ))
                    coords = []
                    break
                try:
                    lng = float(pair[0])
                    lat = float(pair[1])
                except (TypeError, ValueError):
                    errors.append(ImportError(
                        row=fidx, code=code,
                        message=f"Vértice {v_i + 1}: coordenadas no numéricas.",
                    ))
                    coords = []
                    break
                coords.append({
                    "criticality": crit_id,
                    "longitude": lng,
                    "latitude": lat,
                })
            if not coords:
                break

        if not coords:
            continue

        op_status_code = props.get("operational_status") or None
        fis_status_code = props.get("physical_status") or None
        spec = props.get("specification") or None

        componentes.append(ParsedComponent(
            code=code,
            name=props.get("name", code),  # fallback: code
            type_id=type_id,
            district_ubigeo=district_ubigeo,
            operational_status_code=op_status_code,
            physical_status_code=fis_status_code,
            specification=spec,
            coords=coords,
        ))

    return componentes, errors


# ──────────────────────────────────────────────────────────────────────
# Persistencia (dry_run=False) o preview (dry_run=True)
# ──────────────────────────────────────────────────────────────────────

def persist_components(
    componentes: list[ParsedComponent],
    dry_run: bool = False,
) -> tuple[int, list[ImportError]]:
    """
    Persiste N componentes transaccionalmente.

    Estrategia UNIQUE (district+type+code): el usuario eligió
    "abort-all-on-duplicate". Por eso:
      - Si ALGÚN componente parseado ya existe en la base (coincidencia
        exacta de district+type+code), abortamos la Tx completa y
        reportamos el conflicto. Nada se persiste.
      - Sino, hacemos bulk_create de Component + ComponentCoord.

    `dry_run=True` sólo valida (no persiste) — útil para preview.

    Retorna (creados, errores).
    """
    from components.models import ComponentCoord
    from django.db import transaction

    # 1. Validar duplicados intrínsecos (mismo code dentro del lote)
    seen = set()
    for c in componentes:
        key = (c.district_ubigeo, c.type_id, c.code)
        if key in seen:
            return 0, [ImportError(
                row=None, code=c.code,
                message=f"Duplicado interno: district={c.district_ubigeo} "
                        f"+ type_id={c.type_id} + code={c.code} aparece dos "
                        f"veces en el archivo.",
            )]
        seen.add(key)

    # 2. Validar duplicados contra la base existente
    existing_errors: list[ImportError] = []
    for c in componentes:
        exists = Component.objects.filter(
            district__ubigeo=c.district_ubigeo,
            type_id=c.type_id,
            code=c.code,
        ).exists()
        if exists:
            existing_errors.append(ImportError(
                row=None, code=c.code,
                message=f"Ya existe un componente con district="
                        f"{c.district_ubigeo}, type_id={c.type_id}, "
                        f"code={c.code}.",
            ))
    if existing_errors:
        return 0, existing_errors

    if dry_run:
        # No persistimos; preview OK
        return len(componentes), []

    # 3. Persistir transaccional
    try:
        with transaction.atomic():
            for c in componentes:
                # Resolver FKs a objetos para asignarlos
                district = District.objects.get(ubigeo=c.district_ubigeo)
                component_type = ComponentType.objects.get(pk=c.type_id)
                op_status = None
                fis_status = None
                if c.operational_status_code:
                    from components.models import OperationalStatus
                    op_status = OperationalStatus.objects.filter(
                        code=c.operational_status_code
                    ).first()
                if c.physical_status_code:
                    from components.models import PhysicalStatus
                    fis_status = PhysicalStatus.objects.filter(
                        code=c.physical_status_code
                    ).first()

                comp = Component.objects.create(
                    code=c.code,
                    name=c.name,
                    type=component_type,
                    district=district,
                    operational_status=op_status,
                    physical_status=fis_status,
                    specification=c.specification,
                )

                # Coords
                coord_instances = []
                for coord in c.coords:
                    if "easting" in coord and "northing" in coord:
                        point = SpatialHelper.utm_to_wgs84(
                            coord["easting"],
                            coord["northing"],
                            coord.get("srid_origin", 18),
                        )
                    else:
                        point = Point(coord["longitude"], coord["latitude"], srid=4326)
                    coord_instances.append(ComponentCoord(
                        component=comp,
                        criticality_id=coord["criticality"],
                        coords=point,
                    ))
                if coord_instances:
                    ComponentCoord.objects.bulk_create(coord_instances)
    except Exception as e:
        return 0, [ImportError(
            row=None, code=None,
            message=f"Error al persistir: {e}",
        )]

    return len(componentes), []