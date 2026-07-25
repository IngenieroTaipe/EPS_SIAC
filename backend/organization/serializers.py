from rest_framework.exceptions import ValidationError
from core_shared.formatters import DataFormatter
from core_shared.mixins import PrepareDataMixin
from rest_framework import serializers
from organization.models import (
    Branch, 
    OrganicUnit, 
    RolesUnit, 
    Worker, 
    Member, 
    BranchesOrganicUnit
)

from places.serializers import DistrictLightSerializer
from places.models import District

# ==============================================================================
# SERIALIZADORES DE BRANCHES
# ==============================================================================
class BranchSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'code': DataFormatter.zfill(3),
        'name': DataFormatter.upper_case,
        'acronym': DataFormatter.upper_case,
        'observations': DataFormatter.trim_string,
    }

    district = serializers.PrimaryKeyRelatedField(
        queryset=District.objects.all(),
        help_text="Ubigeo del distrito (ej: '120301')"
    )

    class Meta:
        model = Branch
        fields = [
            'id',
            'district', 
            'code', 
            'name', 
            'acronym', 
            'status', 
            'observations'
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.district:
            representation['district'] = DistrictLightSerializer(instance.district).data
        return representation

class BranchLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'code': DataFormatter.zfill(3),
        'name': DataFormatter.upper_case,
        'acronym': DataFormatter.upper_case,
    }

    class Meta:
        model = Branch
        fields = [
            'id',
            'code',
            'name',
            'acronym'
        ]
        read_only_fields = ['id']
    
# ==============================================================================
# SERIALIZADORES DE ORGANIC UNITS
# ==============================================================================
class OrganicUnitSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
    }
    
    parent_unit = serializers.PrimaryKeyRelatedField(
        queryset=OrganicUnit.objects.all(),
        help_text="Unidad orgánica padre (ej: '1'), es requerido, salvo para la unidad principal (null)",
        allow_null=True,
        required=False
    )

    class Meta:
        model = OrganicUnit
        fields = [
            'id',
            'parent_unit', 
            'name', 
            'hierarchy_level'
        ]
        read_only_fields = ['id']
    
    def validate(self, attrs):
        """
            Consistencia relacional entre la unidad padre y la unidad actual.

            - Considerar que el nivel jerárquico se considera mayor mientras menor es el valor numérico.

            Ejemplo: El nivel Jerárquico 1 tiene mayor nivel que el Nivel Jerárquico 2.
        """
        parent_unit = attrs.get('parent_unit')
        hierarchy_level = attrs.get('hierarchy_level')

        # PUT/PATCH
        if self.instance:
            if hierarchy_level is None:
                hierarchy_level = self.instance.hierarchy_level
            if 'parent_unit' not in attrs:
                parent_unit = self.instance.parent_unit

        # Auto-referencia cíclica
        if self.instance and parent_unit and self.instance.pk == parent_unit.pk:
            raise ValidationError({
                'parent_unit': "Una unidad orgánica no puede ser asignada como su propia unidad padre."
            })

        # Coherencia jerárquica entre Padre e Hijo
        if parent_unit and hierarchy_level is not None:
            # El nivel jerárquico del padre debe ser menor que el del hijo
            if parent_unit.hierarchy_level >= hierarchy_level:
                raise ValidationError({
                    'parent_unit': (
                        f"Incoherencia jerárquica: La unidad padre '{parent_unit.name}' tiene un nivel "
                        f"{parent_unit.hierarchy_level}, por lo que no puede subordinar a una unidad de "
                        f"nivel {hierarchy_level}. El nivel del padre debe ser numéricamente menor (mayor rango)."
                    )
                })

        return attrs
    
    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.parent_unit:
            representation['parent_unit'] = OrganicUnitSerializer(instance.parent_unit).data
        return representation

class OrganicUnitLightSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganicUnit
        fields = [
            'id',
            'name',
        ]
        read_only_fields = ['id']
        
# ==============================================================================
# SERIALIZADORES DE ROLES UNITS
# ==============================================================================
class RolesUnitSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'name': DataFormatter.upper_case,
        'description': DataFormatter.trim_string,
    }

    class Meta:
        model = RolesUnit
        fields = [
            'id',
            'name',
            'description'
        ]
        read_only_fields = ['id']

# ==============================================================================
# SERIALIZADORES DE WORKERS
# ==============================================================================
class WorkerSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'names': DataFormatter.upper_case,
        'paternal_lastname': DataFormatter.upper_case,
        'maternal_lastname': DataFormatter.upper_case,
        'email': DataFormatter.lower_case,
        'dni': DataFormatter.trim_string,
        'phone_number': DataFormatter.trim_string,
    }

    class Meta:
        model = Worker
        fields = [
            'id',
            'names', 
            'paternal_lastname', 
            'maternal_lastname', 
            'dni', 
            'email', 
            'phone_number'
        ]
        read_only_fields = ['id']

class WorkerLightSerializer(PrepareDataMixin, serializers.ModelSerializer):
    prepare_fields = {
        'dni': DataFormatter.trim_string,
    }

    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = Worker
        fields = [
            'id',
            'full_name', 
            'dni',
        ]
        read_only_fields = ['id']

    def get_full_name(self, obj):
        return f'{obj.names} {obj.paternal_lastname} {obj.maternal_lastname}'
        
# ==============================================================================
# SERIALIZADORES DE BRANCHES ORGANIC UNIT
# ==============================================================================
class BranchesOrganicUnitSerializer(serializers.ModelSerializer):
    branch = serializers.PrimaryKeyRelatedField(
        queryset=Branch.objects.all(),
        help_text="ID de la sucursal"
    )
    organic_unit = serializers.PrimaryKeyRelatedField(
        queryset=OrganicUnit.objects.all(),
        help_text="ID de la unidad orgánica"
    )

    class Meta:
        model = BranchesOrganicUnit
        fields = [
            'id',
            'branch', 
            'organic_unit'
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.branch:
            representation['branch'] = BranchLightSerializer(instance.branch).data
        if instance.organic_unit:
            representation['organic_unit'] = OrganicUnitLightSerializer(instance.organic_unit).data
        return representation
        
# ==============================================================================
# SERIALIZADORES DE MEMBERS
# ==============================================================================
class MemberSerializer(serializers.ModelSerializer):
        
    worker = serializers.PrimaryKeyRelatedField(
        queryset=Worker.objects.all(),
        help_text="ID del trabajador"
    )
    rol_unit = serializers.PrimaryKeyRelatedField(
        queryset=RolesUnit.objects.all(),
        help_text="ID del rol"
    )
    branch_organic_unit = serializers.PrimaryKeyRelatedField(
        queryset=BranchesOrganicUnit.objects.all(),
        help_text="ID de la rama orgánica"
    )

    class Meta:
        model = Member
        fields = [
            'id',
            'worker',
            'rol_unit',
            'branch_organic_unit',
        ]
        read_only_fields = ['id']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.worker:
            representation['worker'] = WorkerLightSerializer(instance.worker).data
        if instance.rol_unit:
            representation['rol_unit'] = RolesUnitSerializer(instance.rol_unit).data
        if instance.branch_organic_unit:
            representation['branch_organic_unit'] = BranchesOrganicUnitSerializer(instance.branch_organic_unit).data

        return representation    