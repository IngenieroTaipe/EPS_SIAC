"""
Módulo Centralizado de Validadores de Atributos y Dominio Espacial.
"""
from django.core.validators import RegexValidator

# ==============================================================================
# VALIDADORES GENERALES
# ==============================================================================

numeric_only_validator = RegexValidator(
    regex=r'^\d+$',
    message='El valor debe contener únicamente caracteres numéricos (0-9).'
)

alpha_name_validator = RegexValidator(
    # regex=r'^[\p{L}\s\-]+$/u',
    regex=r'^[a-zA-ZÁÉÍÓÚáéíóúñÑ\s]+$',
    message='El nombre no puede contener números ni caracteres especiales.'
)