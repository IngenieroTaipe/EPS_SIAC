from django_filters import rest_framework as filters
from django.db.models import OuterRef, Subquery
from alerts_management.models import Alert, AlertHistory

class AlertFilter(filters.FilterSet):
    """
    Filtro empresarial con alias cortos para query params:
    - ?phenomena=1
    - ?status=2
    - ?phase=3
    """
    phenomena = filters.NumberFilter(field_name='natural_phenomena_id', label="Identificador del Fenómeno Natural")
    status = filters.NumberFilter(method='filter_latest_status', label="Identificador del Estado de la Alerta")
    phase = filters.NumberFilter(method='filter_latest_phase', label="Identificador de la Fase de la Alerta")

    class Meta:
        model = Alert
        fields = ['phenomena', 'status', 'phase']

    def filter_latest_status(self, queryset, name, value):
        """
            Filtra únicamente si el ID del estado más reciente coincide con el valor solicitado.
        """
        if not value:
            return queryset

        latest_status_subquery = Subquery(
            AlertHistory.objects.filter(
                alert=OuterRef('pk'),
            ).order_by('-created_at', '-id').values('status_id')[:1]
        )

        return queryset.annotate(
            current_status_id=latest_status_subquery
        ).filter(current_status_id=value)

    def filter_latest_phase(self, queryset, name, value):
        """
            Filtra únicamente si el ID de la fase más reciente coincide con el valor solicitado.
        """
        if not value:
            return queryset

        latest_phase_subquery = Subquery(
            AlertHistory.objects.filter(
                alert=OuterRef('pk'),
            ).order_by('-created_at', '-id').values('phase_id')[:1]
        )

        return queryset.annotate(
            current_phase_id=latest_phase_subquery
        ).filter(current_phase_id=value)