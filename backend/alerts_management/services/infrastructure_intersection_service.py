# alerts_management/services/infrastructure_intersection_service.py

from django.db.models import Prefetch
from django.contrib.gis.geos import GEOSGeometry
from dataclasses import dataclass, field
from datetime import datetime

from typing import List, Dict, Set, Optional

from core_predictive.models import GFSClusterSnapshot, Threshold
from components.models import Component, ComponentCoord

import logging

logger = logging.getLogger(__name__)

@dataclass
class ConsolidatedAlertEvent:
    """
        Entidad de Consolidación Espacio-Temporal:
        Agrupa múltiples snapshots horarios contiguos que pertenecen al mismo fenómeno.

        Atributos:
            - initial_snapshot (GFSClusterSnapshot): Primer snapshot del fenómeno.
            - latest_snapshot (GFSClusterSnapshot): Último snapshot del fenómeno.
            - time_steps (List[int]): Lista de pasos de tiempo consecutivos que forman el fenómeno.
            - snapshots (List[GFSClusterSnapshot]): Lista completa de snapshots que componen el fenómeno.
            - impacted_component_ids (Set[int]): Identificadores únicos de los componentes infraestructurales afectados.
            - impacted_components (List[Component]): Objetos Component que son impactados por el fenómeno.
            - unified_geometry (GEOSGeometry): Geometría unificada (Union) que representa la extensión total del fenómeno.
            - representative_point (GEOSGeometry): Punto geográfico representativo del fenómeno (centroide o punto sobre la superficie).
    """
    initial_snapshot: GFSClusterSnapshot
    latest_snapshot: GFSClusterSnapshot
    time_steps: List[int] = field(default_factory=list)
    snapshots: List[GFSClusterSnapshot] = field(default_factory=list)
    impacted_component_ids: Set[int] = field(default_factory=set)
    impacted_components: List[Component] = field(default_factory=list)
    unified_geometry: GEOSGeometry = None
    representative_point: GEOSGeometry = None

    @property
    def start_time_utc(self) -> datetime:
        return self.initial_snapshot.timestamp_utc

    @property
    def end_time_utc(self) -> datetime:
        return self.latest_snapshot.timestamp_utc

    @property
    def max_intensity_mm_h(self) -> float:
        """Calcula el pico de intensidad registrado a lo largo de toda la serie temporal."""
        return max((s.max_intensity_mm_h for s in self.snapshots), default=0.0)

    @property
    def highest_threshold(self) -> Optional[Threshold]:
        """
        Extrae la instancia de ThresholdsNaturalPhenomena más crítica asociada 
        a los snapshots consolidados y acotada al fenómeno y distritos afectados.
        """
        # Extrae los umbrales válidos presentes en los snapshots del evento
        thresholds = [s.threshold for s in self.snapshots if s.threshold is not None]
        
        if not thresholds:
            return None

        # Retorna el umbral con el mayor severity_level
        return max(thresholds, key=lambda t:getattr(t, 'severity_level', 1))

class InfrastructureIntersectionService:

    @classmethod
    def get_impacted_components_by_clusters(cls, gfs_request_id: int) -> List[Dict]:
        """
            El método nos permite filtrar los clústeres identificados en el pronóstico de GFS que intersecan con algún componente infraestructural de la EPS.

            El método aprovecha el índice espacial GiST en PostGIS.

            `@params:`
                `gfs_request_id (int):` ID de la solicitud GFS.
            
            `@return:`
                `List[Dict]:` Lista de clústeres con impacto en infraestructura.
                    - `cluster_snapshot` (GFSClusterSnapshot): Objeto del clúster.
                    - `impacted_components` (List[Component]): Lista de componentes infraestructurales impactados.
                    - `point_impacted` (GEOSGeometry): Punto representativo para el clúster GFS.
        """
        logger.info(f"[Etapa 3] Evaluando intersección con infraestructura para Request #{gfs_request_id}...")

        # === Cargar clústeres calculados para esta solicitud ===
        clusters = list(
            GFSClusterSnapshot.objects.filter(gfs_request_id=gfs_request_id)
            .select_related('threshold')
            .order_by('time_step', 'cluster_index')
        )

        # === Validar si existen clústeres ===
        if not clusters:
            logger.info("[Etapa 3] No existen clústeres registrados para esta solicitud.")
            return []

        impacted_records = []

        # === Intersección vectorial acelerada ===
        for cluster in clusters:
            # === Spatial Join en PostGIS usando ST_Intersects vía ORM ===
            components = list(
                Component.objects.filter(
                    coords_relation__coords__intersects=cluster.geometry
                ).prefetch_related(
                    Prefetch(
                        'coords_relation',
                        queryset=ComponentCoord.objects.select_related('criticality')
                    )
                ).distinct()
            )

            # === Solo nos interesan los clústeres que amenazan la infraestructura de la EPS ===
            if components:
                impacted_records.append({
                    "cluster": cluster,
                    "components": components,
                    "component_ids": {c.id for c in components}
                })

        if not impacted_records:
            logger.info("[Etapa 3] Ningún clúster intersecta con infraestructura de la EPS.")
            return []

        # === Consolidación Espacio-Temporal (Tracking del Evento Continuo) ===
        consolidated_events: List[ConsolidatedAlertEvent] = []

        for impacted in impacted_records:
            cluster = impacted["cluster"]
            components = impacted["components"]
            comp_ids = impacted["component_ids"]

            # Selección del evento óptimo según reglas topológicas y de severidad
            matched_event = cls._find_best_matching_event(
                cluster=cluster,
                comp_ids=comp_ids,
                consolidated_events=consolidated_events
            )
            
            if matched_event:
                # === Extender el evento existente ===
                matched_event.latest_snapshot = cluster
                matched_event.time_steps.append(cluster.time_step)
                matched_event.snapshots.append(cluster)
                matched_event.impacted_component_ids.update(comp_ids)
                
                # === Unión topológica acumulativa (ST_Union en GEOS) ===
                if matched_event.unified_geometry:
                    matched_event.unified_geometry = matched_event.unified_geometry.union(cluster.geometry)
                else:
                    matched_event.unified_geometry = cluster.geometry

                # === Agregar componentes no repetidos ===
                existing_ids = {c.id for c in matched_event.impacted_components}
                for comp in components:
                    if comp.id not in existing_ids:
                        matched_event.impacted_components.append(comp)
            else:
                # === Iniciar una nueva cadena de alerta consolidada ===
                new_event = ConsolidatedAlertEvent(
                    initial_snapshot=cluster,
                    latest_snapshot=cluster,
                    time_steps=[cluster.time_step],
                    snapshots=[cluster],
                    impacted_component_ids=set(comp_ids),
                    impacted_components=list(components),
                    unified_geometry=cluster.geometry
                )
                consolidated_events.append(new_event)

        for event in consolidated_events:
            event.representative_point = cls.calculate_representative_point(
                cluster_geometry=event.unified_geometry,
                impacted_components=event.impacted_components
            )

        logger.info(f"[Etapa 3] Eventos de precipitación con impacto en infraestructura consolidados: {len(consolidated_events)}")
        return consolidated_events
    
    @classmethod
    def _find_best_matching_event(
        cls,
        cluster: GFSClusterSnapshot,
        comp_ids: Set[int],
        consolidated_events: List[ConsolidatedAlertEvent]
    ) -> Optional[ConsolidatedAlertEvent]:
        """
        Resuelve la ambigüedad de asignación evaluando:
        1. Continuidad temporal estricta (time_step consecutivo).
        2. Mayor severidad operativa (severity_level).
        3. Mayor área de intersección espacial (ST_Intersection).
        """
        candidates = []

        for event in consolidated_events:
            # === Condición A: Continuidad temporal estricta (paso siguiente) ===
            logger.info(f"Current step: {cluster.time_step}, Latest snapshot step: {event.latest_snapshot.time_step}")
            if cluster.time_step != event.latest_snapshot.time_step + 1:
                continue

            # === Condición B1: Impacto sobre los mismos componentes de la EPS ===
            shares_infrastructure = bool(comp_ids.intersection(event.impacted_component_ids))
            
            # === Condición B2: Intersección topológica directa entre polígonos ===
            intersection_area = 0.0

            if event.unified_geometry and cluster.geometry.intersects(event.unified_geometry):
                try:
                    intersection_geom = cluster.geometry.intersection(event.unified_geometry)
                    if not intersection_geom.empty:
                        intersection_area = intersection_geom.area
                except Exception as e:
                    logger.warning(f"Error topológico al intersectar geometrías: {str(e)}")
                    intersection_area = 0.0

            if intersection_area > 0.0 or shares_infrastructure:
                candidates.append({
                    "event": event,
                    "severity": getattr(cluster.threshold, 'severity_level', 1) if cluster.threshold else 1,
                    "intersection_area": intersection_area,
                    "shares_infra": shares_infrastructure
                })

        if not candidates:
            return None

        # Orden determinista: Mayor severidad primero, luego mayor área superpuesta
        candidates.sort(
            key=lambda c: (c["severity"], c["intersection_area"]),
            reverse=True
        )

        return candidates[0]["event"]

    @classmethod
    def calculate_representative_point(
        cls, 
        cluster_geometry: GEOSGeometry,
        impacted_components: list
    ) -> GEOSGeometry:
        """
            Calcula el punto óptimo para la ubicación del Pin:
                - Si hay componentes de la EPS impactados, ubica el punto sobre el primer componente crítico con mayor severidad.
                - Si no hay componentes o falla la intersección, usa ST_PointOnSurface (Garantía dentro del polígono).

            `@params:`
                `cluster_geometry (GEOSGeometry):` Geometría del clúster GFS.
                `impacted_components (list):` Lista de componentes infraestructurales impactados.
            `@return:`
                `GEOSGeometry:` Punto representativo para el clúster GFS.
        """
        if not cluster_geometry or not impacted_components:
            return cluster_geometry.point_on_surface if cluster_geometry else None
        
        intersected_coords: List[ComponentCoord] = []

        # === Extraer las coordenadas físicas de todos los componentes impactados ===
        for comp in impacted_components:
            for coord_record in comp.coords_relation.all():
                if coord_record.coords and cluster_geometry.intersects(coord_record.coords):
                    intersected_coords.append(coord_record)

        # === Ordenar por criticidad ===
        if intersected_coords:
            sorted_coords = sorted(
                intersected_coords,
                key=lambda c: getattr(c.criticality, 'severity_level', c.criticality.id),
                reverse=True
            )
            # Retorna el punto WGS84 del nodo más vulnerable
            return sorted_coords[0].coords

        # Fallback si no hay intersección puntual exacta: punto interno de la geometría unificada
        return cluster_geometry.point_on_surface