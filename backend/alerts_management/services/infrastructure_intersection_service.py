# alerts_management/services/infrastructure_intersection_service.py

from django.contrib.gis.geos import GEOSGeometry
from typing import List, Dict

from core_predictive.models import GFSClusterSnapshot
from components.models import Component

import logging

logger = logging.getLogger(__name__)


class InfrastructureIntersectionService:

    @classmethod
    def get_impacted_components_by_clusteres(cls, gfs_request_id: int) -> List[Dict]:
        """
            El método nos permite filtrar los clústeres identificados en el pronóstico de GFS que intersecan con algún componente infraestructural de la EPS.

            El método aprovecha el índice espacial GiST en PostGIS.

            `@params:`
                `gfs_request_id (int):` ID de la solicitud GFS.
            
            `@return:`
                `List[Dict]:` Lista de clústeres con impacto en infraestructura.
        """
        logger.info(f"[Etapa 3] Evaluando intersección con infraestructura para Request #{gfs_request_id}...")

        # === Cargar clústeres calculados para esta solicitud ===
        clusters = GFSClusterSnapshot.objects.filter(gfs_request_id=gfs_request_id)
        if not clusters.exists():
            logger.info("[Etapa 3] No existen clústeres registrados para esta solicitud.")
            return []

        impacted_records = []

        # === Intersección vectorial acelerada ===
        for cluster in clusters:
            # === Spatial Join en PostGIS usando ST_Intersects vía ORM ===
            components = list(Component.objects.filter(
                coords_relation__coords__intersects=cluster.geometry
            ).prefetch_related('coords_relation').distinct())

            # === Solo nos interesan los clústeres que amenazan la infraestructura de la EPS ===
            if components:
                point_intersection = cls.calculate_representative_point(
                    cluster.geometry, 
                    components
                )

                impacted_records.append({
                    "cluster_snapshot": cluster,
                    "impacted_components": components,
                    'point_impacted' : point_intersection
                })

        logger.info(f"[Etapa 3] Clústeres con impacto en infraestructura encontrados: {len(impacted_records)}")
        return impacted_records
    
    @classmethod
    def calculate_representative_point(
        cls, 
        cluster_geometry: GEOSGeometry,
        impacted_components: list
    ) -> GEOSGeometry:
        """
            Calcula el punto óptimo para la ubicación del Pin:
                - Si hay componentes de la EPS impactados, ubica el punto sobre el primer componente crítico.
                - Si no hay componentes o falla la intersección, usa ST_PointOnSurface (Garantía dentro del polígono).

            `@params:`
                `cluster_geometry (GEOSGeometry):` Geometría del clúster GFS.
                `impacted_components (list):` Lista de componentes infraestructurales impactados.
            `@return:`
                `GEOSGeometry:` Punto representativo para el clúster GFS.
        """
        if impacted_components:
            # === Intersección geométrica entre clúster y componente ===
            primary_component_geom = impacted_components[0].coords_relation.first().coords
            intersection = cluster_geometry.intersection(primary_component_geom)
            
            # === Punto de intersección ===
            if not intersection.empty:
                return intersection.centroid if intersection.geom_type in ['Point', 'MultiPoint'] else intersection.point_on_surface
        
        return None