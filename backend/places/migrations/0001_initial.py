# Generated manually to provide the initial migration for the places app.

import django.contrib.gis.db.models.fields
import django.core.validators
import django.db.models.deletion
from django.db import migrations, models

import core_shared.validators
import places.validators


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Department',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('ubigeo', models.CharField(max_length=2, primary_key=True, serialize=False, unique=True, validators=[places.validators.department_ubigeo_validator])),
                ('name', models.CharField(max_length=50, unique=True, validators=[core_shared.validators.alpha_name_validator])),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
            ],
            options={
                'verbose_name': 'Departamento',
                'verbose_name_plural': 'Departamentos',
                'db_table': 'departments',
                'ordering': ['ubigeo'],
            },
        ),
        migrations.CreateModel(
            name='Province',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('ubigeo', models.CharField(max_length=4, primary_key=True, serialize=False, unique=True, validators=[places.validators.province_ubigeo_validator])),
                ('name', models.CharField(max_length=50, unique=True, validators=[core_shared.validators.alpha_name_validator])),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
                ('department', models.ForeignKey(db_column='department_ubigeo', on_delete=django.db.models.deletion.PROTECT, related_name='provinces', to='places.department')),
            ],
            options={
                'verbose_name': 'Provincia',
                'verbose_name_plural': 'Provincias',
                'db_table': 'provinces',
                'ordering': ['ubigeo'],
                'unique_together': {('department', 'name')},
            },
        ),
        migrations.CreateModel(
            name='District',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('ubigeo', models.CharField(max_length=6, primary_key=True, serialize=False, unique=True, validators=[places.validators.district_ubigeo_validator])),
                ('name', models.CharField(max_length=50, validators=[core_shared.validators.alpha_name_validator])),
                ('geometry', django.contrib.gis.db.models.fields.MultiPolygonField(blank=True, null=True, srid=4326)),
                ('province', models.ForeignKey(db_column='province_ubigeo', on_delete=django.db.models.deletion.PROTECT, related_name='districts', to='places.province')),
            ],
            options={
                'verbose_name': 'Distrito',
                'verbose_name_plural': 'Distritos',
                'db_table': 'districts',
                'ordering': ['ubigeo'],
                'unique_together': {('province', 'name')},
            },
        ),
        migrations.CreateModel(
            name='Sector',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('code', models.CharField(max_length=3, primary_key=True, serialize=False, validators=[places.validators.sector_code_validator])),
                ('name', models.CharField(max_length=50, unique=True, validators=[core_shared.validators.alpha_name_validator])),
                ('status', models.BooleanField(default=True)),
                ('observations', models.TextField(blank=True, null=True)),
                ('district', models.ForeignKey(db_column='district_ubigeo', on_delete=django.db.models.deletion.PROTECT, related_name='sectors', to='places.district')),
            ],
            options={
                'verbose_name': 'Sector',
                'verbose_name_plural': 'Sectores',
                'db_table': 'sectors',
                'ordering': ['code'],
                'unique_together': {('district', 'code')},
            },
        ),
    ]