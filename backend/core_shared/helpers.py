from django.contrib.gis.geos import Point
from rest_framework.exceptions import ValidationError

class SpatialHelper:
    """
        El helper permite las transformaciones entre formatos de georeferencia UTM (EPSG:32717, 32718, 32719)
        y WGS84 Geográfico (EPSG:4326), permitiendo la interoperabilidad entre sistemas de información geográfica.
    """

    # Diccionario de Sistemas de Referencia de Coordenadas para el Perú
    PERU_UTM_SRIDS = {
        17: 32717,  # UTM Zona 17S (Costa/Sierra Norte)
        18: 32718,  # UTM Zona 18S (Selva Central / Junín / Lima / Pasco)
        19: 32719,  # UTM Zona 19S (Selva Este / Madre de Dios / Puno)
    }

    @classmethod
    def get_utm_zone_from_longitude(cls, longitude: float) -> int:
        """
            Calcula matemáticamente la Zona UTM (1 a 60) basada en la Longitud WGS84.
        """
        zone = int((longitude + 180) / 6) + 1
        return zone

    @classmethod
    def utm_to_wgs84(cls, easting: float, northing: float, zone: int = 18) -> Point:
        """
            Convierte coordenadas planas UTM (Este, Norte) a un objeto Point en WGS84 (EPSG:4326).
        
            `@param easting`: Coordenada Este en metros (ej. 485120.45)
            
            `@param northing`: Coordenada Norte en metros (ej. 8779850.12)
            
            `@param zone`: Zona UTM en Perú (17, 18 o 19). Defecto: 18 (Selva Central)
            
            `@return`: GEOSGeometry Point en EPSG:4326 (Longitud, Latitud)
        """
        srid = cls.PERU_UTM_SRIDS.get(zone)
        if not srid:
            raise ValidationError(
                f"Zona UTM {zone} inválida para el territorio peruano. Use las zonas 17, 18 o 19."
            )

        # Validación de rangos UTM para Perú
        if not (100000.0 <= easting <= 900000.0):
            raise ValidationError(f"Coordenada Este ({easting}) fuera de rango métrico UTM válido.")

        if not (0.0 <= northing <= 10000000.0):
            raise ValidationError(f"Coordenada Norte ({northing}) fuera de rango métrico UTM válido.")

        try:
            # Instanciamos la geometría puntual en proyección UTM
            point_utm = Point(easting, northing, srid=srid)

            # Reproyectamos de UTM a WGS84
            point_utm.transform(4326)
            return point_utm

        except Exception as e:
            raise ValidationError(f"Error al ejecutar la transformación geodésica UTM -> WGS84: {str(e)}")

    @classmethod
    def wgs84_to_utm(cls, point: Point, target_zone: int = None) -> dict:
        """
            Convierte un objeto Point en WGS84 (EPSG:4326) a coordenadas proyectadas UTM (Este, Norte).
        
            `@param point`: GEOSGeometry Point en EPSG:4326
            
            `@param target_zone`: Zona UTM objetivo (17, 18 o 19). Defecto: 18
            
            `@return`: dict con {'easting': float, 'northing': float, 'srid': int, 'zone': str}
        """
        if not point or not isinstance(point, Point):
            raise ValidationError("Se requiere un objeto GEOS Point válido.")

        # clonamos para no alterar el objeto original
        point_clone = point.clone()

        # Establecemos por defecto el SRID como WGS84
        if point_clone.srid is None:
            point_clone.srid = 4326
        elif point_clone.srid != 4326:
            point_clone.transform(4326)

        if target_zone is None:
            target_zone = cls.get_utm_zone_from_longitude(point_clone.x)

        srid = cls.PERU_UTM_SRIDS.get(target_zone)
        if not srid:
            raise ValidationError("Zona UTM no soportada.")

        try:
            # Reproyectamos de WGS84 a UTM
            point_clone.transform(srid)

            return {
                "easting": round(point_clone.x, 3),
                "northing": round(point_clone.y, 3),
                "srid": srid,
                "zone": f"{target_zone}S"
            }
        except Exception as e:
            raise ValidationError(f"Error al ejecutar la transformación geodésica WGS84 -> UTM: {str(e)}")