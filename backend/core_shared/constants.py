from zoneinfo import ZoneInfo

LIMA_TZ_STR = "America/Lima"
LIMA_TZ = ZoneInfo("America/Lima")


# =====================================
# Claves de caché de REDIS
# =====================================

# KEYS PARA EL MÓDULO CORE_PREDICTIVE
CACHE_KEY_GFS_HISTORIC_CLUSTERS = "geo_cache:gfs:historic:clusters"
CACHE_KEY_GFS_HISTORIC_CELLS = "geo_cache:gfs:historic:cells"
CACHE_KEY_GFS_LATEST_CELLS = "geo_cache:gfs:latest:cells"
CACHE_KEY_GFS_LATEST_CLUSTERS = "geo_cache:gfs:latest:clusters"

## TIEMPO PARA ELIMINACIÓN DE INFORMACIÓN DE REDIS
CACHE_TTL_HISTORIC_CLUSTERS = 60 * 60 * 6 # 6 horas
CACHE_TTL_HISTORIC_CELLS = 60 * 60 * 6 # 6 horas
CACHE_TTL_LATEST_CELLS = 60 * 60 * 6 # 6 horas
CACHE_TTL_LATEST_CLUSTERS = 60 * 60 * 6 # 6 horas

# KEYS PARA EL MÓDULO ALERTS_MANAGEMENT
CACHE_KEY_ALERTS_MAP = "geo_cache:alerts:map_payload"
CACHE_KEY_COMPONENTS_MAP = "geo_cache:components:map_payload"

## TIEMPO PARA ELIMINACIÓN DE INFORMACIÓN DE REDIS
CACHE_TTL_ALERTS_MAP = 60 * 60 * 6 # 6 horas
CACHE_TTL_COMPONENTS_MAP = 60 * 60 * 6 # 6 horas