"""
Módulo Centralizado de Validadores de Atributos y Dominio Espacial.
"""
from django.core.validators import RegexValidator


code_alert_validator = RegexValidator(
    regex=r'^\d{9}$',
    message='El valor debe contener únicamente caracteres numéricos (0-9) y tener una longitud de 9 dígitos.'
)