from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth.models import User, Group, Permission
from django.contrib.contenttypes.models import ContentType


class Command(BaseCommand):
    help = 'Puebla la base de datos con Grupos, Permisos y Usuarios iniciales'

    @transaction.atomic
    def handle(self, *args, **kwargs):
        self.stdout.write(
            self.style.MIGRATE_HEADING('=== Iniciando Seeder de Autenticación y Roles ===')
        )

        # ----------------------------------------------------------------------
        # CREACIÓN DE GRUPOS DE ROLES
        # ----------------------------------------------------------------------
        groups = [
            {'name' : 'Administrator'},
            {'name' : 'Operator'},
            {'name' : 'Worker'},
        ]

        groups_cache = {}

        for group in groups:
            grp, created = Group.objects.update_or_create(
                name=group['name']
            )

            groups_cache[group['name']] = grp

        self.stdout.write(self.style.SUCCESS('✓ Grupos de roles creados.'))

        # ----------------------------------------------------------------------
        # CREACIÓN DE USUARIOS
        # ----------------------------------------------------------------------
        users = [
            {
                'username': 'admin',
                'email': 'admin@eps-siac.gob.pe',
                'password': 'AdminPassword123!',
                'first_name': 'Administrador',
                'last_name': 'GIS Principal',
                'is_staff': True,
                'is_superuser': True,
                'groups': [groups_cache['Administrator']],
            },
            {
                'username': 'operador',
                'email': 'operador.chanchamayo@eps-siac.gob.pe',
                'password': 'OperatorPassword123!',
                'first_name': 'Ricardo',
                'last_name': 'Analista Operativo',
                'is_staff': True,
                'is_superuser': False,
                'groups': [groups_cache['Operator']]
            },
        ]

        for user in users:
            groups = user.pop('groups')
            password = user.pop('password')

            user, created = User.objects.update_or_create(
                username = user['username'],
                defaults=user
            )

            user.set_password(password)
            user.save()

            user.groups.set(groups)

        self.stdout.write(self.style.SUCCESS('✓ Usuarios creados.'))

        self.stdout.write(
            self.style.MIGRATE_LABEL('=== Seeding de Autenticación Finalizado con Éxito ===')
        )