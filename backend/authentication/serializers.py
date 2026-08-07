from django.contrib.auth.models import User, Group
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework.exceptions import ValidationError


class UserCreateSerializer(serializers.ModelSerializer):
    """
        Serializer para crear nuevos usuarios (solo administradores).
        - Encripta la contraseña con `set_password`.
        - Permite asignar grupos (roles) en el mismo payload.
    """
    password = serializers.CharField(write_only=True, validators=[validate_password])
    groups = serializers.PrimaryKeyRelatedField(
        queryset=Group.objects.all(),
        many=True,
        required=False,
        help_text="IDs de los grupos (roles) a asignar al usuario."
    )

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'password',
            'first_name',
            'last_name',
            'is_staff',
            'is_active',
            'groups',
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        groups = validated_data.pop('groups', [])
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        if groups:
            user.groups.set(groups)
        return user

    def validate(self, attrs):
        """
            Consistencia de roles:
            - Un usuario NO staff debe pertenecer a algún grupo (rol),
              de lo contrario queda como "literalura muerta" en el sistema
              sin acceso administrativo ni rol de negocio asignado.
            - Para ediciones (PATCH), se completa con los valores actuales
              del instance cuando el campo no viene en el payload.
        """
        is_staff = attrs.get('is_staff')
        groups = attrs.get('groups')

        if self.instance is not None:
            if is_staff is None:
                is_staff = self.instance.is_staff
            if 'groups' not in attrs:
                groups = list(self.instance.groups.all())

        if not is_staff and not groups:
            raise ValidationError({
                'groups': "Asigna un rol a los usuarios que no son administrador."
            })

        return attrs

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        representation.pop('password', None)
        representation['groups'] = list(instance.groups.values_list('id', flat=True))
        representation['groups_names'] = list(instance.groups.values_list('name', flat=True))
        return representation


class UserDetailsSerializer(serializers.ModelSerializer):
    """
        Serializer del perfil del propio usuario autenticado.
        Usado por dj-rest-auth en `GET/PATCH /auth/user/` para que el
        frontend conozca `is_staff`/`is_superuser` y decida qué mostrar.
    """
    groups = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = User
        fields = [
            'pk',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_staff',
            'is_superuser',
            'is_active',
            'groups',
        ]
        read_only_fields = fields